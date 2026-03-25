import { supabase } from '../../config/supabase';
import { normalizeProfile } from './profileService';

const COOLDOWN_SECONDS = 60;

async function resolveCurrentUserId() {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error('Not authenticated');

  const { data: appUser } = await supabase
    .from('User')
    .select('id')
    .eq('auth_id', authUser.id)
    .single();

  if (!appUser) throw new Error('User not found');
  return appUser.id;
}

async function isBlocked(userId, otherUserId) {
  const { data } = await supabase
    .from('Block')
    .select('id')
    .or(`and(blockerId.eq.${userId},blockedId.eq.${otherUserId}),and(blockerId.eq.${otherUserId},blockedId.eq.${userId})`)
    .limit(1);
  return (data || []).length > 0;
}

export async function sendWhisper(toUserId, body) {
  const fromUserId = await resolveCurrentUserId();
  if (toUserId === fromUserId) throw new Error('Cannot whisper yourself');

  const blocked = await isBlocked(fromUserId, toUserId);
  if (blocked) throw new Error('Blocked');

  const since = new Date(Date.now() - COOLDOWN_SECONDS * 1000).toISOString();
  const { data: recent } = await supabase
    .from('Whisper')
    .select('id')
    .eq('fromUserId', fromUserId)
    .gte('createdAt', since)
    .limit(1);

  if ((recent || []).length > 0) {
    const err = new Error('Please wait before sending another whisper.');
    err.code = 'cooldown';
    throw err;
  }

  const payload = { fromUserId, toUserId, body: body.trim() };
  const { error } = await supabase.from('Whisper').insert(payload);
  if (error) throw error;

  return { ok: true };
}

export async function getReceivedWhispers() {
  const userId = await resolveCurrentUserId();
  const { data, error } = await supabase
    .from('Whisper')
    .select(`
      id, body, createdAt,
      fromUser:User!fromUserId(
        id, displayName, dateOfBirth, isVerified, city, gender, countryCode,
        photos:Photo(*),
        profile:Profile(*)
      )
    `)
    .eq('toUserId', userId)
    .order('createdAt', { ascending: false });

  if (error) throw error;

  return (data || []).map((w) => {
    const profile = normalizeProfile(w.fromUser);
    return {
      ...profile,
      whisperId: w.id,
      whisperBody: w.body,
      whisperedAt: w.createdAt,
    };
  });
}
