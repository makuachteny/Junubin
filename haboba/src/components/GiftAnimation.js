// AnaJunubin — Gift Animation Overlay (particle effect)
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');
const PARTICLE_COUNT = 12;

export default function GiftAnimation({ gift, onComplete }) {
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }).map(() => ({
      x: new Animated.Value(W / 2),
      y: new Animated.Value(H / 2),
      opacity: new Animated.Value(1),
      scale: new Animated.Value(0),
    }))
  ).current;

  const mainScale = useRef(new Animated.Value(0)).current;
  const mainOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate main emoji
    Animated.sequence([
      Animated.parallel([
        Animated.spring(mainScale, { toValue: 1.5, tension: 50, friction: 5, useNativeDriver: true }),
        Animated.timing(mainOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      Animated.delay(600),
      Animated.parallel([
        Animated.timing(mainScale, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(mainOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
    ]).start(() => onComplete?.());

    // Animate particles
    particles.forEach((p, i) => {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      const distance = 80 + Math.random() * 60;
      const targetX = W / 2 + Math.cos(angle) * distance;
      const targetY = H / 2 + Math.sin(angle) * distance - 100;

      Animated.sequence([
        Animated.delay(200 + i * 30),
        Animated.parallel([
          Animated.spring(p.scale, { toValue: 1, tension: 60, friction: 6, useNativeDriver: true }),
          Animated.timing(p.x, { toValue: targetX, duration: 600, useNativeDriver: true }),
          Animated.timing(p.y, { toValue: targetY, duration: 600, useNativeDriver: true }),
        ]),
        Animated.timing(p.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  return (
    <View style={styles.overlay} pointerEvents="none">
      {/* Main gift emoji */}
      <Animated.Text
        style={[
          styles.mainEmoji,
          { opacity: mainOpacity, transform: [{ scale: mainScale }] },
        ]}
      >
        {gift?.emoji}
      </Animated.Text>

      {/* Particles */}
      {particles.map((p, i) => (
        <Animated.Text
          key={i}
          style={[
            styles.particle,
            {
              opacity: p.opacity,
              transform: [
                { translateX: Animated.subtract(p.x, W / 2) },
                { translateY: Animated.subtract(p.y, H / 2) },
                { scale: p.scale },
              ],
            },
          ]}
        >
          {gift?.emoji}
        </Animated.Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9998,
  },
  mainEmoji: {
    fontSize: 72,
    position: 'absolute',
  },
  particle: {
    fontSize: 24,
    position: 'absolute',
  },
});
