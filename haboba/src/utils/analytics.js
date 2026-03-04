// AnaJunubin — Analytics Wrapper
// Dev: console.log. Prod: queued in AsyncStorage for future SDK integration.

import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@haboba_analytics_queue';
const IS_DEV = __DEV__;

let userId = null;

export function identifyUser(id) {
  userId = id;
  if (IS_DEV) console.log('[Analytics] identify:', id);
}

export function resetUser() {
  userId = null;
  if (IS_DEV) console.log('[Analytics] reset user');
}

export function trackEvent(name, props = {}) {
  const event = { name, props: { ...props, userId }, timestamp: Date.now() };
  if (IS_DEV) {
    console.log('[Analytics] event:', name, props);
    return;
  }
  // Queue for future SDK
  AsyncStorage.getItem(QUEUE_KEY).then((raw) => {
    const queue = raw ? JSON.parse(raw) : [];
    queue.push(event);
    // Keep queue bounded
    if (queue.length > 500) queue.splice(0, queue.length - 500);
    AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }).catch(() => {});
}

export function trackScreen(name) {
  trackEvent('screen_view', { screen: name });
}

export async function flushQueue() {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    await AsyncStorage.removeItem(QUEUE_KEY);
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
