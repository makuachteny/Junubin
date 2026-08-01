// ── Crypto polyfill ────────────────────────────────────────────────
// MUST be the very first import. @supabase/supabase-js uses
// crypto.getRandomValues() during client init (for UUID generation +
// session token signing). Without this polyfill the Hermes JS engine
// throws inside an async queue on cold start, surfacing as a vague
// native crash ("Junubin crashed: queue") before App.js even renders.
// Don't move this below other imports — JS evaluates them top to
// bottom and Supabase resolves on first import of its config module.
import 'react-native-get-random-values';

// ── Sentry crash reporting (wired-but-dormant) ──────────────────────
// Gated on EXPO_PUBLIC_SENTRY_DSN so this wire-up is a no-op when the
// DSN is not set in EAS env vars. To activate:
//   1. `npm i @sentry/react-native` (config-plugin install rebuilds the native side)
//      `npx @sentry/wizard@latest -i reactNative`  (optional — auto-wires the plugin)
//   2. Set EXPO_PUBLIC_SENTRY_DSN in EAS env vars (`eas secret:create`)
// The require() is intentionally dynamic + try/catch so the bundle
// doesn't fail when @sentry/react-native isn't installed yet (e.g. on a
// developer machine that hasn't rebuilt the dev-client). We migrated
// off `sentry-expo` (deprecated 2023) — @sentry/react-native is the
// canonical SDK and works with Expo via its config plugin.
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (SENTRY_DSN) {
  try {
    // eslint-disable-next-line global-require, import/no-unresolved
    const Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn: SENTRY_DSN,
      debug: __DEV__,
      // Conservative tracing budget — bump once we see baseline volume.
      tracesSampleRate: 0.2,
      // Symbolicate JS frames; the post-install step uploads sourcemaps.
      enableAutoSessionTracking: true,
      // Don't ship PII to the dashboard by default — IP / username get
      // redacted unless a downstream consumer opts in with setUser.
      sendDefaultPii: false,
      environment: process.env.APP_VARIANT || 'development',
    });
  } catch (e) {
    if (__DEV__) console.warn('[Sentry] not initialised — @sentry/react-native is not installed.', e?.message);
  }
}

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, ActivityIndicator, Image } from 'react-native';
import { useFonts } from 'expo-font';

import { ThemeProvider, useTheme, fontAssets } from './src/theme';
import { AccessibilityPreferencesProvider } from './src/accessibility';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import SplashScreen from './src/screens/SplashScreen';
import ScreenshotGuard from './src/components/ScreenshotGuard';
import OfflineBanner from './src/components/OfflineBanner';
import { NetworkProvider } from './src/utils/useNetworkStatus';
import { useNotifications } from './src/utils/useNotifications';
import { migrateLegacyStorageKeys } from './src/utils/migrateLegacyKeys';
import { useAppStateRefresh } from './src/utils/useAppStateRefresh';
import * as Linking from 'expo-linking';
import * as pendingDeepLink from './src/utils/pendingDeepLink';

const SPLASH_IMAGE = require('./assets/splash.png');

// Deep-link map. Reachable as `junubin://<path>` (custom scheme set in
// app.config.js → expo.scheme) and `https://junubin.app/<path>` (web /
// universal links). Routes are minimal on purpose — every path here is
// load-bearing for either a push notification or an external link the
// app advertises.
//
//   junubin://survey                    → ProfileSetup at next incomplete
//   junubin://survey?step=interests     → ProfileSetup at a named step
//   junubin://chat/:conversationId      → ChatScreen for that conversation
//   junubin://message-requests          → pending message requests
//
// The ProfileSetup screen reads `route.params.resumeAt` (which the URL
// query param maps to via `parse`).
//
// The `live/` and `event/` paths were removed with the live-video and
// events features. Old links now fall through to the app's default
// route rather than resolving to a screen that no longer exists.
//
// Auth gate: paths under chat/, message-requests/, survey/ require an
// authenticated session. If one of those URLs arrives while the user
// is on the auth stack (cold-launched from a push notification while
// signed out), React Navigation can't resolve the route and the link
// is dropped. We work around this by:
//
//   1. `getInitialURL` defers auth-required URLs to AsyncStorage and
//      returns undefined so RN doesn't try to navigate yet.
//   2. `subscribe` does the same for URLs that arrive while running.
//   3. `AppNavigator` watches auth state and replays any pending URL
//      via `useLinkTo` after the session resolves.
const DEEP_LINK_PREFIX = Linking.createURL('/');

