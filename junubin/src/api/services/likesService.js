import { supabase } from '../../config/supabase';
import { normalizeProfile } from './profileService';
import { cacheGet, cacheSet } from '../../utils/offlineCache';

const OFFLINE_LIKES_TTL = 300_000; // 5 min

export async function getReceivedLikes() {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error('Not authenticated');

  const { data: appUser } = await supabase
    .from('User')
    .select('id')
    .eq('auth_id', authUser.id)
    .single();

  if (!appUser) throw new Error('User not found');
  const userId = appUser.id;

  const { data: swipes, error } = await supabase
    .from('Swipe')
    .select(`
      id, type, mode, createdAt,
      fromUser:User!fromUserId(
        id, displayName, dateOfBirth, isVerified, city, gender,
        photos:Photo(*),
        profile:Profile(*)
      )
    `)
    .eq('toUserId', userId)
    .in('type', ['like', 'super_like'])
    .order('createdAt', { ascending: false });

  if (error) throw error;

  const { data: mySwipes } = await supabase
    .from('Swipe')
    .select('toUserId')
    .eq('fromUserId', userId);

  const swipedIds = new Set((mySwipes || []).map((s) => s.toUserId));

  const result = (swipes || [])
    .filter((s) => !swipedIds.has(s.fromUser?.id))
    .map((s) => {
      const profile = normalizeProfile(s.fromUser);
      return {
        ...profile,
        likeId: s.id,
        likeType: s.type,
        likedAt: s.createdAt,
        // Mode the liker was in when they swiped. Used to bucket
        // received likes alongside their matches in MessagesScreen.
        mode: s.mode || 'dating',
      };
    });

  cacheSet('received_likes', result, OFFLINE_LIKES_TTL);
  return result;
}

/**
 * Returns cached likes when offline.
 */
export async function getCachedLikes() {
  return cacheGet('received_likes');
}
