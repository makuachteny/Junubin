// AnaJunubin — Push Notifications Hook
import { useEffect, useRef } from 'react';
import {
  registerForPushNotifications,
  addNotificationResponseListener,
  addNotificationReceivedListener,
} from './notifications';

export function useNotifications(navigationRef, isAuthenticated = true) {
  const responseListenerRef = useRef(null);
  const notificationListenerRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      return () => {};
    }
    // Register on mount
    registerForPushNotifications().catch(() => {});

    // Handle notification taps → deep link
    //
    // The server-side push payload shape (00013_push_triggers.sql) is:
    //
    //   { type: 'match',   matchId, peerId }
    //   { type: 'message', conversationId, messageId, senderId }
    //   { type: 'like'   }   (LikesTab; no extra context needed)
    //
    // The old handler read `data.match` for both message + match taps,
    // which was always undefined — ChatScreen then mounted with no
    // route.params.match and no conversationId, and crashed on the
    // first `match.id` access. Now we route off the actual payload:
    //
    //   - 'message' → Chat with conversationId. ChatScreen pulls
    //                 the match data from getMatches() once it has
    //                 the conversationId.
    //   - 'match'   → Messages tab. The new match floats to the top
    //                 (current-mode sort) and the user can tap to
    //                 open. We don't open Chat directly because the
    //                 payload doesn't carry a conversationId — only
    //                 matchId — and one extra tap is cheaper than a
    //                 cold-start round trip to resolve it.
    responseListenerRef.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data || {};
      const nav = navigationRef?.current;
      if (!nav) return;

      switch (data.type) {
        case 'message':
          if (data.conversationId) {
            nav.navigate('Chat', { conversationId: data.conversationId });
          } else {
            nav.navigate('Main', { screen: 'MessagesTab' });
          }
          break;
        // Requests live inside the Chats tab now (Requests segment) —
        // the standalone MessageRequests screen went with the redesign.
        case 'message_request':
        case 'message_request_accepted':
          nav.navigate('Main', { screen: 'MessagesTab' });
          break;
        case 'follow':
          nav.navigate('Notifications');
          break;
        // Legacy push types from the dating build. The Likes and
        // Community tabs no longer exist, so rather than navigating to
        // a route that would throw, land these on the inbox — the
        // nearest surface that still makes sense. Server-side push
        // templates should stop emitting them.
        case 'like':
        case 'match':
        case 'community':
          nav.navigate('Main', { screen: 'MessagesTab' });
          break;
        default:
          break;
      }
    });

    // Handle notifications received while app is open
    notificationListenerRef.current = addNotificationReceivedListener(() => {
      // Could show in-app banner here
    });

    return () => {
      responseListenerRef.current?.remove();
      notificationListenerRef.current?.remove();
    };
  }, [navigationRef, isAuthenticated]);
}
