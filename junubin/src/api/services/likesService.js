import { supabase } from '../../config/supabase';
import { normalizeProfile } from './profileService';
import { cacheGet, cacheSet } from '../../utils/offlineCache';

const OFFLINE_LIKES_TTL = 300_000; // 5 min

// A whisper ("say hi" note attached to a like) is time-sensitive, like
// a Bumble Compliment: if the recipient doesn't act within 24h the note
// expires and stops showing. The underlying like stays (it's still a
// genuine like) — only the note vanishes.
const WHISPER_TTL_MS = 24 * 60 * 60 * 1000;

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

  // Pull the whisper text directly off the Swipe row. The
  // `Swipe.whisper` column was added in 00010 and is what the swipe
  // Edge Function actually writes; the legacy `Whisper` table from
  // 00005 is never populated by the current backend, so an earlier
  // version of this service that joined it always returned no
  // whispers (real likes never lit up the Whispers filter / badge).
  const { data: swipes, error } = await supabase
    .from('Swipe')
    .select(`
      id, type, mode, whisper, createdAt,
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
      const rawWhisper = (typeof s.whisper === 'string' && s.whisper.trim()) || null;
      // Expire the note after 24h (Bumble-Compliment parity). Guard
      // against an unparseable createdAt by treating it as not-expired.
      const createdMs = new Date(s.createdAt).getTime();
      const whisperExpired = Number.isFinite(createdMs) && (Date.now() - createdMs) > WHISPER_TTL_MS;
      const whisperText = whisperExpired ? null : rawWhisper;
      return {
        ...profile,
        likeId: s.id,
        likeType: s.type,
        likedAt: s.createdAt,
        // Mode the liker was in when they swiped. Used to bucket
        // received likes alongside their matches in MessagesScreen.
        mode: s.mode || 'dating',
        hasWhisper: !!whisperText,
        whisperText,
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