// Allowlist for the `step` query param on the `survey` deep link.
// Without this, a crafted URL like `junubin://survey?step=__proto__`
// (or any unknown string) would land as ProfileSetup's `resumeAt` and
// either no-op silently or, worse, surface in a step-key lookup that
// we extend later. Keep this in sync with RESUME_KEY_BY_ELIGIBILITY_ID
// in ProfileSetupScreen.js.
const ALLOWED_SURVEY_STEPS = new Set([
  // The redesign's five step keys…
  'name', 'openTo', 'city', 'background', 'photo',
  // …plus the eligibility ids that still resolve onto them.
  'purpose', 'displayName', 'dob', 'gender', 'photos', 'bio',
]);
const sanitizeSurveyStep = (s) => {
  if (typeof s !== 'string') return undefined;
  return ALLOWED_SURVEY_STEPS.has(s) ? s : undefined;
};

const linkingConfig = {
  prefixes: [DEEP_LINK_PREFIX, 'junubin://', 'https://junubin.app'],
  config: {
    screens: {
      ProfileSetup:       { path: 'survey', parse: { step: sanitizeSurveyStep } },
      Chat:               { path: 'chat/:conversationId' },
      MessageRequests:    'message-requests',
      Main: {
        screens: {
          HomeTab:      'home',
          DirectoryTab: 'directory',
          MessagesTab:  'messages',
        },
      },
    },
  },
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (!url) return undefined;
    if (pendingDeepLink.urlRequiresAuth(url)) {
      // Always defer auth-required URLs. AppNavigator's effect picks
      // them up as soon as the session is ready — at most one render
      // of latency for already-signed-in users.
      await pendingDeepLink.setPending(url);
      return undefined;
    }
    return url;
  },
  subscribe(listener) {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (pendingDeepLink.urlRequiresAuth(url)) {
        // Don't forward to RN; the consume effect will fire instead.
        pendingDeepLink.setPending(url).catch(() => {});
        return;
      }
      listener(url);
    });
    return () => sub.remove();
  },
};

import ErrorBoundary from './src/components/ErrorBoundary';

function AppInner() {
  const { colors, isDark } = useTheme();
  const { ready: authReady, isAuthenticated, user, refreshUser } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const navigationRef = useRef(null);
  // Push notification deep-linking — only register once the user is signed in,
  // otherwise we'd ask for push permission on the auth/splash stack.
  useNotifications(navigationRef, isAuthenticated);

  // Multi-device staleness fix: when the app returns from background
  // after >60s, re-fetch the User row (catches profile edits made on
  // another device, moderation status changes, etc.). Cheap because
  // the call is a single-row read, and
  // gated on a real idle threshold so quick context-switches don't
  // hit the network.
  useAppStateRefresh(() => {
    if (!isAuthenticated) return;
    refreshUser?.().catch(() => {});
  });

  // The app-level incoming-call listener and its overlay were removed
  // along with voice/video calling. Communication is text-only, so
  // there is nothing to surface here and no `Call` route to navigate to.

  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
  }, []);

  const navTheme = useMemo(() => ({
    ...(isDark ? DarkTheme : DefaultTheme),
    dark: isDark,
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      primary: colors.accent,
      background: colors.cream,
      card: colors.cardBg,
      text: colors.black,
      border: colors.cardBorder,
      notification: colors.rose,
    },
  }), [isDark, colors]);

  if (showSplash) {
    return (
      <>
        <StatusBar style="light" />
        <SplashScreen onFinish={handleSplashFinish} authReady={authReady} />
      </>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme} linking={linkingConfig}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
      <OfflineBanner />
    </NavigationContainer>
  );
}

// Kicked off at module load so the rename is in flight before React mounts;
// providers that read AsyncStorage only run inside <App>, which we gate
// on `migrationReady`.
const legacyMigrationPromise = migrateLegacyStorageKeys();

export default function App() {
  const [fontsLoaded] = useFonts(fontAssets);
  const [migrationReady, setMigrationReady] = useState(false);

  React.useEffect(() => {
    legacyMigrationPromise.finally(() => setMigrationReady(true));
  }, []);

  if (!fontsLoaded || !migrationReady) {
    return (
      <View style={styles.loadingScreen}>
        <Image source={SPLASH_IMAGE} style={styles.loadingLogo} resizeMode="contain" />
        <ActivityIndicator size="small" color="rgba(255,255,255,0.62)" style={styles.loadingSpinner} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AccessibilityPreferencesProvider>
              <AuthProvider>
                <NetworkProvider>
                  <ScreenshotGuard>
                    <AppInner />
                  </ScreenshotGuard>
                </NetworkProvider>
              </AuthProvider>
            </AccessibilityPreferencesProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingLogo: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  loadingSpinner: {
    position: 'absolute',
    bottom: 84,
  },
});
