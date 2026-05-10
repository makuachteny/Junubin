import { supabase } from '../../config/supabase';
import { cacheGet, cacheSet } from '../../utils/offlineCache';

const OFFLINE_MESSAGES_TTL = 600_000; // 10 min

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
    .select('id, body, type, createdAt, senderId, sender:User!senderId(id, displayName)')
    .eq('conversationId', conversationId)
    .order('createdAt', { ascending: true })
    .limit(100);

  if (error) throw error;

  const result = (messages || []).map((m) => {
    const base = {
      id: m.id,
      sender: m.senderId === appUser?.id ? 'me' : (m.sender?.id || m.senderId),
      senderId: m.senderId,
      senderName: m.sender?.displayName || '',
      isMe: m.senderId === appUser?.id,
      text: m.body,
      type: m.type || 'text',
      time: formatTime(m.createdAt),
      createdAt: m.createdAt,
      read: true,
    };
    // Audio messages store the storage URL + duration as a JSON-encoded
    // body so the existing `Message.body` text column doesn't need a
    // schema migration. Parse here so the bubble renders with `uri` /
    // `duration` directly.
    if (base.type === 'audio') {
      try {
        const meta = JSON.parse(m.body || '{}');
        base.uri = meta.url;
        base.duration = meta.duration || 0;
        base.text = '';
      } catch {
        base.uri = m.body;
        base.duration = 0;
      }
    }
    return base;
  });

  cacheSet(`messages_${conversationId}`, result, OFFLINE_MESSAGES_TTL);
  return result;
}

export async function sendMessage(conversationId, body, type = 'text') {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error('Not authenticated');

  const { data: appUser } = await supabase
    .from('User')
    .select('id')
    .eq('auth_id', authUser.id)
    .single();

  if (!appUser) throw new Error('User not found');

  // Game messages carry JSON payloads — skip HTML stripping, allow larger body
  // Strip all angle brackets and HTML entities for regular messages
  const sanitized = type === 'game'
    ? body.slice(0, 8000)
    : body.replace(/<[^>]*>?/g, '').replace(/&[a-z]+;/gi, '').slice(0, 4000);

  const { data: message, error } = await supabase
    .from('Message')
    .insert({
      conversationId,
      senderId: appUser.id,
      body: sanitized,
      type,
    })
    .select('*')
    .single();

  if (error) throw error;
  return message;
}

/**
 * Upload a recorded audio file and create an audio Message in one shot.
 * Body shape: `{"url": "<storage path>", "duration": <seconds>}` (JSON
 * stringified). The chat bubble parses this on render via ChatAudioBubble.
 *
 * Storage layout: `voice-notes/<conversationId>/<senderId>-<ts>.m4a` —
 * conversation prefix lets the RLS policy on the bucket scope reads
 * to the conversation members.
 */
export async function sendAudioMessage(conversationId, fileUri, durationSec) {
  if (!conversationId || !fileUri) throw new Error('Missing conversation or file');

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error('Not authenticated');

  const { data: appUser } = await supabase
    .from('User')
    .select('id')
    .eq('auth_id', authUser.id)
    .single();
  if (!appUser) throw new Error('User not found');

  // Slurp the local file URI into a Blob the JS client can stream up.
  const fileResponse = await fetch(fileUri);
  const fileBlob = await fileResponse.blob();

  const filename = `${appUser.id}-${Date.now()}.m4a`;
  const path = `${conversationId}/${filename}`;

  const { error: upErr } = await supabase.storage
    .from('voice-notes')
    .upload(path, fileBlob, {
      contentType: 'audio/m4a',
      upsert: false,
    });
  if (upErr) throw upErr;

  // Public URL is fine for v1 — the path includes the conversation ID
  // which is itself unguessable. Switch to signed URLs later if we need
  // tighter access control.
  const { data: pub } = supabase.storage.from('voice-notes').getPublicUrl(path);
  const url = pub.publicUrl;

  const body = JSON.stringify({ url, duration: Math.max(1, Math.round(durationSec || 0)) });

  const { data: message, error } = await supabase
    .from('Message')
    .insert({
      conversationId,
      senderId: appUser.id,
      body,
      type: 'audio',
    })
    .select('*')
    .single();

  if (error) throw error;
  return message;
}

/**
 * Toggle a reaction (emoji) on a message for the current user.
 * Optimistic-friendly: returns `{ added: true }` if it was inserted,
 * `{ removed: true }` if it was an existing reaction we removed.
 */
export async function toggleReaction(messageId, emoji) {
  if (!messageId || !emoji) throw new Error('messageId + emoji required');

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error('Not authenticated');

  const { data: appUser } = await supabase
    .from('User')
    .select('id')
    .eq('auth_id', authUser.id)
    .single();
  if (!appUser) throw new Error('User not found');

  // Look up an existing reaction first — toggle semantics.
  const { data: existing } = await supabase
    .from('MessageReaction')
    .select('id')
    .eq('messageId', messageId)
    .eq('userId', appUser.id)
    .eq('emoji', emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('MessageReaction')
      .delete()
      .eq('id', existing.id);
    if (error) throw error;
    return { removed: true };
  }

  const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `mr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await supabase
    .from('MessageReaction')
    .insert({
      id,
      messageId,
      userId: appUser.id,
      emoji,
    });
  if (error) throw error;
  return { added: true };
}

/**
 * Bulk-fetch reactions for a list of message ids. Returns a map keyed by
 * messageId with values `[{ id, userId, emoji }]`. Cheap one-shot called
 * after `getMessages` to populate the initial reaction state before the
 * Realtime subscription takes over for live updates.
 */
export async function getReactions(messageIds) {
  if (!messageIds?.length) return {};
  const { data, error } = await supabase
    .from('MessageReaction')
    .select('id, messageId, userId, emoji')
    .in('messageId', messageIds);
  if (error) throw error;
  const map = {};
  for (const r of data || []) {
    if (!map[r.messageId]) map[r.messageId] = [];
    map[r.messageId].push(r);
  }
  return map;
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
