// ═══════════════════════════════════════════════════════════
// JuNubin — Welcome ("Industry" redesign, design.html Welcome screen)
// Full-bleed photo under a dark scrim; bottom-anchored flag mark +
// wordmark, 48pt condensed headline with the flag-gold accent span,
// and a Blueprint-framed gold CTA. Hands off to the Signup screen
// (phone OTP).
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
import SouthSudanFlagMark from '../components/SouthSudanFlagMark';
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

      {/* ── Bottom-anchored stack ──
          Design pads 44px off the screen edge; on a device with a home
          indicator the inset already accounts for most of that, so take
          whichever is larger rather than stacking them. */}
      <View style={[s.stack, { paddingBottom: Math.max(44, insets.bottom + 10) }]}>
        {/* South Sudan flag mark + letterspaced wordmark */}
        <View style={s.brandRow}>
          <SouthSudanFlagMark width={30} height={20} />
          <Text style={s.wordmark}>JUNUBIN</Text>
        </View>

        <Text style={s.headline} accessibilityRole="header">
          Find your <Text style={s.headlineGold}>South Sudanese</Text> people.
        </Text>
        <Text style={s.sub}>
          Near you, or in the city you care about. Free for the community.
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

  // ── Brand row: South Sudan flag mark + wordmark ──
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    // design: max-width 30ch — Barlow's digit advance is ~0.56em, so
    // 30ch ≈ 268pt at 16pt.
    maxWidth: 268,
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
    // design: letter-spacing .08em on 19px
    letterSpacing: 1.52,
    color: INK.ctaInk,
  },
  caption: {
    fontFamily: FontFamily.regular,
    fontSize: 12.5,
    color: INK.caption,
    textAlign: 'center',
  },

});

export default OnboardingScreen;
