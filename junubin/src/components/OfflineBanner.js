// AnaJunubin — Offline Banner
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '../utils/useNetworkStatus';

export default function OfflineBanner() {
  const { isConnected } = useNetworkStatus();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-60)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isConnected ? -60 : 0,
      tension: 80,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [isConnected, slideAnim]);

  // Don't render at all when connected — expo-network is unreliable in Expo Go
  if (isConnected) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        { paddingTop: insets.top + 4, transform: [{ translateY: slideAnim }] },
      ]}
      pointerEvents="none"
    >
      <Ionicons name="cloud-offline" size={16} color="#FFFFFF" />
      <Text style={styles.text}>No internet connection</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#B4544C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 8,
    zIndex: 10000,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
