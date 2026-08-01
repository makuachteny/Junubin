// ═══════════════════════════════════════════════════════════
// JuNubin — Welcome ("Industry" redesign, design.html Welcome screen)
// Full-bleed photo under a dark scrim; bottom-anchored flag mark +
// wordmark, 48pt condensed headline with the flag-gold accent span,
// Blueprint-framed gold CTA, and the 5-band flag stripe pinned to the
// very bottom edge. Hands off to the Signup screen (phone OTP).
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
import { FontFamily } from '../theme';
import Blueprint from '../components/Blueprint';
import { reportError } from '../utils/reportError';

const ONBOARDED_KEY = '@junubin_onboarded';
const markOnboarded = () =>
  AsyncStorage.setItem(ONBOARDED_KEY, 'true')
    .catch((err) => reportError('OnboardingScreen.markOnboarded', err));

const LANDING_IMAGE = require('../assets/landing.jpeg');

// This screen is fixed-dark regardless of theme (photo + scrim), so
// every color is a deliberate literal from the design mock rather than
// a theme token that flips in light mode.
const INK = {
  wordmark: '#FFFFFF',
  headline: '#FFFFFF',
  gold: '#F0B41F',
  sub: 'rgba(236,242,248,0.85)',
  caption: 'rgba(236,242,248,0.6)',
  ctaInk: '#241B03',
  frame: 'rgba(236,242,248,0.4)',
};

// Bottom flag stripe — the five bands of the South Sudan flag, in the
// design's exact order and hexes.
const STRIPE = ['#000000', '#D94A4A', '#F0B41F', '#0F9D58', '#0F8FD6'];

const OnboardingScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  // "Continue with phone" hands off to the Signup screen, which owns
  // the phone → OTP flow for both first-time sign-up and sign-in.
  const handleContinue = useCallback(() => {
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

      {/* ── Dark gradient scrim (design: .15 → .5 @42% → .98 @80%) ── */}
      <LinearGradient
        colors={[
          'rgba(20,33,46,0.15)',
          'rgba(20,33,46,0.5)',
          'rgba(14,24,34,0.98)',
        ]}
        locations={[0, 0.42, 0.8]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Bottom-anchored stack ── */}
      <View style={[s.stack, { paddingBottom: insets.bottom + 44 }]}>
        {/* Mini flag mark + letterspaced wordmark */}
        <View style={s.brandRow}>
          <View
            style={s.flagMark}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            <View style={[s.flagBand, { backgroundColor: '#111111' }]} />
            <View style={[s.flagBand, s.flagBandRed]} />
            <View style={[s.flagBand, { backgroundColor: '#1F9D55' }]} />
          </View>
          <Text style={s.wordmark} accessibilityRole="header">JUNUBIN</Text>
        </View>

        <Text style={s.headline}>
          Find your <Text style={s.headlineGold}>South Sudanese</Text> people.
        </Text>
        <Text style={s.sub}>
          Near you, or in the city you care about. Free — and not a dating app.
        </Text>

        <Blueprint borderColor={INK.frame} markColor={INK.frame}>
          <TouchableOpacity
            style={s.cta}
            onPress={handleContinue}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel="Continue with phone"
          >
            <Text style={s.ctaText}>CONTINUE WITH PHONE</Text>
          </TouchableOpacity>
        </Blueprint>

        <Text style={s.caption}>One-tap sign in. No passwords, ever.</Text>
      </View>

      {/* ── Flag stripe pinned to the very bottom edge ── */}
      <View style={s.stripe} pointerEvents="none">
        {STRIPE.map((c) => (
          <View key={c} style={{ flex: 1, backgroundColor: c }} />
        ))}
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

  // ── Brand row: tricolor mark + wordmark ──
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flagMark: {
    width: 26,
    height: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    flexDirection: 'column',
  },
  flagBand: { flex: 1 },
  flagBandRed: {
    backgroundColor: '#D64550',
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  wordmark: {
    fontFamily: FontFamily.heading,
    fontSize: 15,
    // design: letter-spacing .24em on 15px
    letterSpacing: 3.6,
    color: INK.wordmark,
  },

  headline: {
    fontFamily: FontFamily.headingBold,
    fontSize: 48,
    lineHeight: 48,
    color: INK.headline,
  },
  headlineGold: { color: INK.gold },
  sub: {
    fontFamily: FontFamily.regular,
    fontSize: 16,
    lineHeight: 24,
    color: INK.sub,
    maxWidth: 300,
    marginBottom: 8,
  },

  // ── CTA — gold on ink, condensed caps (design: 56px, .08em) ──
  cta: {
    height: 56,
    backgroundColor: INK.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: FontFamily.headingBold,
    fontSize: 19,
    letterSpacing: 1.5,
    color: INK.ctaInk,
  },
  caption: {
    fontFamily: FontFamily.regular,
    fontSize: 12.5,
    color: INK.caption,
    textAlign: 'center',
  },

  // ── Flag stripe ──
  stripe: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 5,
    flexDirection: 'row',
  },
});

export default OnboardingScreen;
