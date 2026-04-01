import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontFamily } from '../theme';
import LogoMark from '../components/LogoMark';

const { width: W, height: H } = Dimensions.get('window');

export default function SplashScreen({ onFinish, authReady }) {
  const logoFade = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.7)).current;
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
    // Logo entrance
    Animated.parallel([
      Animated.timing(logoFade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
    ]).start();

    // Flag bar grows
    Animated.timing(flagW, {
      toValue: W, duration: 1800, delay: 400, useNativeDriver: false,
    }).start();

    // Min time
    const timer = setTimeout(() => { animDone.current = true; tryFinish(); }, 2200);
    return () => clearTimeout(timer);
  }, [logoFade, logoScale, flagW, tryFinish]);

  return (
    <View style={s.root}>
      <LinearGradient colors={['#060606', '#080606', '#060608']} style={StyleSheet.absoluteFill} />

      {/* Gold glow */}
      <View style={s.glow}>
        <LinearGradient
          colors={['rgba(252,205,18,0.05)', 'transparent']}
          style={s.glowCircle}
          start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}
        />
      </View>

      {/* Logo */}
      <Animated.View style={[s.center, { opacity: logoFade, transform: [{ scale: logoScale }] }]}>
        <LogoMark size={120} light />
        <View style={{ height: 20 }} />
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
  root: { flex: 1, backgroundColor: '#060606' },
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  glow: {
    position: 'absolute', top: H * 0.25,
    left: W * 0.15, right: W * 0.15,
  },
  glowCircle: {
    width: W * 0.7, height: W * 0.7, borderRadius: W * 0.35,
  },
  tagline: {
    fontSize: 12, fontFamily: FontFamily.medium, fontWeight: '500',
    color: 'rgba(255,255,255,0.25)', letterSpacing: 2, textTransform: 'uppercase',
  },
  flagBar: {
    position: 'absolute', bottom: 0, left: 0,
    height: 3, overflow: 'hidden',
  },
  hidden: { position: 'absolute', opacity: 0, height: 0 },
});
