// ═══════════════════════════════════════════════════════════
// JuNubin — Cinematic Onboarding
// Full-bleed, dramatic, movie-poster energy.
// Warm palette with gradient accents.
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
import { SpraySplatter } from '../components/GraffitiAccents';

const { width: W, height: H } = Dimensions.get('window');
const LANDING_IMAGE = require('../assets/landing.jpeg');
const ACCENT = '#009739';

const PAGES = [{ id: 1 }, { id: 2 }];

const CITIES = [
  'Juba.',
  'London.',
  'Minneapolis.',
  'Cairo.',
  'Nairobi.',
  'Sydney.',
  'Kampala.',
  'Melbourne.',
  'Des Moines.',
  'Omaha.',
  'Dallas.',
  'Khartoum.',
  'Addis Ababa.',
  'Toronto.',
  'Phoenix.',
  'Kansas City.',
  'Nashville.',
  'Columbus.',
  'Brisbane.',
  'Perth.',
  'Winnipeg.',
  'Edmonton.',
  'Manchester.',
  'Birmingham.',
  'Amsterdam.',
  'Oslo.',
  'Juba.',
  'London.',
  'Minneapolis.',
  'Cairo.',
];
const CITY_LINE_HEIGHT = 52;
const VISIBLE_CITIES = 4;

const CITY_OPACITIES = [1, 0.55, 0.28, 0.12];

