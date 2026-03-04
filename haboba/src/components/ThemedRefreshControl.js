// AnaJunubin — Themed Refresh Control
// Pull-to-refresh with spinning LogoMark.

import React, { useEffect } from 'react';
import { RefreshControl, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import LogoMark from './LogoMark';
import { useTheme } from '../theme';

export default function ThemedRefreshControl({ refreshing, onRefresh }) {
  const { colors } = useTheme();
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (refreshing) {
      rotation.value = 0;
      rotation.value = withRepeat(
        withTiming(360, { duration: 1000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      rotation.value = withTiming(0, { duration: 300 });
    }
  }, [refreshing]);

  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.accent}
      colors={[colors.accent]}
      progressBackgroundColor={colors.white}
    />
  );
}
