// AnaJunubin — Online Pulse Dot
// Breathing green dot animation for online status.

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme, Colors } from '../theme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

export default function OnlinePulseDot({ size = 14, style }) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.success,
          borderColor: colors.surface,
        },
        animStyle,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
});
