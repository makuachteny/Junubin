// Deferred deep-link queue.
//
// React Navigation's `linking` config auto-routes incoming URLs to a
// matching screen — but if the user is on the auth stack (Onboarding /
// Signup / ProfileSetup) when a push notification arrives, the target
// route (e.g. Chat) doesn't exist in that stack and navigation fails
// silently. The user authenticates, lands on the home tab, and the
// link is gone.
//
// This module is the safety net: when an auth-required URL arrives,
// we stash it in AsyncStorage. After auth resolves, AppNavigator's
// `useEffect` consumes it and replays the navigation.
//
// Non-auth-required URLs (like `junubin://home`) bypass this entirely
// — React Navigation handles them normally.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@junubin/pending_deep_link_v1';

// Top-level paths that require an authenticated session. Keep this in
// sync with `linkingConfig.config.screens` in App.js. Anything not
// listed is considered safe to dispatch even when signed out.
const AUTH_REQUIRED_TOP_LEVEL = new Set([
  'chat',
  'live',
  'event',
  'survey',
  'accessibility-survey',
]);

const PROTOCOL_RE = /^junubin:\/\/(.+)$/i;
const HTTPS_RE = /^https?:\/\/junubin\.app\/(.+)$/i;

/**
 * Pull the path portion out of a junubin:// or https://junubin.app/
 * URL. Returns null if the URL doesn't match the expected prefixes.
 */
export function pathFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const m1 = url.match(PROTOCOL_RE);
  if (m1) return m1[1].split('?')[0].split('#')[0];
  const m2 = url.match(HTTPS_RE);
  if (m2) return m2[1].split('?')[0].split('#')[0];
  return null;
}

/**
 * True when this URL requires an authenticated session to resolve.
 * Used by App.js's linkingConfig to decide whether to defer the URL.
 */
export function urlRequiresAuth(url) {
  const path = pathFromUrl(url);
  if (!path) return false;
  const top = path.split('/')[0].toLowerCase();
  return AUTH_REQUIRED_TOP_LEVEL.has(top);
}

/**
 * Stash a URL for later replay. Idempotent — overwrites any previous
 * pending URL since the latest tap is what the user wants.
 */
export async function setPending(url) {
  if (!url) return;
  try { await AsyncStorage.setItem(KEY, url); } catch {}
}

/**
 * Read + delete the pending URL atomically (within the limits of
 * AsyncStorage's serial queue). Returns null if nothing is queued.
 */
export async function consumePending() {
  try {
    const url = await AsyncStorage.getItem(KEY);
    if (url) await AsyncStorage.removeItem(KEY);
    return url || null;
  } catch {
    return null;
  }
}

/**
 * Read without deleting. Used by AppNavigator to decide whether to
 * fire its consume effect; we call peek before consume to avoid
 * spurious AsyncStorage writes when there's nothing pending.
 */
export async function peekPending() {
  try {
    return (await AsyncStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
}

/**
 * Clear any pending link without dispatching it. Called on sign-out
 * so a new user doesn't inherit the previous user's pending tap.
 */
export async function clearPending() {
  try { await AsyncStorage.removeItem(KEY); } catch {}
}
