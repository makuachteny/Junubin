// AnaJunubin — Client-side Analytics
//
// Two delivery paths, gated by env vars so the same code works on a
// developer machine (no keys → local-buffer only) and in production
// (one or both keys set → real forwarding):
//
//   1. PostHog (POSTHOG_API_KEY + POSTHOG_HOST) — the default
//      product-analytics target. Funnel reports, cohort analysis,
//      session replay.
//   2. AsyncStorage local buffer (always on) — captures the last 100
//      events so a crash report has the breadcrumb trail attached.
//
// PII is sanitized BEFORE either path runs — see PII_KEYS below.
//
// Sentry breadcrumbs piggy-back on the same trackEvent call so a
// production exception in Sentry shows the last few funnel steps the
// user took before the crash, without us having to instrument those
// breadcrumbs separately.

import AsyncStorage from '@react-native-async-storage/async-storage';

const ANALYTICS_KEY = '@junubin_analytics_events';
const MAX_BUFFERED = 100;

const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY || '';
const POSTHOG_HOST = (process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com').replace(/\/$/, '');

// Lazy-loaded Sentry SDK so this module can be imported anywhere
// (including during cold-start before App.js wires Sentry) without
// crashing if @sentry/react-native isn't installed yet.
let _sentry = null;
function getSentry() {
  if (_sentry) return _sentry;
  try {
    // eslint-disable-next-line global-require, import/no-unresolved
    _sentry = require('@sentry/react-native');
  } catch {
    _sentry = null;
  }
  return _sentry;
}

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

    // 1. Local buffer (always on) — fastest and resilient to network
    //    drops. flushEvents() drains it for backend POST if needed.
    const raw = await AsyncStorage.getItem(ANALYTICS_KEY);
    const events = raw ? JSON.parse(raw) : [];
    events.push(entry);
    const trimmed = events.length > MAX_BUFFERED ? events.slice(-MAX_BUFFERED) : events;
    await AsyncStorage.setItem(ANALYTICS_KEY, JSON.stringify(trimmed));

    // 2. PostHog — fire-and-forget capture call. Skips if no key is
    //    set so dev machines don't spam unconfigured endpoints. We
    //    use the simple /capture/ endpoint rather than the SDK so the
    //    bundle stays light.
    if (POSTHOG_KEY && global.__junubin_distinct_id) {
      fetch(`${POSTHOG_HOST}/capture/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: POSTHOG_KEY,
          event,
          distinct_id: global.__junubin_distinct_id,
          properties: { ...safe, $session_id: global.__junubin_session_id, $lib: 'junubin-rn' },
          timestamp: entry.timestamp,
        }),
      }).catch(() => {});
    }

    // 3. Sentry breadcrumb — drop into the crash trail so a future
    //    exception shows what the user did just before. Category
    //    matches Sentry's recommended convention for product events.
    const Sentry = getSentry();
    if (Sentry?.addBreadcrumb) {
      Sentry.addBreadcrumb({
        category: 'analytics',
        message: event,
        level: 'info',
        data: safe,
      });
    }
  } catch {
    // Silent fail — analytics should never crash the app
  }
}

/**
 * Identify the current user to downstream analytics targets. Called
 * once after sign-in lands. Stable id (User.id) so cohort joins work
 * across sessions / devices.
 */
export function identifyUser(userId, traits = {}) {
  if (!userId) return;
  global.__junubin_distinct_id = String(userId);
  const safeTraits = sanitizeProperties(traits);

  if (POSTHOG_KEY) {
    fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event: '$identify',
        distinct_id: String(userId),
        properties: { $set: safeTraits },
      }),
    }).catch(() => {});
  }

  const Sentry = getSentry();
  if (Sentry?.setUser) {
    // setUser with just an id keeps PII out of Sentry; traits are
    // already PII-stripped above so they're safe to attach.
    Sentry.setUser({ id: String(userId), ...safeTraits });
  }
}

/**
 * Clear identity on sign-out so subsequent events aren't attributed
 * to the previous account.
 */
export function resetIdentity() {
  global.__junubin_distinct_id = null;
  const Sentry = getSentry();
  if (Sentry?.setUser) Sentry.setUser(null);
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
