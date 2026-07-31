// Edge Function: directory
//
// Searchable people directory for the social pivot. This is the
// browse-everyone surface that replaces the swipe deck as the primary
// way to find other Junubin.
//
// Why this has to be an Edge Function at all: 00029 narrowed the `User`
// SELECT policy to "people you already have a relationship with", so a
// direct client query returns an empty list for every stranger — which
// is exactly the set a directory is for. Like `discover`, we run with
// the service role and enforce the visibility rules ourselves:
//
//   * Profile.directoryVisible must be TRUE (00047 opt-out)
//   * User.isActive AND User.moderationStatus = 'active'
//   * caller excluded
//   * Block excluded in both directions
//
// Query params:
//   q            free text over displayName / city / job / school
//   city, countryCode, ethnicity, profession, school
//   interests, languages, openTo   comma lists, any-of semantics
//   verified     'true' → verified accounts only
//   cursor, limit (default 24, max 50)
//
// Response: { people: [...], nextCursor } where each person carries the
// same user shape `discover` returns so the client can run the same
// normalizeProfile over both.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, getUser, errorResponse, jsonResponse } from "../_shared/utils.ts";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 50;

// Unlike `discover`, we never select `*` off User — that table carries
// email, phone and passwordHash. The directory hands back exactly the
// columns the profile card renders.
const USER_COLUMNS = `
  id, displayName, dateOfBirth, isVerified, gender, city, countryCode, lastActiveAt,
  photos:Photo(id, url, sortOrder, isPrimary),
  profile:Profile!inner(
    bio, lookingFor, datingIntentions, job, school, ethnicity, heightCm,
    pronouns, education, children, interests, stickers, currentlyInto,
    languages, openTo, profession, locationVisibility,
    directoryVisible, incognito, showMe
  )
`;

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

// Comma list → lowercased, de-duped terms. Empty input yields an empty
// array, which every filter below treats as "no constraint".
function parseList(raw: string | undefined): string[] {
  if (!raw) return [];
  const out = new Set<string>();
  for (const part of raw.split(",")) {
    const term = normalize(part);
    if (term) out.add(term);
  }
  return [...out];
}

// JSONB array columns (interests / languages / openTo) hold plain
// strings, but legacy `stickers`-style rows can hold { label } objects,
// so accept both shapes the way discover's sticker scoring does.
function toTermSet(value: unknown): Set<string> {
  const arr = Array.isArray(value) ? value : [];
  const out = new Set<string>();
  for (const item of arr) {
    const term = normalize(typeof item === "string" ? item : (item as any)?.label);
    if (term) out.add(term);
  }
  return out;
}

// Any-of: a person matches the facet if they carry at least one of the
// requested terms. All-of would silently return nothing for a user who
// picks three languages out of a long list.
function matchesAnyTerm(value: unknown, wanted: string[]): boolean {
  if (wanted.length === 0) return true;
  const have = toTermSet(value);
  if (have.size === 0) return false;
  return wanted.some((w) => have.has(w));
}

