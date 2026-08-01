import { supabase } from '../../config/supabase';
import { cacheGet, cacheSet } from '../../utils/offlineCache';

const OFFLINE_MESSAGES_TTL = 600_000; // 10 min

// Chat is text-only. `Message.type` is still a free-text column and
// historic rows carry 'image' | 'audio' | 'gift' | 'game' bodies, so
// every read path normalises anything that isn't 'text' to this
// sentinel. The UI renders a neutral, non-actionable placeholder for
// it instead of trying to reconstruct an attachment we no longer
// support.
export const UNSUPPORTED_MESSAGE_TYPE = 'unsupported';

export async function getMessages(conversationId) {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error('Not authenticated');

  const { data: appUser } = await supabase
    .from('User')
    .select('id')
    .eq('auth_id', authUser.id)
    .single();

  if (!appUser) throw new Error('User not found');

  const { data: messages, error } = await supabase
    .from('Message')
    .select('id, body, type, createdAt, readAt, senderId, sender:User!senderId(id, displayName)')
    .eq('conversationId', conversationId)
    .order('createdAt', { ascending: true })
    .limit(100);

  if (error) throw error;

  const result = (messages || []).map((m) => {
    const isMine = m.senderId === appUser?.id;
    // Read receipt: a message I sent is "read" once the recipient's
    // markConversationRead RPC has stamped readAt on the row. For
    // messages I received, the receipt concept doesn't apply — but
    // we still set read=true so my own scroll position never shows
    // a "new" badge against something I'm already looking at. The
    // previous version hardcoded read:true unconditionally, which
    // silently broke the read-receipt feature (00022) for senders.
    const read = isMine ? Boolean(m.readAt) : true;
    // Legacy rows (image / audio / gift / game) stored JSON-encoded
    // bodies for the attachment metadata. We no longer render those
    // attachments, so the body is dropped entirely rather than leaked
    // into a text bubble as raw JSON — the caller shows a placeholder
    // keyed off `type`.
    const isText = (m.type || 'text') === 'text';
    return {
      id: m.id,
      sender: isMine ? 'me' : (m.sender?.id || m.senderId),
      senderId: m.senderId,
      senderName: m.sender?.displayName || '',
      isMe: isMine,
      text: isText ? m.body : '',
      type: isText ? 'text' : UNSUPPORTED_MESSAGE_TYPE,
      time: formatTime(m.createdAt),
      createdAt: m.createdAt,
      readAt: m.readAt || null,
      read,
    };
  });

  cacheSet(`messages_${conversationId}`, result, OFFLINE_MESSAGES_TTL);
  return result;
}

/**
 * Send a plain-text message. Text is the only message kind JuNubin
 * supports — the `type` parameter survives purely so a stale caller
 * (or an offline action queued by an older build) fails loudly here
 * instead of writing a row nothing can render.
 */
export async function sendMessage(conversationId, body, type = 'text') {
  if (type !== 'text') throw new Error('Only text messages are supported');
  if (typeof body !== 'string') throw new Error('Message body must be text');

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error('Not authenticated');

  const { data: appUser } = await supabase
    .from('User')
    .select('id')
    .eq('auth_id', authUser.id)
    .single();

  if (!appUser) throw new Error('User not found');

  // Strip all angle brackets and HTML entities before persisting.
  // Failures propagate to the caller — ChatScreen owns the offline
  // queueing (one layer, one queue shape: 'text_message'); the old
  // second enqueue here used a shape no drain handler matched, so it
  // only produced ghost entries.
  const sanitized = body.replace(/<[^>]*>?/g, '').replace(/&[a-z]+;/gi, '').slice(0, 4000);

  const { data: message, error } = await supabase
    .from('Message')
    .insert({
      conversationId,
      senderId: appUser.id,
      body: sanitized,
      type: 'text',
    })
    .select('*')
    .single();

  if (error) throw error;
  return message;
}

/**
 * Resolve (or mint) the direct conversation with a peer. Wraps the
 * `get_or_create_direct_conversation` RPC (00048): server-side it
 * requires the pair to be mutual follows or have an accepted message
 * request, refuses across blocks, reuses any existing conversation,
 * and otherwise mints Match+Conversation+members atomically. This is
 * THE way a "Message" button gets a conversationId — navigating to
 * Chat without one renders a composer whose sends go nowhere.
 *
 * Throws with the server's reason ('not_connected', 'blocked', …) so
 * callers can fall back to the message-request composer.
 */
export async function getOrCreateDirectConversation(peerUserId) {
  if (!peerUserId) throw new Error('Missing peer');
  const { data, error } = await supabase.rpc('get_or_create_direct_conversation', {
    peer_id: peerUserId,
  });
  if (error) throw error;
  if (!data) throw new Error('No conversation returned');
  return data;
}

/**
 * Mark every inbound, unread message in the conversation as read.
 * Wraps the `mark_conversation_read` RPC (00022_read_receipts.sql) which
 * does the auth + membership check server-side and only flips `readAt`
 * for messages the caller did not send. Returns the count of rows
 * marked, so the caller can decrement local badge state if it wants.
 *
 * Fire-and-forget at most call sites — failures shouldn't block the
 * UI. Callers should `.catch(() => {})` if they don't care.
 */
export async function markConversationRead(conversationId) {
  if (!conversationId) return 0;
  const { data, error } = await supabase.rpc('mark_conversation_read', {
    conversation_id: conversationId,
  });
  if (error) throw error;
  return typeof data === 'number' ? data : 0;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
