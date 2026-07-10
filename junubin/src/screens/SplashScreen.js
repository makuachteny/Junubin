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

const { width: W } = Dimensions.get('window');

export default function SplashScreen({ onFinish, authReady }) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.86)).current;
  const flagW = useRef(new Animated.Value(0)).current;
  const animDone = useRef(false);
  const hasFinished = useRef(false);

  const tryFinish = useCallback(() => {
    if (animDone.current && authReady && !hasFinished.current) {
      hasFinished.current = true;
      Animated.timing(fade, {
        toValue: 0, duration: 350, useNativeDriver: true,
      }).start(() => onFinish?.());
    }
  }, [authReady, fade, onFinish]);

  useEffect(() => { tryFinish(); }, [tryFinish]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }),
    ]).start();

    Animated.timing(flagW, {
      toValue: W, duration: 900, delay: 200, useNativeDriver: false,
    }).start();

    // Min display time so the entrance animation reads, but tight enough
    // not to hold the user back when auth resolves quickly.
    const timer = setTimeout(() => { animDone.current = true; tryFinish(); }, 600);
    return () => clearTimeout(timer);
  }, [fade, scale, flagW, tryFinish]);

  return (
    <View style={s.root}>
      {/* Centered lockup — Instagram-style: framed icon, wordmark, tagline */}
      <Animated.View style={[s.center, { opacity: fade, transform: [{ scale }] }]}>
        <View style={s.logoFrame}>
          <LogoMark size={96} light />
        </View>
        <Text style={s.wordmark}>JuNubin</Text>
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
  root: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Rounded white-bordered tile holding the JB mark — matches the app icon
  // language (black square, white JB) but framed so it reads as a polished
  // brand badge rather than a bare cutout.
  logoFrame: {
    width: 148,
    height: 148,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  wordmark: {
    fontSize: 36,
    fontFamily: FontFamily.extrabold || FontFamily.bold,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  flagBar: {
    position: 'absolute', bottom: 0, left: 0,
    height: 3, overflow: 'hidden',
  },
  hidden: { position: 'absolute', opacity: 0, height: 0 },
});
