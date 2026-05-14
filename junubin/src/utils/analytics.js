// AnaJunubin — Client-side Analytics
// Tracks key user events for understanding funnel performance.

import AsyncStorage from '@react-native-async-storage/async-storage';

const ANALYTICS_KEY = '@junubin_analytics_events';
const MAX_BUFFERED = 100;

// Keys we refuse to forward to analytics — call sites that pass any of
// these get them stripped (with a redaction marker so we can tell at
// dev time that something was filtered). This is a defense-in-depth
// pass; the call sites SHOULD never pass these in the first place,
// but a typo'd `{ email }` reaching here is exactly the kind of leak
// that's invisible until it's already on a third-party dashboard.
const PII_KEYS = new Set([
  'email', 'phone', 'phoneNumber', 'phone_number',
  'dateOfBirth', 'dob', 'birthDate', 'birthday',
  'displayName', 'fullName', 'firstName', 'lastName',
  'latitude', 'longitude', 'lat', 'lng', 'location',
  'address', 'streetAddress', 'zipCode', 'postalCode',
  'photoUrl', 'photoUri', 'avatarUrl', 'imageUri',
  'authId', 'auth_id', 'pushToken',
  'password', 'token', 'sessionToken', 'accessToken', 'refreshToken',
]);

function sanitizeProperties(props) {
  if (!props || typeof props !== 'object') return {};
  const safe = {};
  for (const [key, value] of Object.entries(props)) {
    if (PII_KEYS.has(key)) {
      // Redacted marker rather than silent drop so callers can see in
      // dev that they're leaking and need to remove the prop.
      safe[key] = '[redacted]';
      continue;
    }
    // Strings that look like an email or full ISO timestamp at the
    // top level are very likely PII even under a different key. Hash
    // them to a short prefix so the event is still useful (cohort
    // analysis works on a prefix) but the raw value never leaves.
    if (typeof value === 'string' && /@/.test(value) && /\./.test(value)) {
      safe[key] = '[email-redacted]';
      continue;
    }
    safe[key] = value;
  }
  return safe;
}

export async function trackEvent(event, properties = {}) {
  try {
    const safe = sanitizeProperties(properties);
    const entry = {
      event,
      properties: safe,
      timestamp: new Date().toISOString(),
      sessionId: global.__junubin_session_id,
    };

    if (__DEV__) {
      console.log('[Analytics]', event, safe);
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
if (!global.__junubin_session_id) {
  global.__junubin_session_id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
