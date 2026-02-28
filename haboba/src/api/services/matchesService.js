import { apiRequest } from '../client';
import { formatTimestamp } from '../../utils/formatTime';

export async function getMatches(token) {
  const data = await apiRequest('/matches', { token });
  return (data.matches || []).map((m) => ({
    id: m.id,
    conversationId: m.conversationId,
    name: m.user.displayName,
    images: (m.user.photos || []).map((p) => p.url),
    verified: m.user.isVerified || false,
    lastMessage: m.lastMessage?.body || '',
    timestamp: m.lastMessage ? formatTimestamp(m.lastMessage.createdAt) : formatTimestamp(m.createdAt),
    unread: false,
    userId: m.user.id,
  }));
}
