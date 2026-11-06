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
    // Route push taps from server payloads to the current product
    // surfaces: text chats, in-inbox message requests, and the
    // notifications feed.
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
          nav.navigate('Main', { screen: 'MessagesTab', params: { segment: 'requests' } });
          break;
        case 'message_request_accepted':
          if (data.conversationId) {
            nav.navigate('Chat', { conversationId: data.conversationId });
          } else {
            nav.navigate('Main', { screen: 'MessagesTab' });
          }
          break;
        case 'follow':
          nav.navigate('Notifications');
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
