import React, { useState, useCallback, useMemo, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';

import { ThemeProvider, useTheme, fontAssets } from './src/theme';
import { AccessibilityPreferencesProvider } from './src/accessibility';
import { SubscriptionProvider } from './src/payments';
import { AuthProvider, useAuth } from './src/auth';
import AppNavigator from './src/navigation/AppNavigator';
import SplashScreen from './src/screens/SplashScreen';
import ScreenshotGuard from './src/components/ScreenshotGuard';
import OfflineBanner from './src/components/OfflineBanner';
import IncomingCallOverlay from './src/components/IncomingCallOverlay';
import { NetworkProvider } from './src/utils/useNetworkStatus';
import { useNotifications } from './src/utils/useNotifications';
import { useIncomingCall } from './src/api/hooks/useIncomingCall';
import { migrateLegacyStorageKeys } from './src/utils/migrateLegacyKeys';
import { useAppStateRefresh } from './src/utils/useAppStateRefresh';
import { useSubscription } from './src/payments';
import * as Linking from 'expo-linking';

// Deep-link map. Reachable as `junubin://<path>` (custom scheme set in
// app.config.js → expo.scheme) and `https://junubin.app/<path>` (web /
// universal links). Routes are minimal on purpose — every path here is
// load-bearing for either a push notification or an external link the
// app advertises.
//
//   junubin://survey                 → ProfileSetup at next incomplete
//   junubin://survey?step=interests  → ProfileSetup at a named step
//   junubin://chat/:matchId          → ChatScreen with that match
//   junubin://live/:hostId           → LiveView for that host
//   junubin://event/:eventId         → EventDetail
//
// The ProfileSetup screen reads `route.params.resumeAt` (which the URL
// query param maps to via `parse`).
const DEEP_LINK_PREFIX = Linking.createURL('/');
const linkingConfig = {
  prefixes: [DEEP_LINK_PREFIX, 'junubin://', 'https://junubin.app'],
  config: {
    screens: {
      ProfileSetup:       { path: 'survey', parse: { step: (s) => s } },
      AccessibilitySurvey: 'accessibility-survey',
      Chat:               { path: 'chat/:conversationId' },
      LiveView:           { path: 'live/:hostId' },
      EventDetail:        { path: 'event/:eventId' },
      Main: {
        screens: {
          HomeTab:      'home',
          CommunityTab: 'community',
          LikesTab:     'likes',
          MessagesTab:  'messages',
        },
      },
    },
  },
};

import ErrorBoundary from './src/components/ErrorBoundary';

function AppInner() {
  const { colors, isDark } = useTheme();
  const { ready: authReady, isAuthenticated, user, refreshUser } = useAuth();
  const { refreshServerState } = useSubscription();
  const [showSplash, setShowSplash] = useState(true);
  const navigationRef = useRef(null);
  // Push notification deep-linking
  useNotifications(navigationRef);

  // Multi-device staleness fix: when the app returns from background
  // after >60s, re-fetch the User row (catches profile edits made on
  // another device, moderation status changes, etc.) and the
  // subscription state (catches tier upgrades + consumable top-ups
  // made on web). Cheap because both calls are single-row reads, and
  // gated on a real idle threshold so quick context-switches don't
  // hit the network.
  useAppStateRefresh(() => {
    if (!isAuthenticated) return;
    refreshUser?.().catch(() => {});
    refreshServerState?.().catch(() => {});
  });

  // App-level incoming-call listener — surfaces the overlay regardless of
  // which tab the receiver is currently on.
  const { incoming, accept, decline } = useIncomingCall(user?.id);
  const handleAccept = useCallback(() => {
    const accepted = accept();
    if (accepted) {
      navigationRef.current?.navigate?.('Call', {
        match: accepted.caller,
        callType: accepted.callType,
        callId: accepted.callId,
        direction: 'incoming',
      });
    }
  }, [accept]);

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
      <IncomingCallOverlay
        visible={!!incoming}
        caller={incoming?.caller}
        onAccept={handleAccept}
        onDecline={decline}
      />
    </NavigationContainer>
  );
}

// Kicked off at module load so the rename is in flight before React mounts;
// providers that read AsyncStorage (SubscriptionProvider, ThemeContext, etc.)
// only run inside <App>, which we gate on `migrationReady`.
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
        <ActivityIndicator size="large" color="#FCCD12" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.container}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AccessibilityPreferencesProvider>
              <SubscriptionProvider>
                <AuthProvider>
                  <NetworkProvider>
                    <ScreenshotGuard>
                      <AppInner />
                    </ScreenshotGuard>
                  </NetworkProvider>
                </AuthProvider>
              </SubscriptionProvider>
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
    backgroundColor: '#060606',
  },
});
