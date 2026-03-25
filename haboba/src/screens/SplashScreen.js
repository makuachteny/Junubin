import React, { useEffect, useRef, useCallback } from 'react';
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
import { SpraySplatter } from '../components/GraffitiAccents';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const SPLASH_IMAGE = require('../assets/landing.jpeg');

export default function SplashScreen({ onFinish, authReady }) {
  const logoFade = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const blurFade = useRef(new Animated.Value(1)).current;
  const overlayFade = useRef(new Animated.Value(0.7)).current;
  const animDone = useRef(false);
  const hasFinished = useRef(false);

  const tryFinish = useCallback(() => {
    if (animDone.current && authReady && !hasFinished.current) {
      hasFinished.current = true;
      // Fade out then hand off
      Animated.timing(logoFade, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => onFinish?.());
    }
  }, [authReady, logoFade, onFinish]);

  // When auth becomes ready after animation, finish immediately
  useEffect(() => {
    tryFinish();
  }, [tryFinish]);

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

    // Phase 3: Minimum animation time reached — try to finish
    const minTimer = setTimeout(() => {
      animDone.current = true;
      tryFinish();
    }, 2500);

    return () => {
      clearTimeout(revealTimer);
      clearTimeout(minTimer);
    };
  }, [logoFade, logoScale, blurFade, overlayFade, tryFinish]);

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
        <LogoMark size={180} light animated />
      </Animated.View>

      {/* Spray accents — decorative */}
      <Animated.View style={[styles.splatterTopRight, { opacity: logoFade }]} pointerEvents="none">
        <SpraySplatter size={60} color="#009739" opacity={0.1} />
      </Animated.View>
      <Animated.View style={[styles.splatterBottomLeft, { opacity: logoFade }]} pointerEvents="none">
        <SpraySplatter size={50} color="#CE1126" opacity={0.08} />
      </Animated.View>

      {/* Bottom tagline + flag accent */}
      <Animated.View style={[styles.bottomSection, { opacity: logoFade }]}>

        <Text style={styles.tagline}>Connect with your people</Text>
        {/* South Sudan flag stripe */}
        <View style={styles.flagStripe}>
          <View style={[styles.flagBand, { backgroundColor: '#000000' }]} />
          <View style={[styles.flagBand, { backgroundColor: '#CE1126' }]} />
          <View style={[styles.flagBand, { backgroundColor: '#FFFFFF' }]} />
          <View style={[styles.flagBand, { backgroundColor: '#009739' }]} />
          <View style={[styles.flagBand, { backgroundColor: '#0047AB' }]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
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
    backgroundColor: '#000000',
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
  flagStripe: {
    flexDirection: 'row',
    height: 3,
    width: 120,
    marginTop: 16,
    borderRadius: 2,
    overflow: 'hidden',
    opacity: 0.6,
  },
  flagBand: {
    flex: 1,
    height: 3,
  },
  splatterTopRight: {
    position: 'absolute',
    top: 80,
    right: 10,
  },
  splatterBottomLeft: {
    position: 'absolute',
    bottom: 140,
    left: 10,
  },
});
