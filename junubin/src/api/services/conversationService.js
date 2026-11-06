import { supabase } from '../../config/supabase';
import { formatTimestamp } from '../../utils/formatTime';
import { cacheGet, cacheSet } from '../../utils/offlineCache';

const OFFLINE_CONVERSATIONS_TTL = 300_000; // 5 min

export async function getConversations() {
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
  // `unreadCount` per conversation without a follow-up query — it's just a
  // filter over the messages we're already loading for the last-message
  // preview. Cheaper than firing N count queries.
  //
  // The production schema still stores direct chat connections in the
  // legacy Match table. Keep that detail inside this service so screens
  // can use conversation/thread language.
  const { data: rows, error } = await supabase
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

  const result = (rows || []).map((m) => {
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
      // Whether the newest message in the thread is the current
      // user's — the inbox prefixes those previews with "You: ".
      lastMessageMine: !!lastMessage && lastMessage.senderId === userId,
      timestamp: lastMessage
        ? formatTimestamp(lastMessage.createdAt)
        : formatTimestamp(m.createdAt),
      unread: unreadCount > 0,
      unreadCount,
      userId: otherUser?.id,
      mode: m.mode || 'community',
      // Keep the raw timestamp around so inbox sorting can do a proper
      // numeric comparison without re-parsing the localized string.
      updatedAt: lastMessage?.createdAt || m.updatedAt || m.createdAt,
    };
  });

  cacheSet('conversations', result, OFFLINE_CONVERSATIONS_TTL);
  return result;
}

/**
 * Returns cached conversations when offline. Call getConversations() first.
 */
export async function getCachedConversations() {
  return cacheGet('conversations');
}
