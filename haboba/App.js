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
import { NetworkProvider } from './src/utils/useNetworkStatus';
import { useNotifications } from './src/utils/useNotifications';

import ErrorBoundary from './src/components/ErrorBoundary';

function AppInner() {
  const { colors, isDark } = useTheme();
  const { ready: authReady, isAuthenticated } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const navigationRef = useRef(null);
  // Push notification deep-linking
  useNotifications(navigationRef);

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
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
      <OfflineBanner />
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts(fontAssets);

  if (!fontsLoaded) {
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
