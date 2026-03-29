// AnaJunubin — Screenshot Guard Wrapper
// Wraps the app; prevents screen capture and shows a warning overlay on screenshot attempts.

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { Ionicons } from '@expo/vector-icons';

export default function ScreenshotGuard({ children }) {
  const [showWarning, setShowWarning] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Skip screenshot protection in dev mode (Expo Go doesn't support it reliably)
    if (__DEV__) return;

    // Prevent screen capture globally
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});

    // Listen for screenshot attempts
    const subscription = ScreenCapture.addScreenshotListener(() => {
      setShowWarning(true);
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2000),
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => setShowWarning(false));
    });

    return () => {
      subscription.remove();
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
    };
  }, [opacity]);

  return (
    <View style={styles.container}>
      {children}
      {showWarning && (
        <Animated.View style={[styles.overlay, { opacity }]} pointerEvents="none">
          <View style={styles.badge}>
            <Ionicons name="shield-checkmark" size={28} color="#CE1126" />
            <Text style={styles.text}>Screenshots are not allowed</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 9999,
  },
  badge: {
    backgroundColor: '#000000',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(168,13,30,0.3)',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
