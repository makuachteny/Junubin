// AnaJunubin — Client-side Analytics
// Tracks key user events for understanding funnel performance.

import AsyncStorage from '@react-native-async-storage/async-storage';

const ANALYTICS_KEY = '@haboba_analytics_events';
const MAX_BUFFERED = 100;

export async function trackEvent(event, properties = {}) {
  try {
    const entry = {
      event,
      properties,
      timestamp: new Date().toISOString(),
      sessionId: global.__haboba_session_id,
    };

    if (__DEV__) {
      console.log('[Analytics]', event, properties);
    }

    // Buffer events locally
    const raw = await AsyncStorage.getItem(ANALYTICS_KEY);
    const events = raw ? JSON.parse(raw) : [];
    events.push(entry);

    // Keep only the latest events
    const trimmed = events.length > MAX_BUFFERED ? events.slice(-MAX_BUFFERED) : events;
    await AsyncStorage.setItem(ANALYTICS_KEY, JSON.stringify(trimmed));
  } catch {
    // Silent fail — analytics should never crash the app
  }
}

export async function flushEvents() {
  try {
    const raw = await AsyncStorage.getItem(ANALYTICS_KEY);
    if (!raw) return [];
    const events = JSON.parse(raw);
    await AsyncStorage.removeItem(ANALYTICS_KEY);
    return events;
  } catch {
    return [];
  }
}

// Initialize session ID
if (!global.__haboba_session_id) {
  global.__haboba_session_id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Common event names
export const AnalyticsEvents = {
  ONBOARDING_PAGE_VIEW: 'onboarding_page_view',
  ONBOARDING_SKIP: 'onboarding_skip',
  ONBOARDING_COMPLETE: 'onboarding_complete',
  SIGNUP_START: 'signup_start',
  SIGNUP_COMPLETE: 'signup_complete',
  PROFILE_SETUP_STEP: 'profile_setup_step',
  PROFILE_SETUP_COMPLETE: 'profile_setup_complete',
  SWIPE: 'swipe',
  MATCH: 'match',
  MESSAGE_SENT: 'message_sent',
  PROFILE_VIEW: 'profile_view',
};
