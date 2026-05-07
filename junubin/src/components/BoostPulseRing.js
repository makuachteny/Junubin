// AnaJunubin — Boost Pulse Ring
// Concentric gold ring pulse animation for Spotlight screen.

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../theme';

const RING_COUNT = 3;
const CYCLE_MS = 2000;
const STAGGER_MS = 600;

function PulseRing({ delay, color }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: CYCLE_MS, easing: Easing.out(Easing.cubic) }),
        -1,
        false
      )
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: 0.6 * (1 - progress.value),
    transform: [{ scale: 1 + progress.value * 1.5 }],
    borderColor: color,
  }));

  return <Animated.View style={[styles.ring, style]} />;
}

export default function BoostPulseRing({ size = 120 }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { width: size * 2.5, height: size * 2.5 }]}>
      {Array.from({ length: RING_COUNT }).map((_, i) => (
        <PulseRing key={i} delay={i * STAGGER_MS} color={colors.accent} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: '60%',
    height: '60%',
    borderRadius: 999,
    borderWidth: 2,
  },
});
