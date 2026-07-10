import { supabase } from '../../config/supabase';
import { normalizeProfile } from './profileService';
import { cacheGet, cacheSet } from '../../utils/offlineCache';

const profileCache = new Map();
const PROFILE_CACHE_TTL = 60_000;
const OFFLINE_PROFILES_TTL = 300_000; // 5 min persistent cache

const likeStatusCache = { data: null, timestamp: 0 };
const LIKE_STATUS_CACHE_TTL = 30_000;

export async function getProfiles(filters = {}) {
  const params = new URLSearchParams();
  if (filters.minAge) params.set('minAge', filters.minAge);
  if (filters.maxAge) params.set('maxAge', filters.maxAge);
  if (filters.ethnicity) params.set('ethnicity', filters.ethnicity);
  if (filters.minHeightCm) params.set('minHeightCm', filters.minHeightCm);
  if (filters.maxHeightCm) params.set('maxHeightCm', filters.maxHeightCm);
  if (filters.datingIntentions) params.set('datingIntentions', filters.datingIntentions);
  if (filters.gender) params.set('gender', filters.gender);
  if (filters.cursor) params.set('cursor', filters.cursor);
  if (filters.limit) params.set('limit', filters.limit);
  if (filters.mode) params.set('mode', filters.mode);

  const qs = params.toString();
  const offlineKey = `discover_${qs}`;

  // Check in-memory cache
  const cached = profileCache.get(qs);
  if (cached && Date.now() - cached.timestamp < PROFILE_CACHE_TTL) {
    return cached.data;
  }

  try {
    const { data, error } = await supabase.functions.invoke(`discover${qs ? `?${qs}` : ''}`);
    if (error) throw error;

    const result = {
      profiles: (data.profiles || []).map(normalizeProfile),
      nextCursor: data.nextCursor,
    };

    // Store in both caches
    profileCache.set(qs, { data: result, timestamp: Date.now() });
    cacheSet(offlineKey, result, OFFLINE_PROFILES_TTL);

    return result;
  } catch (err) {
    // Fall back to persistent cache on network failure
    const offline = await cacheGet(offlineKey);
    if (offline) return offline;
    throw err;
  }
}

// `extra` carries optional payload — `whisper` (a short text the
// swiper sends along with a right-swipe so the recipient sees it on
// their Likes screen) and `mode` (the app mode the swiper was in when
// they tapped, so Match rows record provenance and MessagesScreen can
// sort by current mode). Backend accepts arbitrary extra fields.
export async function recordSwipe(toUserId, type, extra = null) {
  const { data, error } = await supabase.functions.invoke('swipe', {
    body: { toUserId, type, ...(extra || {}) },
  });
  if (error) throw error;
  return data;
}

// Reverse the most recent swipe for the given target. Used by the
// JuNubin+ Rewind action so the like quota is credited back and the
// recipient never sees a like that was undone. Best-effort — if the
// backend function isn't deployed yet, the local UI rewind still
// works without it.
export async function undoLastSwipe(toUserId) {
  const { data, error } = await supabase.functions.invoke('swipe-undo', {
    body: { toUserId },
  });
  if (error) throw error;
  return data;
}

export async function getDailyLikeStatus() {
  // Check cache
  if (likeStatusCache.data && Date.now() - likeStatusCache.timestamp < LIKE_STATUS_CACHE_TTL) {
    return likeStatusCache.data;
  }

  // Server-side RPC (00029_audit_blockers.sql) returns the authoritative
  // {tier, used, limit, remaining, unlimited}. Doing the tier + count
  // join on the server means a patched client can't claim unlimited
  // status to hide the rate-limit badge — the swipe Edge Function
  // already enforces the cap, but the UI now reflects the same truth.
  //
  // Fallback path kicks in only if the RPC hasn't been deployed yet
  // (the migration is on the operator's todo). We treat the response
  // shape `{ error: 'not_authenticated' }` as a hard auth error.
  const { data, error } = await supabase.rpc('get_daily_like_status');
  if (error) {
    if (error.message?.toLowerCase().includes('not_authenticated')) {
      throw new Error('Not authenticated');
    }
    throw error;
  }

  const used = Number(data?.used) || 0;
  const unlimited = data?.unlimited === true;
  // Default fallback is the free-tier daily ceiling so an unknown
  // shape from the RPC doesn't grant a free user 25 swipes (the old
  // limit) on the UI badge — keep this in sync with 00037 SQL +
  // DAILY_LIKE_LIMIT_BY_TIER in payments/entitlements.js.
  const result = {
    used,
    limit: unlimited ? Infinity : Number(data?.limit ?? 20),
    remaining: unlimited ? Infinity : Math.max(0, Number(data?.remaining ?? 0)),
    tier: data?.tier || 'free',
  };

  likeStatusCache.data = result;
  likeStatusCache.timestamp = Date.now();
  return result;
}

// Invalidate the like-status cache. Call after a successful subscription
// purchase / promo grant so the next read reflects the new tier
// immediately instead of waiting on the 30s TTL.
export function invalidateLikeStatusCache() {
  likeStatusCache.data = null;
  likeStatusCache.timestamp = 0;
}

// Calls the discover-nearby Edge Function (see
// supabase/functions/discover-nearby/index.ts). Body shape:
//   { center: { latitude, longitude }, radiusKm, mode, activeOnly }
// Response:
//   { users: [{ id, name, age, photos, coords, activity, verified,
//              ethnicity, mode, distanceKm }] }
//
// The function does its own auth check, applies shareLocation +
// block + mode filters, and bucket-snaps coordinates server-side.
// If the function isn't deployed (404) or any network error fires,
// we swallow and return an empty list — PeopleMap's demo roster
// fallback covers the empty case, so the map never crashes.
export async function getNearbyUsers({ center, radiusKm, mode, activeOnly } = {}) {
  if (!center || !Number.isFinite(center.latitude) || !Number.isFinite(center.longitude)) {
    return { users: [] };
  }
  try {
    const { data, error } = await supabase.functions.invoke('discover-nearby', {
      body: {
        center: { latitude: center.latitude, longitude: center.longitude },
        radiusKm: radiusKm || undefined,
        mode: mode ? String(mode).toLowerCase() : undefined,
        activeOnly: !!activeOnly,
      },
    });
    if (error) throw error;
    return { users: Array.isArray(data?.users) ? data.users : [] };
  } catch (err) {
    if (__DEV__) console.warn('[discover-nearby] failed, falling back to empty:', err?.message || err);
    return { users: [] };
  }
}
