import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../../config/supabase';
import { cacheGet, cacheSet } from '../../utils/offlineCache';
import { enqueueAction } from '../../utils/offlineQueue';

const OFFLINE_MESSAGES_TTL = 600_000; // 10 min

/**
 * Resize + recompress a local image URI before upload. Mirrors the
 * helper used by profileService / postService / storyService — chat
 * images go through the same bucket pressure, so we cap them too.
 */
async function compressImageIfNeeded(uri) {
  if (!uri || typeof uri !== 'string') return uri;
  if (uri.startsWith('http')) return uri;
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri;
  } catch (e) {
    if (__DEV__) console.warn('[compress] failed, uploading raw:', e?.message);
    return uri;
  }
}

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
    const base = {
      id: m.id,
      sender: isMine ? 'me' : (m.sender?.id || m.senderId),
      senderId: m.senderId,
      senderName: m.sender?.displayName || '',
      isMe: isMine,
      text: m.body,
      type: m.type || 'text',
      time: formatTime(m.createdAt),
      createdAt: m.createdAt,
      readAt: m.readAt || null,
      read,
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
    // Image messages store the storage URL as a JSON-encoded body too —
    // mirrors the audio path so ChatImageBubble can read `uri` directly
    // off the message.
    if (base.type === 'image') {
      try {
        const meta = JSON.parse(m.body || '{}');
        base.uri = meta.url;
        base.text = '';
      } catch {
        base.uri = m.body;
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

  try {
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
  } catch (err) {
    // Queue transient failures (network drop, 5xx) so a flaky tunnel
    // doesn't silently swallow a typed-and-tapped message. The
    // existing offlineQueue knows the 'text' shape (see
    // offlineQueue.js:38) so the consumer just needs to replay
    // sendMessage(conversationId, body, type) on reconnect.
    // Hard-rejection errors (RLS, validation) get queued too but
    // dropped on replay precheck — better to leave the disposal to
    // the consumer than to misclassify here.
    const status = err?.status || err?.statusCode;
    const transient = !status
      || (status >= 500 && status < 600)
      || /network|fetch|timeout/i.test(err?.message || '');
    if (transient && type !== 'game') {
      await enqueueAction({
        kind: 'text',
        conversationId,
        body: sanitized,
        type,
        // tempId is stable-per-send so the queue dedupes a retry of
        // the same enter-tap rather than fanning out to N copies.
        tempId: `${appUser.id}-${Date.now()}`,
        enqueuedAt: Date.now(),
      }).catch(() => {});
    }
    throw err;
  }
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

  try {
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
        contentType: 'audio/mp4',
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
  } catch (err) {
    // Persist the local URI so a future retry consumer can pick it up.
    // Without this, a failed upload silently drops the recording. We
    // still rethrow so the caller's UI (alert/toast) fires unchanged.
    await enqueueAction({
      kind: 'voiceNote',
      conversationId,
      uri: fileUri,
      durationMs: Math.max(0, Math.round((durationSec || 0) * 1000)),
      enqueuedAt: Date.now(),
    }).catch(() => {});
    throw err;
  }
}

/**
 * Upload a picked image and create an image Message in one shot.
 * Body shape: `{"url": "<storage path>"}` (JSON stringified). The chat
 * bubble (ChatImageBubble) parses `uri` from the message — getMessages
 * unwraps the JSON body for `type: 'image'` the same way it does audio.
 *
 * Storage layout: `posts/<senderId>/chat/<conversationId>/<ts>.jpg` —
 * reuses the existing `posts` bucket. The first folder MUST equal the
 * uploader's User.id so the `Posts img owner write` RLS policy
 * (00012_posts_safety_unmatch.sql) accepts the INSERT — putting
 * `chat/` first caused every chat image upload to 403. Switch to a
 * dedicated `chat-images` bucket once the RLS for it lands.
 */
export async function sendImageMessage(conversationId, fileUri) {
  if (!conversationId || !fileUri) throw new Error('Missing conversation or file');

  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new Error('Not authenticated');

    const { data: appUser } = await supabase
      .from('User')
      .select('id')
      .eq('auth_id', authUser.id)
      .single();
    if (!appUser) throw new Error('User not found');

    // Compress before upload. After compression the URI is always a
    // fresh JPEG, so we skip extension sniffing in that case and pin
    // the contentType. The pre-compress URI may still be a heic/png
    // pulled from the camera roll; the existing whitelist handles
    // anything that slips through (e.g. http re-edit URLs).
    const compressedUri = await compressImageIfNeeded(fileUri);
    const wasCompressed = compressedUri !== fileUri;
    const cleanPath = compressedUri.split('?')[0].split('#')[0];
    const extRaw = (cleanPath.split('.').pop() || 'jpg').toLowerCase();
    const ext = wasCompressed
      ? 'jpg'
      : (['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(extRaw) ? extRaw : 'jpg');
    const contentType = ext === 'png' ? 'image/png'
      : ext === 'webp' ? 'image/webp'
      : 'image/jpeg';

    const fileResponse = await fetch(compressedUri);
    const fileBlob = await fileResponse.blob();

    // RLS on the `posts` bucket requires the first path segment to be
    // the uploader's User.id. Namespace chat images under the user
    // first, then organize by conversation. See the storage layout
    // note in this function's JSDoc above.
    const filename = `${Date.now()}.${ext}`;
    const path = `${appUser.id}/chat/${conversationId}/${filename}`;

    const { error: upErr } = await supabase.storage
      .from('posts')
      .upload(path, fileBlob, {
        contentType,
        upsert: false,
      });
    if (upErr) throw upErr;

    const { data: pub } = supabase.storage.from('posts').getPublicUrl(path);
    const url = pub.publicUrl;

    const body = JSON.stringify({ url });

    const { data: message, error } = await supabase
      .from('Message')
      .insert({
        conversationId,
        senderId: appUser.id,
        body,
        type: 'image',
      })
      .select('*')
      .single();

    if (error) throw error;
    return { ...message, url };
  } catch (err) {
    await enqueueAction({
      kind: 'chatImage',
      conversationId,
      uri: fileUri,
      enqueuedAt: Date.now(),
    }).catch(() => {});
    throw err;
  }
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
