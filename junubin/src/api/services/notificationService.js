import { formatTimestamp } from '../../utils/formatTime';
import * as conversationService from './conversationService';
import * as messageRequestService from './messageRequestService';

const asTime = (value) => {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
};

const actorFromConversation = (thread) => ({
  id: thread.userId || thread.id,
  userId: thread.userId || thread.id,
  name: thread.name || 'Someone',
  images: thread.images || [],
  isVerified: !!thread.verified,
  conversationId: thread.conversationId,
});

const actorName = (profile) => profile?.name || profile?.displayName || 'Someone';

export async function getNotifications() {
  const [conversationsResult, incomingResult, outgoingResult] = await Promise.allSettled([
    conversationService.getConversations(),
    messageRequestService.getIncomingRequests(),
    messageRequestService.getOutgoingRequests(),
  ]);

  const conversations = conversationsResult.status === 'fulfilled' ? conversationsResult.value || [] : [];
  const incoming = incomingResult.status === 'fulfilled' ? incomingResult.value || [] : [];
  const outgoing = outgoingResult.status === 'fulfilled' ? outgoingResult.value || [] : [];

  const messageRows = conversations
    .filter((thread) => thread.conversationId && (thread.unreadCount > 0 || thread.unread))
    .map((thread) => {
      const count = typeof thread.unreadCount === 'number' ? thread.unreadCount : 1;
      const actor = actorFromConversation(thread);
      return {
        id: `message-${thread.conversationId}`,
        type: 'message',
        actor,
        actorName: actor.name,
        text: count === 1 ? 'sent you a message' : `sent you ${count} messages`,
        timeAgo: thread.timestamp || formatTimestamp(thread.updatedAt),
        timestamp: thread.updatedAt,
        unread: true,
        conversationId: thread.conversationId,
      };
    });

  const incomingRequestRows = incoming
    .filter((request) => request.from)
    .map((request) => ({
      id: `request-${request.id}`,
      type: 'message_request',
      actor: request.from,
      actorName: actorName(request.from),
      text: request.status === 'pending'
        ? 'sent you a message request'
        : `message request ${request.status}`,
      timeAgo: formatTimestamp(request.createdAt),
      timestamp: request.createdAt,
      unread: request.status === 'pending',
      requestId: request.id,
      status: request.status,
    }));

  const acceptedOutgoingRows = outgoing
    .filter((request) => request.status === 'accepted' && request.to)
    .map((request) => ({
      id: `accepted-${request.id}`,
      type: 'message_request_accepted',
      actor: request.to,
      actorName: actorName(request.to),
      text: 'accepted your message request',
      timeAgo: formatTimestamp(request.respondedAt || request.createdAt),
      timestamp: request.respondedAt || request.createdAt,
      unread: false,
      requestId: request.id,
      conversationId: request.conversationId || null,
    }));

  return [...messageRows, ...incomingRequestRows, ...acceptedOutgoingRows]
    .sort((a, b) => asTime(b.timestamp) - asTime(a.timestamp))
    .slice(0, 50);
}
