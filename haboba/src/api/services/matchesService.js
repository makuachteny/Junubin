import { supabase } from '../../config/supabase';
import { formatTimestamp } from '../../utils/formatTime';
import { cacheGet, cacheSet } from '../../utils/offlineCache';

const OFFLINE_MATCHES_TTL = 300_000; // 5 min

export async function getMatches() {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error('Not authenticated');

  const { data: appUser } = await supabase
    .from('User')
    .select('id')
    .eq('auth_id', authUser.id)
    .single();

  if (!appUser) throw new Error('User not found');
  const userId = appUser.id;

  const { data: matches, error } = await supabase
    .from('Match')
    .select(`
      id,
      userAId,
      userBId,
      status,
      createdAt,
      updatedAt,
      conversation:Conversation(
        id,
        messages:Message(
          id, body, senderId, createdAt,
          sender:User!senderId(id, displayName)
        )
      ),
      userA:User!userAId(id, displayName, isVerified, photos:Photo(url, sortOrder)),
      userB:User!userBId(id, displayName, isVerified, photos:Photo(url, sortOrder))
    `)
    .eq('status', 'active')
    .or(`userAId.eq.${userId},userBId.eq.${userId}`)
    .order('updatedAt', { ascending: false });

  if (error) throw error;

  const result = (matches || []).map((m) => {
    const otherUser = m.userAId === userId ? m.userB : m.userA;
    const conv = m.conversation;
    const msgs = conv?.messages || [];
    const lastMessage = msgs.length > 0
      ? msgs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
      : null;

    const photos = (otherUser?.photos || [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((p) => p.url);

    return {
      id: m.id,
      conversationId: conv?.id,
      name: otherUser?.displayName || '',
      images: photos,
      verified: otherUser?.isVerified || false,
      lastMessage: lastMessage?.body || '',
      timestamp: lastMessage
        ? formatTimestamp(lastMessage.createdAt)
        : formatTimestamp(m.createdAt),
      unread: false,
      userId: otherUser?.id,
    };
  });

  cacheSet('matches', result, OFFLINE_MATCHES_TTL);
  return result;
}

/**
 * Returns cached matches when offline. Call getMatches() first.
 */
export async function getCachedMatches() {
  return cacheGet('matches');
}
