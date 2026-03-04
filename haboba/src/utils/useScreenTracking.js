// AnaJunubin — Screen Tracking Hook
import { useRef, useCallback } from 'react';
import { trackScreen } from './analytics';

export function useScreenTracking() {
  const routeNameRef = useRef(null);

  const onStateChange = useCallback((state) => {
    const currentRoute = getActiveRouteName(state);
    if (currentRoute && currentRoute !== routeNameRef.current) {
      routeNameRef.current = currentRoute;
      trackScreen(currentRoute);
    }
  }, []);

  return { onStateChange };
}

function getActiveRouteName(state) {
  if (!state) return null;
  const route = state.routes[state.index];
  if (route.state) return getActiveRouteName(route.state);
  return route.name;
}