function matchesQuery(row: any, q: string): boolean {
  if (!q) return true;
  const p = row.profile || {};
  const haystack = [row.displayName, row.city, p.job, p.school]
    .map((v) => normalize(v))
    .filter(Boolean);
  return haystack.some((field) => field.includes(q));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userId = await getUser(req, supabase);
    if (!userId) return errorResponse("Unauthorized", 401);

    const url = new URL(req.url);
    const params = Object.fromEntries(url.searchParams);

    const q = normalize(params.q);
    const city = params.city;
    const countryCode = params.countryCode;
    const ethnicity = normalize(params.ethnicity);
    const profession = normalize(params.profession);
    const school = normalize(params.school);
    const interests = parseList(params.interests);
    const languages = parseList(params.languages);
    const openTo = parseList(params.openTo);
    const verifiedOnly = params.verified === "true";
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(params.limit || String(DEFAULT_LIMIT))));
    const cursor = params.cursor;

    // Block exclusion in both directions — same shape as discover. A
    // user who blocked the caller (or whom the caller blocked) is not
    // findable through search either.
    const excludedIds: string[] = [userId];
    const { data: blockedByMe } = await supabase
      .from("Block")
      .select("blockedId")
      .eq("blockerId", userId);
    const { data: blockedMe } = await supabase
      .from("Block")
      .select("blockerId")
      .eq("blockedId", userId);
    for (const r of blockedByMe || []) excludedIds.push((r as any).blockedId);
    for (const r of blockedMe || []) excludedIds.push((r as any).blockerId);

    // Facet filters that can't be pushed into PostgREST (JSONB array
    // membership, free text spanning the embedded Profile) run in JS,
    // so we scan more rows than we return. 4x is the same order of
    // over-fetch discover uses for its profile-side filters.
    const scanLimit = limit * 4;

    let query = supabase
      .from("User")
      .select(USER_COLUMNS)
      .eq("isActive", true)
      .eq("moderationStatus", "active")
      .eq("profile.directoryVisible", true)
      .order("lastActiveAt", { ascending: false })
      .limit(scanLimit);

    // See the discover comment on URL length: PostgREST encodes `in`
    // filters into the query string, so a caller with thousands of
    // blocks could blow the URI limit. Blocks are far smaller than
    // swipe history, but cap defensively at the same bound.
    const URL_SAFE_CAP = 800;
    if (excludedIds.length > URL_SAFE_CAP) {
      excludedIds.splice(URL_SAFE_CAP);
    }
    query = query.not("id", "in", `(${excludedIds.join(",")})`);

    if (verifiedOnly) query = query.eq("isVerified", true);
    if (city) query = query.ilike("city", city);
    if (countryCode) query = query.eq("countryCode", countryCode);

    // Keyset cursor on the sort column. `discover` cursors on `id`
    // while ordering by lastActiveAt, which can skip rows; the
    // directory is a browse surface where that would be visible, so
    // the cursor here is the last row's lastActiveAt. Callers still
    // treat it as an opaque token.
    if (cursor) query = query.lt("lastActiveAt", cursor);

    const { data: rows, error } = await query;
    if (error) return errorResponse(error.message, 500);

    const scanned = rows || [];
    const scannedAll = scanned.length < scanLimit;

    const filtered = scanned.filter((row: any) => {
      const p = row.profile;
      if (!p) return false;
      // Incognito (00016) and the legacy showMe flag both mean "hide me
      // from discovery surfaces". The directory is one.
      if (p.incognito === true || p.showMe === false) return false;
      if (ethnicity && normalize(p.ethnicity) !== ethnicity) return false;
      if (profession && !normalize(p.profession).includes(profession)) return false;
      if (school && !normalize(p.school).includes(school)) return false;
      if (!matchesAnyTerm(p.interests, interests)) return false;
      if (!matchesAnyTerm(p.languages, languages)) return false;
      if (!matchesAnyTerm(p.openTo, openTo)) return false;
      if (!matchesQuery(row, q)) return false;
      return true;
    });

    const page = filtered.slice(0, limit);

    // Two ways there's more to fetch: the page filled and matches
    // remain in this scan, or the scan itself hit its ceiling and
    // there are unscanned rows behind it. Either way the cursor is the
    // last row we looked at on the sort column.
    let nextCursor: string | null = null;
    if (page.length === limit && filtered.length > limit) {
      nextCursor = page[page.length - 1]?.lastActiveAt || null;
    } else if (!scannedAll) {
      nextCursor = scanned[scanned.length - 1]?.lastActiveAt || null;
    }

    const people = page.map((row: any) => ({
      id: row.id,
      displayName: row.displayName,
      dateOfBirth: row.dateOfBirth,
      isVerified: row.isVerified,
      gender: row.gender,
      city: row.city,
      countryCode: row.countryCode,
      lastActiveAt: row.lastActiveAt,
      photos: (row.photos || [])
        .slice()
        .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
      profile: row.profile,
    }));

    return jsonResponse({ people, nextCursor });
  } catch (err: any) {
    return errorResponse(err.message || "Internal error", 500);
  }
});
