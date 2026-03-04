import { supabase } from '../../config/supabase';

export async function getMessages(conversationId) {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error('Not authenticated');

  const { data: appUser } = await supabase
    .from('User')
    .select('id')
    .eq('auth_id', authUser.id)
    .single();

  const { data: messages, error } = await supabase
    .from('Message')
    .select('id, body, type, createdAt, senderId, sender:User!senderId(id, displayName)')
    .eq('conversationId', conversationId)
    .order('createdAt', { ascending: true })
    .limit(100);

  if (error) throw error;

  return (messages || []).map((m) => ({
    id: m.id,
    sender: m.senderId === appUser?.id ? 'me' : (m.sender?.id || m.senderId),
    senderId: m.senderId,
    senderName: m.sender?.displayName || '',
    text: m.body,
    time: formatTime(m.createdAt),
    createdAt: m.createdAt,
    read: true,
  }));
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

  const sanitized = body.replace(/<[^>]*>/g, '').slice(0, 4000);

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
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
