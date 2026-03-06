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

  const result = (messages || []).map((m) => ({
    id: m.id,
    sender: m.senderId === appUser?.id ? 'me' : (m.sender?.id || m.senderId),
    senderId: m.senderId,
    senderName: m.sender?.displayName || '',
    text: m.body,
    type: m.type || 'text',
    time: formatTime(m.createdAt),
    createdAt: m.createdAt,
    read: true,
  }));

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

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
