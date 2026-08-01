// JuNubin — Screenshot Guard Wrapper
// Prevents screen capture and locks the app behind a warning when a
// screenshot attempt is detected. The user must explicitly dismiss the
// lock to continue.

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { Ionicons } from '@expo/vector-icons';

export default function ScreenshotGuard({ children }) {
  const [locked, setLocked] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Skip in dev — Expo Go doesn't support preventScreenCaptureAsync reliably
    if (__DEV__) return;

    ScreenCapture.preventScreenCaptureAsync().catch(() => {});

    const subscription = ScreenCapture.addScreenshotListener(() => {
      setLocked(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      subscription.remove();
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
    };
  }, [opacity]);

  const dismiss = () => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setLocked(false));
  };

  return (
    <View style={styles.container}>
      {children}
      {locked && (
        <Animated.View
          style={[styles.overlay, { opacity }]}
          accessibilityViewIsModal
          accessibilityLabel="Screenshots are not allowed on JuNubin"
        >
          <View style={styles.card}>
            <View style={styles.iconRing}>
              <Ionicons name="lock-closed" size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>Screenshots are not allowed</Text>
            <Text style={styles.body}>
              To protect everyone's privacy, JuNubin blocks screen capture and recording.
              The app has been locked until you confirm you understand.
            </Text>
            <Text style={styles.policy}>
              Repeated attempts may result in account restrictions, per our Privacy Policy.
            </Text>
            <TouchableOpacity
              style={styles.btn}
              onPress={dismiss}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="I understand"
            >
              <Text style={styles.btnText}>I understand</Text>
            </TouchableOpacity>
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
    paddingHorizontal: 28,
    backgroundColor: 'rgba(6,6,8,0.96)',
    zIndex: 9999,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#141416',
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(206,17,38,0.35)',
  },
  iconRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#B4544C',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#B4544C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.2,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 12,
  },
  policy: {
    color: 'rgba(252,205,18,0.85)',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 22,
    fontStyle: 'italic',
  },
  btn: {
    width: '100%',
    backgroundColor: '#B4544C',
    paddingVertical: 14,
    borderRadius: 26,
    alignItems: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