const CityScroller = ({ isActive }) => {
  const scrollAnim = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);

  useEffect(() => {
    if (!isActive) {
      scrollAnim.setValue(0);
      if (animRef.current) animRef.current.stop();
      return;
    }

    // Total scrollable cities (minus the visible window that's duplicated at end)
    const totalSteps = CITIES.length - VISIBLE_CITIES;
    const totalDistance = totalSteps * CITY_LINE_HEIGHT;

    // Start after a brief pause, then scroll continuously
    const timer = setTimeout(() => {
      animRef.current = Animated.loop(
        Animated.timing(scrollAnim, {
          toValue: -totalDistance,
          duration: totalSteps * 1400,
          useNativeDriver: true,
        }),
      );
      animRef.current.start();
    }, 800);

    return () => {
      clearTimeout(timer);
      if (animRef.current) animRef.current.stop();
    };
  }, [isActive, scrollAnim]);

  // Interpolate per-city opacity based on scroll position
  // Each city gets whiter (opacity → 1) as it reaches the top of the window
  const cityAnimatedOpacities = CITIES.map((_, i) => {
    const cityY = i * CITY_LINE_HEIGHT; // absolute Y of this city
    // scrollAnim is negative, so effective position = cityY + scrollAnim
    // When at top of window: position ≈ 0 → full white
    // When at bottom: position ≈ (VISIBLE_CITIES-1)*LINE_HEIGHT → faint
    return scrollAnim.interpolate({
      inputRange: [
        -(cityY + 3 * CITY_LINE_HEIGHT),
        -(cityY + 2 * CITY_LINE_HEIGHT),
        -(cityY + CITY_LINE_HEIGHT),
        -cityY,
      ],
      outputRange: [0.12, 0.28, 0.55, 1],
      extrapolate: 'clamp',
    });
  });

  return (
    <View style={{ height: VISIBLE_CITIES * CITY_LINE_HEIGHT, overflow: 'hidden', marginBottom: 24 }}>
      <Animated.View style={{ transform: [{ translateY: scrollAnim }] }}>
        {CITIES.map((city, i) => (
          <Animated.Text
            key={`${city}-${i}`}
            style={{
              fontSize: 44,
              fontWeight: '900',
              fontFamily: FontFamily.black,
              color: 'white',
              opacity: cityAnimatedOpacities[i],
              lineHeight: CITY_LINE_HEIGHT,
              letterSpacing: -1.2,
            }}
          >
            {city}
          </Animated.Text>
        ))}
      </Animated.View>
    </View>
  );
};

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
  const { setDevBypass } = useAuth();
  const handleLandingSkip = useCallback(() => {
    // Enable dev bypass; AppNavigator will swap to the authenticated stack.
    setDevBypass(true);
  }, [setDevBypass]);

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

  // ── Background zoom ──
  const imgScale = scrollX.interpolate({
    inputRange: [0, W],
    outputRange: [1, 1.06],
    extrapolate: 'clamp',
  });

  // ── Gradient darkens as you progress ──
  const gradientOpacity = scrollX.interpolate({
    inputRange: [0, W],
    outputRange: [0.85, 0.95],
    extrapolate: 'clamp',
  });

  // ── Logo entrance ──
  const logoScale = entrance.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const logoOpacity = entrance.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.3, 1] });
  const ornamentY = entrance.interpolate({ inputRange: [0, 1], outputRange: [32, 0] });
  const ornamentOpacity = entrance.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });

  // ── Pulse values ──
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.6] });
  const pulseX = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });

  // Bottom area height for proper content spacing
  const bottomH = insets.bottom + 180;

  return (
    <View style={s.root}>
      {/* ── Background image — edge-to-edge cover ── */}
      <Animated.View style={[s.bgWrap, { transform: [{ scale: imgScale }] }]}>
        <Image source={LANDING_IMAGE} style={s.bgImage} resizeMode="cover" />
      </Animated.View>

      {/* ── Gradient overlay — smoother, less harsh ── */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: gradientOpacity }]}>
        <LinearGradient
          colors={[
            'rgba(0, 0, 0, 0)',
            'rgba(0, 0, 0, 0.03)',
            'rgba(0, 0, 0, 0.18)',
            'rgba(0, 0, 0, 0.52)',
            'rgba(0, 0, 0, 0.82)',
            'rgba(0, 0, 0, 0.94)',
          ]}
          locations={[0, 0.15, 0.35, 0.55, 0.75, 0.92]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* ── Top bar ── */}
      <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
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
        <View style={[s.pg, { paddingBottom: bottomH + 24 }]}>
          <Animated.View
            style={[
              s.heroWrap,
              {
                opacity: a0.opacity,
                transform: [{ scale: Animated.multiply(a0.scale, logoScale) }],
              },
            ]}
          >
            <View style={s.heroHalo} pointerEvents="none" />
            <Animated.View style={{ opacity: logoOpacity }}>
              <LogoMark size={120} light animated showSub={false} />
            </Animated.View>

            <Animated.View style={[s.heroTextBlock, { opacity: taglineOpacity, transform: [{ translateY: taglineY }] }]}>
              <Text style={s.heroTagline}>Connect with</Text>
              <Text testID="onboarding-hero-connect" style={s.heroAccent}>South Sudanese.</Text>
            </Animated.View>
          </Animated.View>

          {/* Scroll hint */}
          <Animated.View
            style={[
              s.scrollHint,
              {
                bottom: bottomH - 20,
                opacity: Animated.multiply(a0.opacity, pulseOpacity),
                transform: [{ translateX: pulseX }],
              },
            ]}
          >
            <Text style={s.scrollHintText}>SWIPE</Text>
            <Ionicons name="chevron-forward" size={12} color="rgba(255,255,255,0.4)" />
          </Animated.View>
        </View>

        {/* ──── PAGE 2: THE INVITATION ──── */}
        <View style={[s.pg, { paddingBottom: bottomH + 24 }]}>
          {/* Ambient spray accents */}
          <Animated.View style={[{ position: 'absolute', right: 24, top: H * 0.32 }, { opacity: a1.opacity }]} pointerEvents="none">
            <SpraySplatter size={70} color="#009739" opacity={0.08} />
          </Animated.View>
          <Animated.View style={[{ position: 'absolute', left: 16, top: H * 0.24 }, { opacity: a1.opacity }]} pointerEvents="none">
            <SpraySplatter size={50} color="#CE1126" opacity={0.06} />
          </Animated.View>

          <Animated.View style={[s.contentWrap, { opacity: a1.opacity, transform: [{ translateY: a1.slideUp }] }]}>
            <Animated.Text style={[s.eyebrow, { transform: [{ translateX: a1.slideX }] }]}>
              EVERYWHERE
            </Animated.Text>

            <CityScroller isActive={currentPage === 1} />

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
      <View style={[s.bottom, { paddingBottom: insets.bottom + 20 }]}>
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
                colors={[colors.green, colors.green, colors.greenDark]}
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
                <Ionicons name="call-outline" size={17} color="rgba(255,255,255,0.8)" />
                <Text style={s.altText}>Phone</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.altBtn} onPress={goSignup} activeOpacity={0.7}>
                <Ionicons name="mail-outline" size={17} color="rgba(255,255,255,0.8)" />
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
          <TouchableOpacity testID="onboarding-next" style={s.nextBtnOuter} onPress={goNext} activeOpacity={0.85}>
            <LinearGradient
              colors={[colors.green, colors.green, colors.greenDark]}
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
const CONTENT_PAD = 28;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },

  // ── Background — true edge-to-edge cover ──
  bgWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  bgImage: {
    width: W,
    height: H,
  },

  // ── Top bar ──
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: CONTENT_PAD,
  },
  skipText: {
    fontSize: 15, fontWeight: '500', fontFamily: FontFamily.medium,
    color: 'rgba(255,255,255,0.6)', letterSpacing: 0.3,
  },

  // ── Page base ──
  pg: { width: W, height: H, justifyContent: 'flex-end' },

  // ── Shared content wrapper (consistent left-aligned padding) ──
  contentWrap: { paddingHorizontal: CONTENT_PAD },

  // ══ PAGE 1 — Hero ══
  heroWrap: { alignItems: 'center', paddingHorizontal: CONTENT_PAD, marginTop: H * 0.1, gap: 14 },
  heroHalo: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(0,151,57,0.12)',
    shadowColor: '#009739',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.35,
    shadowRadius: 32,
  },
  heroTextBlock: { alignItems: 'center', marginTop: 28 },
  heroTagline: {
    fontSize: 22, fontWeight: '300', fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.7)', textAlign: 'center',
    letterSpacing: 4, textTransform: 'uppercase', marginBottom: 6,
  },
  heroAccent: {
    fontSize: 44, fontWeight: '900', fontFamily: FontFamily.black,
    color: '#FFFFFF', textAlign: 'center', letterSpacing: -1,
  },
  heroRule: { width: 120, height: 2, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.32)' },
  heroGlyphRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  heroDotAccent: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#009739' },
  bigTitleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  scrollHint: {
    position: 'absolute', right: CONTENT_PAD,
    flexDirection: 'row', alignItems: 'center', gap: 3,
  },
  scrollHintText: {
    fontSize: 10, fontWeight: '600', fontFamily: FontFamily.semibold,
    color: 'rgba(255,255,255,0.35)', letterSpacing: 2,
  },

  // ══ Shared text styles ══
  eyebrow: {
    fontSize: 11, fontWeight: '700', fontFamily: FontFamily.bold,
    color: ACCENT, letterSpacing: 3.5, marginBottom: 18,
  },
  bigTitle: {
    fontSize: 42, fontWeight: '900', fontFamily: FontFamily.black,
    color: '#FFFFFF', lineHeight: 48, letterSpacing: -1.2, marginBottom: 22,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 12,
  },
  bigTitleGlow: {
    color: ACCENT,
  },
  bodyText: {
    fontSize: 16, fontWeight: '400', fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.7)', lineHeight: 26, letterSpacing: 0.15, marginBottom: 28,
  },
  rule: {
    width: 28, height: 2.5, borderRadius: 2,
    backgroundColor: ACCENT, marginBottom: 22, opacity: 0.6,
  },
  pillRow: { flexDirection: 'row', gap: 10 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingVertical: 9, paddingHorizontal: 18, borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  pillText: {
    fontSize: 13, fontWeight: '600', fontFamily: FontFamily.semibold,
    color: 'rgba(255,255,255,0.75)',
  },

  // ══ PAGE 3 — Invitation ══
  cityBright: {
    fontSize: 44, fontWeight: '900', fontFamily: FontFamily.black,
    color: '#FFFFFF', lineHeight: 52, letterSpacing: -1.2,
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10,
  },
  cityMid: {
    fontSize: 44, fontWeight: '900', fontFamily: FontFamily.black,
    color: 'rgba(255,255,255,0.55)', lineHeight: 52, letterSpacing: -1.2,
  },
  cityFade: {
    fontSize: 44, fontWeight: '900', fontFamily: FontFamily.black,
    color: 'rgba(255,255,255,0.28)', lineHeight: 52, letterSpacing: -1.2,
  },
  cityFaintest: {
    fontSize: 44, fontWeight: '900', fontFamily: FontFamily.black,
    color: 'rgba(255,255,255,0.12)', lineHeight: 52, letterSpacing: -1.2,
  },
  homeAccent: {
    color: ACCENT, fontWeight: '700', fontFamily: FontFamily.bold,
  },

  // ── Bottom ──
  bottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: CONTENT_PAD, zIndex: 20,
  },
  progressRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 6, marginBottom: 28,
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
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
  },
  nextBtnGradient: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },

  // CTA
  ctaWrap: {
    borderRadius: 28, overflow: 'hidden', marginBottom: 14,
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 20, elevation: 14,
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
  altRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  altBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  altText: {
    fontSize: 15, fontWeight: '600', fontFamily: FontFamily.semibold,
    color: 'rgba(255,255,255,0.75)',
  },

  // Terms
  terms: {
    fontSize: 11, fontWeight: '400', fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 10, lineHeight: 17,
  },
  termsLink: { color: 'rgba(255,255,255,0.4)', fontWeight: '600', fontFamily: FontFamily.semibold },
});

export default OnboardingScreen;
