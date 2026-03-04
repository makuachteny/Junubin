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

export async function recordSwipe(toUserId, type) {
  const { data, error } = await supabase.functions.invoke('swipe', {
    body: { toUserId, type },
  });
  if (error) throw error;
  return data;
}

export async function getDailyLikeStatus() {
  // Check cache
  if (likeStatusCache.data && Date.now() - likeStatusCache.timestamp < LIKE_STATUS_CACHE_TTL) {
    return likeStatusCache.data;
  }

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error('Not authenticated');

  const { data: appUser } = await supabase
    .from('User')
    .select('id, subscriptionTier')
    .eq('auth_id', authUser.id)
    .single();

  if (!appUser) throw new Error('User not found');

  const tier = appUser.subscriptionTier || 'free';
  const unlimited = tier !== 'free';

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('Swipe')
    .select('id', { count: 'exact', head: true })
    .eq('fromUserId', appUser.id)
    .in('type', ['like', 'super_like'])
    .gte('createdAt', startOfDay.toISOString());

  const used = count || 0;
  const limit = unlimited ? Infinity : 25;
  const remaining = unlimited ? Infinity : Math.max(0, 25 - used);

  const result = { used, limit, remaining };

  // Store in cache
  likeStatusCache.data = result;
  likeStatusCache.timestamp = Date.now();

  return result;
}
