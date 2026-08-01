import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Image,
  ActivityIndicator,
} from 'react-native';

const SPLASH_IMAGE = require('../../assets/splash.png');

export default function SplashScreen({ onFinish, authReady }) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.98)).current;
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
      Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 520, useNativeDriver: true }),
    ]).start();

    // Min display time so the entrance animation reads, but tight enough
    // not to hold the user back when auth resolves quickly.
    const timer = setTimeout(() => { animDone.current = true; tryFinish(); }, 600);
    return () => clearTimeout(timer);
  }, [fade, scale, tryFinish]);

  return (
    <View style={s.root}>
      <Animated.View style={[s.logoWrap, { opacity: fade, transform: [{ scale }] }]}>
        <Image source={SPLASH_IMAGE} style={s.logo} resizeMode="contain" />
      </Animated.View>
      <ActivityIndicator size="small" color="rgba(255,255,255,0.62)" style={s.loader} />

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
  logoWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  loader: {
    position: 'absolute',
    bottom: 84,
  },
  hidden: { position: 'absolute', opacity: 0, height: 0 },
});
