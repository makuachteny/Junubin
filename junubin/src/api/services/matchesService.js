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

  // We pull `readAt` and `senderId` on each message so we can derive
  // `unreadCount` per match without a follow-up query — it's just a
  // filter over the messages we're already loading for the last-message
  // preview. Cheaper than firing N count queries (one per match).
  const { data: matches, error } = await supabase
    .from('Match')
    .select(`
      id,
      userAId,
      userBId,
      status,
      mode,
      createdAt,
      updatedAt,
      conversation:Conversation(
        id,
        messages:Message(
          id, body, senderId, createdAt, readAt,
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

    // Server-truth unread count: messages from the other party that
    // haven't been marked read yet (Message.readAt IS NULL). Stays
    // additive to the existing return shape — `unreadCount` is new,
    // `unread` keeps the old boolean meaning for any consumer that
    // hasn't migrated to the count yet.
    const unreadCount = msgs.reduce((acc, msg) => (
      msg.senderId !== userId && !msg.readAt ? acc + 1 : acc
    ), 0);

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
      unread: unreadCount > 0,
      unreadCount,
      userId: otherUser?.id,
      // Mode the match originated in ('dating' | 'social'). Used by
      // MessagesScreen to surface current-mode conversations first.
      // Defaults to 'dating' for legacy rows that pre-date 00025.
      mode: m.mode || 'dating',
      // Keep the raw timestamp around so sortByMode() can do a proper
      // numeric comparison without re-parsing the localized string.
      updatedAt: lastMessage?.createdAt || m.updatedAt || m.createdAt,
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
