// AnaJunubin — Push Notifications Hook
import { useEffect, useRef } from 'react';
import {
  registerForPushNotifications,
  addNotificationResponseListener,
  addNotificationReceivedListener,
} from './notifications';

export function useNotifications(navigationRef) {
  const responseListenerRef = useRef(null);
  const notificationListenerRef = useRef(null);

  useEffect(() => {
    // Register on mount
    registerForPushNotifications().catch(() => {});

    // Handle notification taps → deep link
    responseListenerRef.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      const nav = navigationRef?.current;
      if (!nav) return;

      switch (data?.type) {
        case 'message':
          nav.navigate('Chat', { match: data.match });
          break;
        case 'like':
          nav.navigate('Main', { screen: 'LikesTab' });
          break;
        case 'match':
          nav.navigate('Chat', { match: data.match });
          break;
        case 'community':
          nav.navigate('Main', { screen: 'CommunityTab' });
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
  }, [navigationRef]);
}
