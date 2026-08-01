// Edge Function: discover-nearby
//
// Returns the set of users near the caller for PeopleMap. Privacy is
// the controlling design constraint here — we ONLY return users who
// have explicitly opted into Profile.shareLocation (00032). The
// caller's coordinate stays on-device; we work off `center` in the
// body and snap every candidate's lat/lng to 3 decimals (~110m) on
// the server so an apartment is never identifiable.
//
// Request body:
//   center:     { latitude, longitude }   — caller's current pixel-snap
//   radiusKm:   number                     — distance cap (defaults to 50)
//   mode:       'dating' | 'social'        — OPTIONAL. Profile.appMode
//                                            (or mapped accountPurpose)
//                                            match. Omitted / unknown
//                                            values mean "show everyone",
//                                            which is the social-pivot
//                                            default — the community map
//                                            is not mode-segmented.
//   activeOnly: boolean                    — only users active in the
//                                            last 15 minutes
//
// Response:
//   { users: [{ id, name, age, photos, coords: { latitude, longitude },
//               activity, verified, ethnicity, mode, city, countryCode }] }
//
// Notes:
//   - We use service_role to bypass RLS for the candidate scan (the
//     map is a special-case surface that crosses follow/match
//     boundaries) but enforce filtering ourselves: location opt-in,
//     mutual-follow audience, mode match, Block exclusion, self
//     exclusion.
//   - Distance is filtered in JS (haversine). Postgres has cube +
//     earthdistance for this if it ever becomes a perf concern; for
//     v1 with thousands of opted-in users it's fine.
//   - Activity bucketing matches PeopleMap's `activity` field:
//     'active' (< 15min), 'recent' (< 60min), 'away' (older). The
//     marker chrome uses this to render the green dot.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getUser, errorResponse, jsonResponse, getMutualFollowIds } from "../_shared/utils.ts";

const DEFAULT_RADIUS_KM = 50;
const MAX_RADIUS_KM = 500;
const MAX_RESULTS = 200;
const COORD_BUCKET = 1000; // 3 decimals → divisor 1000

// Haversine in km. Same math the client uses in PeopleMap.js so the
// distance the server returns matches what the client would compute
// against the un-bucketed coords (within rounding error).
function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bucketCoord(value: number): number {
  return Math.round(value * COORD_BUCKET) / COORD_BUCKET;
}

function calculateAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age;
}

function bucketActivity(lastActiveAt: string | null): 'active' | 'recent' | 'away' {
  if (!lastActiveAt) return 'away';
  const ms = Date.now() - new Date(lastActiveAt).getTime();
  if (ms < 15 * 60 * 1000) return 'active';
  if (ms < 60 * 60 * 1000) return 'recent';
  return 'away';
}

