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

  const likerIds = (swipes || [])
    .map((s) => s.fromUser?.id)
    .filter((id) => id && !swipedIds.has(id));

  // Pull the latest whisper from each liker so the LikesScreen can
  // render the "Whispered X ago" badge and the Whispers filter chip
  // works for real likes (it already worked for demo data because the
  // mockLikes have `hasWhisper` baked in). One round-trip, in() filter
  // — cheap even for hundreds of likes.
  const whisperByLiker = new Map();
  if (likerIds.length > 0) {
    const { data: whispers, error: whisperError } = await supabase
      .from('Whisper')
      .select('fromUserId, body, createdAt')
      .eq('toUserId', userId)
      .in('fromUserId', likerIds)
      .order('createdAt', { ascending: false });
    // Don't fail the whole getReceivedLikes call if the whisper join
    // errors — likes are still useful without the whisper badge — but
    // surface it in dev so a real RLS / schema regression isn't
    // hidden behind the silent fallback.
    if (whisperError) {
      if (__DEV__) console.warn('[likesService] Whisper join failed:', whisperError.message || whisperError);
    } else {
      for (const w of whispers || []) {
        if (!whisperByLiker.has(w.fromUserId)) {
          whisperByLiker.set(w.fromUserId, { body: w.body, createdAt: w.createdAt });
        }
      }
    }
  }

  const result = (swipes || [])
    .filter((s) => !swipedIds.has(s.fromUser?.id))
    .map((s) => {
      const profile = normalizeProfile(s.fromUser);
      const whisper = whisperByLiker.get(s.fromUser?.id) || null;
      return {
        ...profile,
        likeId: s.id,
        likeType: s.type,
        likedAt: s.createdAt,
        // Mode the liker was in when they swiped. Used to bucket
        // received likes alongside their matches in MessagesScreen.
        mode: s.mode || 'dating',
        hasWhisper: !!whisper,
        whisperText: whisper?.body || null,
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
