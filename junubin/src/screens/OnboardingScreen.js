// ═══════════════════════════════════════════════════════════
// JuNubin — Welcome / Landing ("Industry" redesign)
// Full-bleed photo under a dark scrim, bottom-anchored wordmark +
// headline + Blueprint-framed CTA. Hands off to the Signup screen.
// ═══════════════════════════════════════════════════════════

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontFamily, useTheme } from '../theme';
import Blueprint from '../components/Blueprint';
import { reportError } from '../utils/reportError';

const ONBOARDED_KEY = '@junubin_onboarded';
const markOnboarded = () =>
  AsyncStorage.setItem(ONBOARDED_KEY, 'true')
    .catch((err) => reportError('OnboardingScreen.markOnboarded', err));

const LANDING_IMAGE = require('../assets/landing.jpeg');

// This screen is fixed-dark regardless of theme (photo + scrim), so the
// text colors are deliberate literals from the mock rather than theme
// tokens that flip in light mode.
const INK = {
  wordmark: '#D6EBFF',
  headline: '#FFFFFF',
  sub: 'rgba(236,242,248,0.85)',
  caption: 'rgba(236,242,248,0.6)',
  ctaLabel: '#0D2038',
  frame: 'rgba(236,242,248,0.4)',
};

const OnboardingScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // "Get Started" hands off to the Signup screen, which handles both
  // first-time sign-up and existing-account sign-in (email + one-time
  // code). Skipping straight into the app via dev-bypass is gone now
  // that the auth flow is the entry point.
  const handleGetStarted = useCallback(() => {
    markOnboarded();
    navigation.navigate('Signup');
  }, [navigation]);

  return (
    <View style={s.root}>
      {/* ── Background image ── */}
      <Image
        source={LANDING_IMAGE}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />

      {/* ── Dark gradient scrim ── */}
      <LinearGradient
        colors={[
          'rgba(29,45,61,0.2)',
          'rgba(29,45,61,0.5)',
          'rgba(18,26,36,0.97)',
        ]}
        locations={[0, 0.45, 0.82]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Bottom-anchored stack ── */}
      <View style={[s.stack, { paddingBottom: insets.bottom + 28 }]}>
        <Text style={s.wordmark} accessibilityRole="header">JUNUBIN</Text>
        <Text style={s.headline}>Find your South Sudanese people.</Text>
        <Text style={s.sub}>
          Near you, or in the city you care about. Free — and not a dating app.
        </Text>

        <Blueprint style={s.ctaFrame} borderColor={INK.frame} markColor={INK.frame}>
          <TouchableOpacity
            style={[s.cta, { backgroundColor: colors.accent }]}
            onPress={handleGetStarted}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Get started"
          >
            <Text style={s.ctaText}>GET STARTED</Text>
          </TouchableOpacity>
        </Blueprint>

        <Text style={s.caption}>Sign in with a one-time email code. No passwords, ever.</Text>

        <Text style={s.terms}>
          By continuing, you agree to our{' '}
          <Text
            style={s.termsLink}
            accessibilityRole="link"
            onPress={() => navigation.navigate('SettingsInfo', { pageKey: 'terms' })}
          >
            Terms
          </Text>
          {' '}&{' '}
          <Text
            style={s.termsLink}
            accessibilityRole="link"
            onPress={() => navigation.navigate('SettingsInfo', { pageKey: 'privacy' })}
          >
            Privacy Policy
          </Text>
          . Screenshots and screen recording are blocked everywhere in JuNubin — content stays in the app.
        </Text>
      </View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#121A24' },

  // ── Bottom stack ──
  stack: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    gap: 14,
  },
  wordmark: {
    fontFamily: FontFamily.heading,
    fontSize: 15,
    letterSpacing: 6,
    color: INK.wordmark,
  },
  headline: {
    fontFamily: FontFamily.headingBold,
    fontSize: 46,
    lineHeight: 47,
    color: INK.headline,
  },
  sub: {
    fontFamily: FontFamily.regular,
    fontSize: 16,
    lineHeight: 24,
    color: INK.sub,
    maxWidth: 300,
    marginBottom: 8,
  },

  // ── CTA ──
  ctaFrame: { marginHorizontal: 6 },
  cta: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: FontFamily.heading,
    fontSize: 19,
    letterSpacing: 1,
    color: INK.ctaLabel,
  },
  caption: {
    fontFamily: FontFamily.regular,
    fontSize: 12.5,
    color: INK.caption,
    textAlign: 'center',
  },

  // ── Terms ──
  terms: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
  },
  termsLink: {
    fontFamily: FontFamily.semibold,
    color: 'rgba(255,255,255,0.6)',
    textDecorationLine: 'underline',
  },
});

export default OnboardingScreen;
