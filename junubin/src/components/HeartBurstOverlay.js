// AnaJunubin — Heart Burst Overlay
// Instagram-style double-tap heart animation with burst particles.

import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { GraffitiHeart } from './icons';
import { Colors } from '../theme';

const MINI_HEARTS = [
  { angle: 0, dist: 50 },
  { angle: 60, dist: 45 },
  { angle: 120, dist: 50 },
  { angle: 180, dist: 45 },
  { angle: 240, dist: 50 },
  { angle: 300, dist: 45 },
];

function MiniHeart({ angle, dist, color }) {
  const progress = useSharedValue(0);
  const rad = (angle * Math.PI) / 180;
  const tx = Math.cos(rad) * dist;
  const ty = Math.sin(rad) * dist;

  useEffect(() => {
    progress.value = withDelay(
      100,
      withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) })
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value < 0.8 ? progress.value : 1 - (progress.value - 0.8) * 5,
    transform: [
      { translateX: progress.value * tx },
      { translateY: progress.value * ty },
      { scale: 0.5 + progress.value * 0.5 },
    ],
  }));

  return (
    <Animated.View style={[styles.miniHeart, style]}>
      <GraffitiHeart size={14} color={color} filled />
    </Animated.View>
  );
}

export default function HeartBurstOverlay({ x, y, onComplete, color = Colors.rose }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(1.3, { damping: 8, stiffness: 200 }, () => {
      scale.value = withSpring(1, { damping: 12, stiffness: 180 });
    });
    opacity.value = withDelay(
      600,
      withTiming(0, { duration: 200 }, (finished) => {
        if (finished && onComplete) runOnJS(onComplete)();
      })
    );
  }, []);

  const heartStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[styles.container, { left: x - 30, top: y - 30 }]}
      pointerEvents="none"
    >
      <Animated.View style={heartStyle}>
        <GraffitiHeart size={60} color={color} filled />
      </Animated.View>
      {MINI_HEARTS.map((h, i) => (
        <MiniHeart key={i} angle={h.angle} dist={h.dist} color={color} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  miniHeart: {
    position: 'absolute',
  },
});
