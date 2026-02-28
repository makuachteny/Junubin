import { apiRequest } from '../client';

export async function getMessages(token, conversationId) {
  const data = await apiRequest(`/conversations/${conversationId}/messages`, { token });
  return (data.messages || []).map((m) => ({
    id: m.id,
    sender: m.senderId === 'SELF' ? 'me' : (m.sender?.id || m.senderId),
    senderId: m.senderId,
    senderName: m.sender?.displayName || '',
    text: m.body,
    time: formatTime(m.createdAt),
    createdAt: m.createdAt,
    read: true,
  }));
}

export async function sendMessage(token, conversationId, body, type = 'text') {
  const data = await apiRequest(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    token,
    body: { body, type },
  });
  return data.message;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
