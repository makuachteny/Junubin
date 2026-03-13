// ═══════════════════════════════════════════════════════════
// JuNubin — Cinematic Onboarding
// Full-bleed, dramatic, movie-poster energy.
// Instagram-warm palette with gradient accents.
// ═══════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Image,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontFamily, useTheme } from '../theme';
import LogoMark from '../components/LogoMark';
import { useAccessibilityPreferences } from '../accessibility';
import { useAuth } from '../auth';
import { GraffitiShield, GraffitiCrown } from '../components/icons';
import { SpraySplatter } from '../components/GraffitiAccents';

const { width: W, height: H } = Dimensions.get('window');
const LANDING_IMAGE = require('../assets/landing.jpeg');
const ACCENT = '#F56040';

const PAGES = [{ id: 1 }, { id: 2 }, { id: 3 }];

const OnboardingScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const { prefs } = useAccessibilityPreferences();
  const { isAuthenticated } = useAuth();
  const [currentPage, setCurrentPage] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);
  const insets = useSafeAreaInsets();

  // If user is already authenticated, skip onboarding entirely
  useEffect(() => {
    if (isAuthenticated) {
      navigation.replace('Main');
    }
  }, [isAuthenticated, navigation]);

  // ── Entrance animation ──
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (prefs?.reducedMotion) {
      Animated.timing(entrance, {
        toValue: 1,
        duration: 140,
        useNativeDriver: true,
      }).start();
      return;
    }
    Animated.spring(entrance, {
      toValue: 1,
      tension: 35,
      friction: 9,
      useNativeDriver: true,
    }).start();
  }, [entrance, prefs]);

  // ── Subtle pulse for scroll hint ──
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (prefs?.reducedMotion) {
      pulse.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, prefs]);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: false,
      listener: (e) => setCurrentPage(Math.round(e.nativeEvent.contentOffset.x / W)),
    },
  );

  const goNext = useCallback(() => {
    if (currentPage < PAGES.length - 1) {
      scrollViewRef.current?.scrollTo({ x: W * (currentPage + 1), animated: true });
    }
  }, [currentPage]);

  const goSignup = useCallback(() => navigation.navigate('Signup'), [navigation]);
  const handleLandingSkip = useCallback(() => {
    navigation.replace('Main');
  }, [navigation]);

  // ── Page animation factory ──
  const anim = (idx) => {
    const r = [(idx - 1) * W, idx * W, (idx + 1) * W];
    return {
      opacity: scrollX.interpolate({ inputRange: r, outputRange: [0, 1, 0], extrapolate: 'clamp' }),
      slideUp: scrollX.interpolate({ inputRange: r, outputRange: [60, 0, -60], extrapolate: 'clamp' }),
      scale: scrollX.interpolate({ inputRange: r, outputRange: [0.9, 1, 0.9], extrapolate: 'clamp' }),
      slideX: scrollX.interpolate({ inputRange: r, outputRange: [30, 0, -30], extrapolate: 'clamp' }),
    };
  };
  const a0 = anim(0);
  const a1 = anim(1);
  const a2 = anim(2);

  // ── Background zoom ──
  const imgScale = scrollX.interpolate({
    inputRange: [0, W * 2],
    outputRange: [1, 1.08],
    extrapolate: 'clamp',
  });

  // ── Gradient darkens as you progress ──
  const gradientOpacity = scrollX.interpolate({
    inputRange: [0, W, W * 2],
    outputRange: [0.88, 0.94, 1],
    extrapolate: 'clamp',
  });

  // ── Logo entrance ──
  const logoScale = entrance.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const logoOpacity = entrance.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.3, 1] });
  const taglineY = entrance.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const taglineOpacity = entrance.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });

  // ── Pulse values ──
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.6] });
  const pulseX = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });

  return (
    <View style={s.root}>
      {/* ── Background image ── */}
      <Animated.View style={[s.bgWrap, { transform: [{ scale: imgScale }] }]}>
        <Image source={LANDING_IMAGE} style={s.bgImage} resizeMode="cover" />
      </Animated.View>

      {/* ── Gradient overlay ── */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: gradientOpacity }]}>
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
      </Animated.View>

      {/* ── Top bar ── */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <Animated.View
          style={{
            opacity: scrollX.interpolate({ inputRange: [0, W * 0.5], outputRange: [0, 1], extrapolate: 'clamp' }),
          }}
        >
          <LogoMark size={32} light />
        </Animated.View>
        {currentPage < PAGES.length - 1 && (
          <TouchableOpacity
            testID="onboarding-skip"
            onPress={handleLandingSkip}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={s.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Pages ── */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        scrollEventThrottle={16}
        onScroll={handleScroll}
        showsHorizontalScrollIndicator={false}
        style={StyleSheet.absoluteFill}
        contentContainerStyle={{ width: W * PAGES.length }}
      >
        {/* ──── PAGE 1: THE POSTER ──── */}
        <View style={s.pg}>
          <Animated.View
            style={[
              s.heroWrap,
              {
                opacity: a0.opacity,
                transform: [{ scale: Animated.multiply(a0.scale, logoScale) }],
              },
            ]}
          >
            <Animated.View style={{ opacity: logoOpacity }}>
              <LogoMark size={120} light animated />
            </Animated.View>

            <Animated.View style={[s.heroTextBlock, { opacity: taglineOpacity, transform: [{ translateY: taglineY }] }]}>

              <Text style={s.heroTagline}>Where Junubin</Text>
              <Text testID="onboarding-hero-connect" style={s.heroAccent}>connect.</Text>
            </Animated.View>
          </Animated.View>

          {/* Scroll hint */}
          <Animated.View
            style={[
              s.scrollHint,
              {
                opacity: Animated.multiply(a0.opacity, pulseOpacity),
                transform: [{ translateX: pulseX }],
              },
            ]}
          >
            <Text style={s.scrollHintText}>SWIPE</Text>
            <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.4)" />
          </Animated.View>
        </View>

        {/* ──── PAGE 2: THE STORY ──── */}
        <View style={s.pg}>
          <Animated.View style={[s.storyWrap, { opacity: a1.opacity, transform: [{ translateY: a1.slideUp }] }]}>
            <Animated.Text style={[s.eyebrow, { transform: [{ translateX: a1.slideX }] }]}>
              OUR STORY
            </Animated.Text>

            <View style={s.bigTitleRow}>
              <Text style={s.bigTitle}>
                Heritage{'\n'}Brought Us{'\n'}
                <Text style={s.bigTitleGlow}>Together</Text>
              </Text>
              <GraffitiShield size={36} color="#22C55E" filled style={{ opacity: 0.25, marginLeft: 8, marginTop: 8 }} />
            </View>

            <View style={s.rule} />

            <Text style={s.bodyText}>
              Find love. Find your people.{'\n'}
              Swipe into something real or{'\n'}
              rally the crew for Saturday.
            </Text>

            <Animated.View style={[s.pillRow, { transform: [{ translateX: a1.slideX }] }]}>
              <View style={s.pill}>
                <GraffitiShield size={14} color="#EF4444" filled />
                <Text style={s.pillText}>Dating</Text>
              </View>
              <View style={s.pill}>
                <GraffitiCrown size={14} color="#22C55E" filled />
                <Text style={s.pillText}>Social</Text>
              </View>
              <View style={s.pill}>
                <Ionicons name="earth" size={13} color="#3B82F6" />
                <Text style={s.pillText}>Diaspora</Text>
              </View>
            </Animated.View>
          </Animated.View>
        </View>

        {/* ──── PAGE 3: THE INVITATION ──── */}
        <View style={s.pg}>
          {/* Ambient spray accents */}
          <Animated.View style={[{ position: 'absolute', right: 20, top: H * 0.35 }, { opacity: a2.opacity }]} pointerEvents="none">
            <SpraySplatter size={70} color="#22C55E" opacity={0.08} />
          </Animated.View>
          <Animated.View style={[{ position: 'absolute', left: 10, top: H * 0.25 }, { opacity: a2.opacity }]} pointerEvents="none">
            <SpraySplatter size={50} color="#EF4444" opacity={0.06} />
          </Animated.View>

          <Animated.View style={[s.inviteWrap, { opacity: a2.opacity, transform: [{ translateY: a2.slideUp }] }]}>
            <Animated.Text style={[s.eyebrow, { transform: [{ translateX: a2.slideX }] }]}>
              EVERYWHERE
            </Animated.Text>

            <View style={{ marginBottom: 20 }}>
              <Text style={s.cityBright}>Juba.</Text>
              <Text style={s.cityMid}>London.</Text>
              <Text style={s.cityFade}>Minneapolis.</Text>
              <Text style={s.cityFaintest}>Cairo.</Text>
            </View>

            <View style={s.rule} />

            <Text style={s.bodyText}>
              Doesn't matter where you are —{'\n'}
              if you're one of us, you're already{' '}
              <Text style={s.homeAccent}>home</Text>.
            </Text>
          </Animated.View>
        </View>
      </ScrollView>

      {/* ── Bottom controls ── */}
      <View style={[s.bottom, { paddingBottom: insets.bottom + 16 }]}>
        {/* Progress capsules */}
        <View style={s.progressRow}>
          {PAGES.map((_, i) => {
            const isActive = currentPage === i;
            return (
              <View key={i} style={[s.dot, isActive && s.dotActive]} />
            );
          })}
        </View>

        {currentPage === PAGES.length - 1 ? (
          <>
            <TouchableOpacity style={s.ctaWrap} onPress={goSignup} activeOpacity={0.9}>
              <LinearGradient
                colors={[colors.accent, colors.accent, colors.accentDark]}
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

            <View style={s.altRow}>
              <TouchableOpacity style={s.altBtn} onPress={goSignup} activeOpacity={0.7}>
                <Ionicons name="call-outline" size={17} color="rgba(255,255,255,0.75)" />
                <Text style={s.altText}>Phone</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.altBtn} onPress={goSignup} activeOpacity={0.7}>
                <Ionicons name="mail-outline" size={17} color="rgba(255,255,255,0.75)" />
                <Text style={s.altText}>Email</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.terms}>
              By continuing, you agree to our{' '}
              <Text style={s.termsLink}>Terms</Text> &{' '}
              <Text style={s.termsLink}>Privacy Policy</Text>
            </Text>
          </>
        ) : (
          <TouchableOpacity style={s.nextBtnOuter} onPress={goNext} activeOpacity={0.85}>
            <LinearGradient
              colors={[colors.accent, colors.accent, colors.accentDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.nextBtnGradient}
            >
              <Ionicons name="arrow-forward" size={24} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        )}
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

  // ── Top bar ──
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24,
  },
  skipText: {
    fontSize: 15, fontWeight: '500', fontFamily: FontFamily.medium,
    color: 'rgba(255,255,255,0.5)', letterSpacing: 0.3,
  },

  // ── Page base ──
  pg: { width: W, height: H, justifyContent: 'flex-end', paddingBottom: 210 },

  // ══ PAGE 1 — Hero ══
  heroWrap: { alignItems: 'center', paddingHorizontal: 32 },
  heroTextBlock: { alignItems: 'center', marginTop: 24 },
  flagStripe: {
    flexDirection: 'row', height: 3, width: 100,
    marginTop: 14, borderRadius: 2, overflow: 'hidden', opacity: 0.5,
  },
  flagBand: { flex: 1, height: 3 },
  bigTitleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  heroTagline: {
    fontSize: 22, fontWeight: '300', fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.65)', textAlign: 'center',
    letterSpacing: 4, textTransform: 'uppercase', marginBottom: 4,
  },
  heroAccent: {
    fontSize: 44, fontWeight: '800', fontFamily: FontFamily.extrabold,
    color: '#FFFFFF', textAlign: 'center', letterSpacing: -1,
    fontStyle: 'italic',
  },
  scrollHint: {
    position: 'absolute', bottom: 180, right: 28,
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  scrollHintText: {
    fontSize: 10, fontWeight: '600', fontFamily: FontFamily.semibold,
    color: 'rgba(255,255,255,0.35)', letterSpacing: 2,
  },

  // ══ PAGE 2 — Story ══
  storyWrap: { paddingHorizontal: 32 },

  // ══ Shared text styles ══
  eyebrow: {
    fontSize: 11, fontWeight: '700', fontFamily: FontFamily.bold,
    color: ACCENT, letterSpacing: 3.5, marginBottom: 16,
  },
  bigTitle: {
    fontSize: 44, fontWeight: '900', fontFamily: FontFamily.black,
    color: '#FFFFFF', lineHeight: 50, letterSpacing: -1.5, marginBottom: 20,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 16,
  },
  bigTitleGlow: {
    color: ACCENT,
  },
  bodyText: {
    fontSize: 16, fontWeight: '400', fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.55)', lineHeight: 26, letterSpacing: 0.1, marginBottom: 28,
  },
  rule: {
    width: 28, height: 2.5, borderRadius: 2,
    backgroundColor: ACCENT, marginBottom: 20, opacity: 0.6,
  },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  pillText: {
    fontSize: 13, fontWeight: '600', fontFamily: FontFamily.semibold,
    color: 'rgba(255,255,255,0.7)',
  },

  // ══ PAGE 3 — Invitation ══
  inviteWrap: { paddingHorizontal: 32 },
  cityBright: {
    fontSize: 46, fontWeight: '900', fontFamily: FontFamily.black,
    color: '#FFFFFF', lineHeight: 54, letterSpacing: -1.5,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 12,
  },
  cityMid: {
    fontSize: 46, fontWeight: '900', fontFamily: FontFamily.black,
    color: 'rgba(255,255,255,0.6)', lineHeight: 54, letterSpacing: -1.5,
  },
  cityFade: {
    fontSize: 46, fontWeight: '900', fontFamily: FontFamily.black,
    color: 'rgba(255,255,255,0.3)', lineHeight: 54, letterSpacing: -1.5,
  },
  cityFaintest: {
    fontSize: 46, fontWeight: '900', fontFamily: FontFamily.black,
    color: 'rgba(255,255,255,0.14)', lineHeight: 54, letterSpacing: -1.5,
  },
  homeAccent: {
    color: ACCENT, fontWeight: '700', fontFamily: FontFamily.bold,
  },

  // ── Bottom ──
  bottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 24, zIndex: 20,
  },
  progressRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 6, marginBottom: 24,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotActive: {
    width: 28, height: 6, borderRadius: 3,
    backgroundColor: ACCENT,
  },

  // Next button — gradient circle
  nextBtnOuter: {
    width: 60, height: 60, borderRadius: 30,
    alignSelf: 'center', overflow: 'hidden',
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 20, elevation: 10,
  },
  nextBtnGradient: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
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

  // Alt
  altRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  altBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  altText: {
    fontSize: 15, fontWeight: '600', fontFamily: FontFamily.semibold,
    color: 'rgba(255,255,255,0.7)',
  },

  // Terms
  terms: {
    fontSize: 11, fontWeight: '400', fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 12, lineHeight: 17,
  },
  termsLink: { color: 'rgba(255,255,255,0.35)', fontWeight: '600', fontFamily: FontFamily.semibold },
});

export default OnboardingScreen;