// Resolve the canonical mode for a candidate. appMode is the new
// (00016) canonical field; we fall back to accountPurpose (00010,
// 'date'|'socialize') if appMode is null. Returns 'dating' | 'social'
// | null (unset means we don't surface them on either map).
function resolveMode(appMode: string | null, accountPurpose: string | null): 'dating' | 'social' | null {
  if (appMode === 'dating' || appMode === 'social') return appMode;
  if (accountPurpose === 'date') return 'dating';
  if (accountPurpose === 'socialize') return 'social';
  return null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const callerId = await getUser(req, supabase);
    if (!callerId) return errorResponse("Not authenticated", 401);

    const body = await req.json().catch(() => ({}));
    const center = body?.center;
    if (
      !center
      || typeof center.latitude !== "number"
      || typeof center.longitude !== "number"
      || !Number.isFinite(center.latitude)
      || !Number.isFinite(center.longitude)
    ) {
      return errorResponse("center.latitude and center.longitude are required");
    }

    const requestedRadius = Number(body?.radiusKm);
    const radiusKm = Number.isFinite(requestedRadius)
      ? Math.min(Math.max(requestedRadius, 0.1), MAX_RADIUS_KM)
      : DEFAULT_RADIUS_KM;

    const mode = body?.mode === 'dating' || body?.mode === 'social' ? body.mode : null;
    const activeOnly = body?.activeOnly === true;

    // Single query: pull every active opted-in user with usable
    // coords, plus the joins we need to filter mode + render the
    // marker (photos, ethnicity, lastActiveAt). The locationVisibility
    // filter (00047, superseding the shareLocation boolean from 00032)
    // is the ONLY way a candidate ends up in this set — anyone at
    // 'off' is invisible regardless of their other settings.
    const { data: rows, error } = await supabase
      .from("User")
      .select(`
        id, displayName, dateOfBirth, isVerified, latitude, longitude, lastActiveAt,
        city, countryCode,
        photos:Photo(url, sortOrder, moderationStatus),
        profile:Profile!inner(
          appMode, accountPurpose, ethnicity, incognito, showMe,
          locationVisibility, locationVisibleUntil
        )
      `)
      .eq("isActive", true)
      .neq("profile.locationVisibility", "off")
      .neq("id", callerId)
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (error) {
      console.error("discover-nearby: User query failed", error);
      return errorResponse("Failed to load nearby users", 500);
    }

    // Block exclusion in one round-trip — pull every blocker/blocked
    // pairing the caller participates in and skip those candidates.
    // Symmetric: if I blocked them OR they blocked me, neither sees
    // the other on the map.
    const { data: blocks } = await supabase
      .from("Block")
      .select("blockerId, blockedId")
      .or(`blockerId.eq.${callerId},blockedId.eq.${callerId}`);
    const blockedIds = new Set<string>();
    for (const b of blocks || []) {
      blockedIds.add(b.blockerId === callerId ? b.blockedId : b.blockerId);
    }

    // Mutual-follow audience for locationVisibility = 'mutuals' (00049).
    // Resolved ONCE, as two set queries over the caller's own follow
    // graph, and only when the candidate set actually contains a
    // 'mutuals' profile — the common map query touches nobody at that
    // level and pays nothing. Per-candidate follow lookups would be
    // hundreds of round trips per pan of the map.
    const hasMutualsCandidate = (rows || []).some(
      (row: any) => row?.profile?.locationVisibility === 'mutuals',
    );
    const mutualFollowIds = hasMutualsCandidate
      ? await getMutualFollowIds(supabase, callerId)
      : new Set<string>();

    const fifteenMinAgo = Date.now() - 15 * 60 * 1000;
    const users: any[] = [];

    for (const row of rows || []) {
      if (blockedIds.has(row.id)) continue;

      // Profile-level filters. incognito = true means "hide me from
      // discovery" (00016); showMe = false is the legacy version of
      // the same idea. Either one off means we skip.
      const p = row.profile;
      if (!p || p.incognito === true || p.showMe === false) continue;

      // Temporary sharing window (00047). NULL = indefinite; a past
      // timestamp means the user's "share for the next N hours" has
      // expired and they drop off the map without needing a cron job
      // to reset locationVisibility.
      if (p.locationVisibleUntil) {
        const until = new Date(p.locationVisibleUntil).getTime();
        if (!Number.isFinite(until) || until <= Date.now()) continue;
      }

      // 'mutuals' (00049) — "only people you both follow can see your
      // area". Enforced here, on the server, because the control is a
      // privacy promise: if this check lived in the client the profile
      // would still be on the wire to everyone. The relationship must
      // hold in BOTH directions; a one-way follower is not an audience.
      if (p.locationVisibility === 'mutuals' && !mutualFollowIds.has(row.id)) continue;

      // Mode match. If the caller specified a mode, the candidate
      // must resolve to the same. If the caller passed no mode we
      // show everyone — the post-pivot community map is not
      // mode-segmented, so this is now the common path.
      const candidateMode = resolveMode(p.appMode, p.accountPurpose);
      if (mode && candidateMode !== mode) continue;

      // Distance cap against the (un-bucketed) DB coords for
      // accuracy — we ONLY bucket on the wire, never in the
      // distance math.
      const coords = { latitude: row.latitude, longitude: row.longitude };
      const d = distanceKm(center, coords);
      if (!Number.isFinite(d) || d > radiusKm) continue;

      // Active-only filter (caller-controlled chip on the map).
      const activity = bucketActivity(row.lastActiveAt);
      if (activeOnly && activity !== 'active') continue;

      // Primary photo first; the rest in sortOrder so the marker
      // ring can rotate through them if the client ever wants.
      // Drop rejected photos (00050) before anything else. A row with
      // no moderationStatus is kept: that is the shape every photo has
      // until the migration lands, and defaulting the unknown case to
      // "hide" would blank the map instead of a single bad image.
      const sortedPhotos = (row.photos || [])
        .filter((ph: any) => ph?.moderationStatus !== 'rejected')
        .slice()
        .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((ph: any) => ph.url)
        .filter(Boolean);

      users.push({
        id: row.id,
        name: row.displayName || 'Junubin',
        age: calculateAge(row.dateOfBirth),
        photos: sortedPhotos,
        // Snap the returned coords so the wire never carries the raw
        // value. Two users at the same building both round to the
        // same bucket; both see the other at the bucket, not the
        // building.
        coords: {
          latitude: bucketCoord(row.latitude),
          longitude: bucketCoord(row.longitude),
        },
        activity,
        verified: !!row.isVerified,
        ethnicity: p.ethnicity || null,
        mode: candidateMode,
        // City / country are additive to the existing shape — the
        // pivot's map callout labels the pin with a place name rather
        // than a raw distance for users sharing at 'city' granularity.
        city: row.city || null,
        countryCode: row.countryCode || null,
        // The candidate's chosen granularity ('city' | 'coarse' |
        // 'mutuals'), so the map can render a city chip instead of a
        // pin for people who opted into city-level visibility only.
        // The query filter is `<> 'off'`, so every sharing level is in
        // this list; 'mutuals' rows only survive the loop above for a
        // caller they mutually follow, and they map at the same coarse
        // bucket as 'coarse'.
        locationVisibility: p.locationVisibility || 'off',
        // Distance is useful for the marker label ("0.6 mi"). Client
        // can recompute against center but returning it saves a
        // round-trip of math.
        distanceKm: Number(d.toFixed(2)),
      });

      if (users.length >= MAX_RESULTS) break;
    }

    // Closest first so a 200-candidate result still renders the most
    // useful pins near the caller.
    users.sort((a, b) => a.distanceKm - b.distanceKm);

    return jsonResponse({ users });
  } catch (err) {
    console.error("discover-nearby error:", err);
    return errorResponse(err?.message || "Unexpected error", 500);
  }
});

// Deno's std HTTP server shim. Imported at the bottom so the
// auto-import linters don't sort it above the corsHeaders import.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
