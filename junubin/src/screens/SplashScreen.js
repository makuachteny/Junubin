import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontFamily } from '../theme';
import LogoMark from '../components/LogoMark';

const { width: W, height: H } = Dimensions.get('window');
const LANDING_IMAGE = require('../assets/landing.jpeg');

export default function SplashScreen({ onFinish, authReady }) {
  const logoFade = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const bgZoom = useRef(new Animated.Value(1)).current;
  const flagW = useRef(new Animated.Value(0)).current;
  const animDone = useRef(false);
  const hasFinished = useRef(false);

  const tryFinish = useCallback(() => {
    if (animDone.current && authReady && !hasFinished.current) {
      hasFinished.current = true;
      Animated.timing(logoFade, {
        toValue: 0, duration: 350, useNativeDriver: true,
      }).start(() => onFinish?.());
    }
  }, [authReady, logoFade, onFinish]);

  useEffect(() => { tryFinish(); }, [tryFinish]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoFade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
    ]).start();

    Animated.timing(bgZoom, {
      toValue: 1.08, duration: 4000, useNativeDriver: true,
    }).start();

    Animated.timing(flagW, {
      toValue: W, duration: 900, delay: 200, useNativeDriver: false,
    }).start();

    // Min display time so the entrance animation reads, but tight enough
    // not to hold the user back when auth resolves quickly.
    const timer = setTimeout(() => { animDone.current = true; tryFinish(); }, 600);
    return () => clearTimeout(timer);
  }, [logoFade, logoScale, bgZoom, flagW, tryFinish]);

  return (
    <View style={s.root}>
      {/* Background image — South Sudanese ladies */}
      <Animated.View style={[s.bgWrap, { transform: [{ scale: bgZoom }] }]}>
        <Image source={LANDING_IMAGE} style={s.bgImage} resizeMode="cover" />
      </Animated.View>

      {/* Gradient overlay — fades photo to black at bottom for legibility */}
      <LinearGradient
        colors={[
          'rgba(0,0,0,0.25)',
          'rgba(0,0,0,0.10)',
          'rgba(0,0,0,0.55)',
          'rgba(0,0,0,0.92)',
          'rgba(0,0,0,0.98)',
        ]}
        locations={[0, 0.30, 0.62, 0.85, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Logo + tagline */}
      <Animated.View style={[s.center, { opacity: logoFade, transform: [{ scale: logoScale }] }]}>
        <LogoMark size={90} light />
        <View style={{ height: 12 }} />
        <Text style={s.tagline}>South Sudanese Community</Text>
      </Animated.View>

      {/* Flag bar — grows from left */}
      <Animated.View style={[s.flagBar, { width: flagW }]}>
        <LinearGradient
          colors={['#CE1126','#CE1126','#FCCD12','#009739','#0047AB']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Text testID="splash-greeting" style={s.hidden}>Welcome</Text>
      <Text testID="splash-tagline" style={s.hidden}>Connect with your people</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  bgWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  bgImage: {
    width: W * 1.2,
    height: H * 1.05,
    marginLeft: -(W * 0.1),
  },
  center: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: H * 0.18,
  },
  tagline: {
    fontSize: 12, fontFamily: FontFamily.medium, fontWeight: '500',
    color: 'rgba(255,255,255,0.55)', letterSpacing: 2.5, textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },
  flagBar: {
    position: 'absolute', bottom: 0, left: 0,
    height: 3, overflow: 'hidden',
  },
  hidden: { position: 'absolute', opacity: 0, height: 0 },
});
