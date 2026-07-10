// ═══════════════════════════════════════════════════════════
// JuNubin — Landing
// Single-page invitation. Background image + diaspora cities + CTA.
// ═══════════════════════════════════════════════════════════

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontFamily } from '../theme';
import { reportError } from '../utils/reportError';

const ONBOARDED_KEY = '@junubin_onboarded';
const markOnboarded = () =>
  AsyncStorage.setItem(ONBOARDED_KEY, 'true')
    .catch((err) => reportError('OnboardingScreen.markOnboarded', err));

const { width: W, height: H } = Dimensions.get('window');
const LANDING_IMAGE = require('../assets/landing.jpeg');
// Warm earth-tone palette — same as SignupScreen so the landing → signup
// transition is visually continuous (honey gold, burnt orange, warm brown).
const WARM = {
  highlight: '#FFD56B',   // bright honey for italic accent words
  primary:   '#F5B741',   // honey gold
  mid:       '#E27D2C',   // burnt orange
  deep:      '#8E5524',   // warm brown ochre
};
const ACCENT = WARM.primary;

const OnboardingScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  // "Get Started" hands off to the Signup screen, which handles both
  // first-time sign-up and existing-account sign-in (phone/email +
  // verification). Skipping straight into the app via dev-bypass is
  // gone now that the auth flow is the entry point.
  const handleGetStarted = useCallback(() => {
    markOnboarded();
    navigation.navigate('Signup');
  }, [navigation]);

  return (
    <View style={s.root}>
      {/* ── Background image ── */}
      <View style={s.bgWrap}>
        <Image source={LANDING_IMAGE} style={s.bgImage} resizeMode="cover" />
      </View>

      {/* ── Gradient overlay ── */}
      <LinearGradient
        colors={[
          'rgba(0, 0, 0, 0)',
          'rgba(0, 0, 0, 0.10)',
          'rgba(0, 0, 0, 0.50)',
          'rgba(0, 0, 0, 0.88)',
          'rgba(0, 0, 0, 0.97)',
        ]}
        locations={[0, 0.25, 0.5, 0.72, 0.9]}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Invitation content ── */}
      <View style={s.pg}>
        <View style={s.inviteWrap}>
          <Text style={s.eyebrow}>EVERYWHERE</Text>
          <View style={s.rule} />
          <Text style={s.bodyText}>
            Doesn't matter where you are —{'\n'}
            if you're one of us, you're already{' '}
            <Text style={s.homeAccent}>home</Text>.
          </Text>
        </View>
      </View>

      {/* ── Bottom CTA ── */}
      <View style={[s.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={s.ctaWrap} onPress={handleGetStarted} activeOpacity={0.9}>
          <LinearGradient
            colors={[WARM.primary, WARM.mid, WARM.deep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.ctaGradient}
          >
            <Text style={s.ctaText}>Get Started</Text>
            <View style={s.ctaArrow}>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={s.terms}>
          By continuing, you agree to our{' '}
          <Text style={s.termsLink} onPress={() => navigation.navigate('SettingsInfo', { pageKey: 'terms' })}>Terms</Text> &{' '}
          <Text style={s.termsLink} onPress={() => navigation.navigate('SettingsInfo', { pageKey: 'privacy' })}>Privacy Policy</Text>.{' '}
          Screenshots and screen recording are blocked everywhere in JuNubin — content stays in the app.
        </Text>
      </View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },

  // ── Background ──
  bgWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  bgImage: {
    width: W * 1.4,
    height: H * 1.1,
    marginLeft: -(W * 0.2),
    marginTop: -(H * 0.05),
  },

  // ── Page base ──
  // The bottom CTA + terms block is absolutely positioned, so this padding
  // is what lifts the invite text above it. Sized to clear the CTA pill
  // (~76px) + terms (~63px) + bottom-inset breathing room with a margin
  // of comfort — undersizing causes the body copy to overlap the button.
  pg: { flex: 1, justifyContent: 'flex-end', paddingBottom: 230 },

  // ══ Shared text styles ══
  eyebrow: {
    fontSize: 11, fontWeight: '700', fontFamily: FontFamily.bold,
    color: ACCENT, letterSpacing: 3.5, marginBottom: 10,
  },
  bodyText: {
    fontSize: 16, fontWeight: '400', fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.55)', lineHeight: 26, letterSpacing: 0.1,
  },
  rule: {
    width: 28, height: 2.5, borderRadius: 2,
    backgroundColor: ACCENT, marginBottom: 18, opacity: 0.6,
  },

  // ══ Invitation ══
  inviteWrap: { paddingHorizontal: 32 },
  homeAccent: {
    color: ACCENT, fontWeight: '700', fontFamily: FontFamily.bold,
  },

  // ── Bottom ──
  bottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 24, zIndex: 20,
  },

  // CTA
  ctaWrap: {
    borderRadius: 28, overflow: 'hidden', marginBottom: 14,
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 14,
  },
  ctaGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingVertical: 17,
  },
  ctaText: {
    fontSize: 17, fontWeight: '700', fontFamily: FontFamily.bold,
    color: '#FFF', letterSpacing: 0.3,
  },
  ctaArrow: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center',
  },

  // Terms
  terms: {
    fontSize: 11, fontWeight: '400', fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 12, lineHeight: 17,
  },
  termsLink: { color: 'rgba(255,255,255,0.35)', fontWeight: '600', fontFamily: FontFamily.semibold },
});

export default OnboardingScreen;
