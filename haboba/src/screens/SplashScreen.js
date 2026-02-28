import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Image,
  Dimensions,
} from 'react-native';
import { FontFamily } from '../theme';
import LogoMark from '../components/LogoMark';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Keep splash/loading background aligned with onboarding/signup landing
const SPLASH_IMAGE = require('../assets/landing.jpeg');

export default function SplashScreen({ onFinish }) {
  const logoFade = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const blurFade = useRef(new Animated.Value(1)).current; // blurry layer starts visible
  const overlayFade = useRef(new Animated.Value(0.7)).current; // dark overlay starts strong

  useEffect(() => {
    // Phase 1: Logo fades in over blurry background
    Animated.parallel([
      Animated.timing(logoFade, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Phase 2: Blur clears, overlay lightens (photo revealed)
    const revealTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(blurFade, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(overlayFade, {
          toValue: 0.35,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]).start();
    }, 800);

    // Phase 3: Everything fades out, transition to app
    const finishTimer = setTimeout(() => {
      Animated.timing(logoFade, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => onFinish?.());
    }, 3000);

    return () => {
      clearTimeout(revealTimer);
      clearTimeout(finishTimer);
    };
  }, [logoFade, logoScale, blurFade, overlayFade, onFinish]);

  return (
    <View style={styles.container}>
      {/* Layer 1: Clear(ish) background photo */}
      <Image
        source={SPLASH_IMAGE}
        style={styles.backgroundImage}
        blurRadius={3}
      />

      {/* Layer 2: Heavily blurred version — fades out to reveal clear photo */}
      <Animated.Image
        source={SPLASH_IMAGE}
        style={[styles.backgroundImage, { opacity: blurFade }]}
        blurRadius={50}
      />

      {/* Layer 3: Dark overlay for contrast */}
      <Animated.View style={[styles.overlay, { opacity: overlayFade }]} />

      {/* Logo + tagline */}
      <Animated.View
        style={[
          styles.logoWrapper,
          { opacity: logoFade, transform: [{ scale: logoScale }] },
        ]}
      >
        <LogoMark size={180} light />
      </Animated.View>

      {/* Bottom tagline */}
      <Animated.View style={[styles.bottomSection, { opacity: logoFade }]}>
        <Text style={styles.tagline}>Connect with your people</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1612',
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_W,
    height: SCREEN_H,
    resizeMode: 'cover',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: '#1A1612',
  },
  logoWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSection: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tagline: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    letterSpacing: 2,
    fontWeight: '500',
    fontFamily: FontFamily.medium,
  },
});
