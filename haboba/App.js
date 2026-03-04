import React, { useState, useCallback, useMemo } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, ActivityIndicator, ImageBackground } from 'react-native';
import { useFonts } from 'expo-font';

import { ThemeProvider, useTheme, fontAssets } from './src/theme';
import { SubscriptionProvider } from './src/payments';
import { AuthProvider } from './src/auth';
import AppNavigator from './src/navigation/AppNavigator';
import SplashScreen from './src/screens/SplashScreen';

const LANDING_IMAGE = require('./src/assets/landing.jpeg');

function AppInner() {
  const { colors, isDark } = useTheme();
  const [showSplash, setShowSplash] = useState(true);

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
        <SplashScreen onFinish={handleSplashFinish} />
      </>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts(fontAssets);

  if (!fontsLoaded) {
    return (
      <ImageBackground source={LANDING_IMAGE} style={styles.loadingImage} resizeMode="cover">
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#C4956A" />
        </View>
      </ImageBackground>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SubscriptionProvider>
            <AuthProvider>
              <AppInner />
            </AuthProvider>
          </SubscriptionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingImage: {
    flex: 1,
  },
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(26,22,18,0.55)',
  },
});
