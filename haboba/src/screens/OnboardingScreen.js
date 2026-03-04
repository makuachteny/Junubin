// ═══════════════════════════════════════════════════════════
// JuNubin — Cinematic Onboarding
// Full-bleed, dramatic, movie-poster energy.
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
import { FontFamily } from '../theme';
import LogoMark from '../components/LogoMark';

const { width: W, height: H } = Dimensions.get('window');
const LANDING_IMAGE = require('../assets/landing.jpeg');

const PAGES = [{ id: 1 }, { id: 2 }, { id: 3 }];
const ACCENT = '#E8453C';

const OnboardingScreen = ({ navigation }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef(null);
  const insets = useSafeAreaInsets();

  // ── Entrance animation ──
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(entrance, {
      toValue: 1,
      tension: 40,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  // ── Pulse for scroll hint ──
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

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

  // ── Page animation factory ──
  const anim = (idx) => {
    const r = [(idx - 1) * W, idx * W, (idx + 1) * W];
    return {
      opacity: scrollX.interpolate({ inputRange: r, outputRange: [0, 1, 0], extrapolate: 'clamp' }),
      slideUp: scrollX.interpolate({ inputRange: r, outputRange: [70, 0, -70], extrapolate: 'clamp' }),
      scale: scrollX.interpolate({ inputRange: r, outputRange: [0.88, 1, 0.88], extrapolate: 'clamp' }),
      slideX: scrollX.interpolate({ inputRange: r, outputRange: [40, 0, -40], extrapolate: 'clamp' }),
    };
  };
  const a0 = anim(0);
  const a1 = anim(1);
  const a2 = anim(2);

  // ── Background zoom (no translate — just scale from center) ──
  const imgScale = scrollX.interpolate({
    inputRange: [0, W * 2],
    outputRange: [1, 1.05],
    extrapolate: 'clamp',
  });

  // ── Gradient darkens as you progress ──
  const gradientOpacity = scrollX.interpolate({
    inputRange: [0, W, W * 2],
    outputRange: [0.85, 0.92, 1],
    extrapolate: 'clamp',
  });

  // ── Warm tint builds on later pages ──
  const warmTint = scrollX.interpolate({
    inputRange: [0, W, W * 2],
    outputRange: [0, 0.04, 0.07],
    extrapolate: 'clamp',
  });

  // ── Pulse values ──
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] });
  const pulseX = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 8] });

  // ── Logo entrance ──
  const logoScale = entrance.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const logoOpacity = entrance.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.5, 1] });
  const taglineY = entrance.interpolate({ inputRange: [0, 1], outputRange: [30, 0] });
  const taglineOpacity = entrance.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0, 1] });

  return (
    <View style={s.root}>
      {/* ── Background image — scale only, no translate ── */}
      <Animated.View style={[s.bgWrap, { transform: [{ scale: imgScale }] }]}>
        <Image source={LANDING_IMAGE} style={s.bgImage} resizeMode="cover" />
      </Animated.View>

      {/* ── Gradient overlay that intensifies per page ── */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: gradientOpacity }]}>
        <LinearGradient
          colors={[
            'rgba(12, 10, 8, 0.05)',
            'rgba(12, 10, 8, 0.20)',
            'rgba(12, 10, 8, 0.60)',
            'rgba(12, 10, 8, 0.92)',
          ]}
          locations={[0, 0.3, 0.6, 0.85]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* ── Warm color wash on later pages ── */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: ACCENT, opacity: warmTint }]} />

      {/* ── Top bar ── */}
      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <Animated.View
          style={{
            opacity: scrollX.interpolate({ inputRange: [0, W * 0.5], outputRange: [0, 1], extrapolate: 'clamp' }),
          }}
        >
          <LogoMark size={36} light />
        </Animated.View>
        {currentPage < PAGES.length - 1 && (
          <TouchableOpacity onPress={() => navigation.replace('Main')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
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
              <LogoMark size={140} light />
            </Animated.View>
            <View style={s.heroLine} />
            <Animated.View style={{ opacity: taglineOpacity, transform: [{ translateY: taglineY }] }}>
              <Text style={s.heroTagline}>
                Where Junubin{'\n'}
                <Text style={s.heroAccent}>connect.</Text>
              </Text>
            </Animated.View>
          </Animated.View>

          {/* Animated scroll hint */}
          <Animated.View
            style={[
              s.scrollHint,
              {
                opacity: Animated.multiply(a0.opacity, pulseOpacity),
                transform: [{ translateX: pulseX }],
              },
            ]}
          >
            <Text style={s.scrollHintText}>Swipe</Text>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.5)" />
          </Animated.View>
        </View>

        {/* ──── PAGE 2: THE STORY ──── */}
        <View style={s.pg}>
          <Animated.View style={[s.storyWrap, { opacity: a1.opacity, transform: [{ translateY: a1.slideUp }] }]}>
            <Animated.Text style={[s.storyEyebrow, { transform: [{ translateX: a1.slideX }] }]}>
              OUR STORY
            </Animated.Text>

            <Text style={s.storyTitle}>
              Heritage{'\n'}Brought Us{'\n'}
              <Text style={s.storyTitleAccent}>Together</Text>
            </Text>

            <View style={s.rule} />

            <Text style={s.storyBody}>
              Find love. Find your people.{'\n'}
              Swipe into something real or{'\n'}
              rally the crew for Saturday.
            </Text>

            <Animated.View style={[s.pillRow, { transform: [{ translateX: a1.slideX }] }]}>
              {[
                { icon: 'heart', label: 'Dating' },
                { icon: 'people', label: 'Social' },
                { icon: 'earth', label: 'Diaspora' },
              ].map((c) => (
                <View key={c.label} style={s.pill}>
                  <Ionicons name={c.icon} size={14} color={ACCENT} />
                  <Text style={s.pillText}>{c.label}</Text>
                </View>
              ))}
            </Animated.View>
          </Animated.View>
        </View>

        {/* ──── PAGE 3: THE INVITATION ──── */}
        <View style={s.pg}>
          <Animated.View style={[s.inviteWrap, { opacity: a2.opacity, transform: [{ translateY: a2.slideUp }] }]}>
            <Animated.Text style={[s.inviteEyebrow, { transform: [{ translateX: a2.slideX }] }]}>
              EVERYWHERE
            </Animated.Text>

            <Text style={s.inviteTitle}>
              <Text style={s.inviteCityBright}>Juba.</Text>{' '}
              <Text style={s.inviteCityMid}>London.</Text>
              {'\n'}
              <Text style={s.inviteCityFade}>Minneapolis.</Text>
              {'\n'}
              <Text style={s.inviteCityFaintest}>Cairo.</Text>
            </Text>

            <View style={s.rule} />

            <Text style={s.inviteBody}>
              Doesn't matter where you are —{'\n'}
              if you're one of us, you're already{' '}
              <Text style={s.inviteHome}>home</Text>.
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
              <View
                key={i}
                style={[
                  s.dot,
                  { width: isActive ? 28 : 6, backgroundColor: isActive ? ACCENT : 'rgba(255,255,255,0.3)' },
                ]}
              />
            );
          })}
        </View>

        {currentPage === PAGES.length - 1 ? (
          <>
            <TouchableOpacity style={s.ctaWrap} onPress={goSignup} activeOpacity={0.9}>
              <LinearGradient
                colors={[ACCENT, '#C42B22']}
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
                <Ionicons name="call-outline" size={18} color="rgba(255,255,255,0.8)" />
                <Text style={s.altText}>Phone</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.altBtn} onPress={goSignup} activeOpacity={0.7}>
                <Ionicons name="mail-outline" size={18} color="rgba(255,255,255,0.8)" />
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
          <TouchableOpacity style={s.nextBtn} onPress={goNext} activeOpacity={0.85}>
            <Ionicons name="arrow-forward" size={24} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1A1715' },

  // ── Background (oversized, centered — no translate, only scale) ──
  bgWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  bgImage: {
    width: W * 1.5,
    height: H * 1.15,
    marginLeft: -(W * 0.25),
    marginTop: -(H * 0.075),
  },

  // ── Top bar ──
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24,
  },
  skipText: {
    fontSize: 14, fontWeight: '500', fontFamily: FontFamily.medium,
    color: 'rgba(255,255,255,0.4)', letterSpacing: 0.8,
  },

  // ── Page base ──
  pg: { width: W, height: H, justifyContent: 'flex-end', paddingBottom: 220 },

  // ══ PAGE 1 — Hero ══
  heroWrap: { alignItems: 'center', paddingHorizontal: 24 },
  heroLine: {
    width: 48, height: 2, borderRadius: 1,
    backgroundColor: ACCENT, marginVertical: 20,
  },
  heroTagline: {
    fontSize: 26, fontWeight: '300', fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 36, letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  heroAccent: {
    fontWeight: '800', fontFamily: FontFamily.bold, color: '#FFFFFF',
    fontStyle: 'italic', letterSpacing: -0.5, textTransform: 'none',
    fontSize: 32,
  },
  scrollHint: {
    position: 'absolute', bottom: 185, right: 24,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  scrollHintText: {
    fontSize: 11, fontWeight: '600', fontFamily: FontFamily.semibold,
    color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, textTransform: 'uppercase',
  },

  // ══ PAGE 2 — Story ══
  storyWrap: { paddingHorizontal: 28 },
  storyEyebrow: {
    fontSize: 11, fontWeight: '700', fontFamily: FontFamily.bold,
    color: ACCENT, letterSpacing: 3, marginBottom: 14,
  },
  storyTitle: {
    fontSize: 46, fontWeight: '900', fontFamily: FontFamily.black,
    color: '#FFFFFF', lineHeight: 52, letterSpacing: -1.5, marginBottom: 18,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 20,
  },
  storyTitleAccent: { color: ACCENT },
  storyBody: {
    fontSize: 16, fontWeight: '400', fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.6)', lineHeight: 26, letterSpacing: 0.2, marginBottom: 28,
  },
  pillRow: { flexDirection: 'row', gap: 10 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 24,
    backgroundColor: 'rgba(232, 69, 60, 0.12)',
    borderWidth: 1, borderColor: 'rgba(232, 69, 60, 0.2)',
  },
  pillText: {
    fontSize: 13, fontWeight: '600', fontFamily: FontFamily.semibold,
    color: 'rgba(255,255,255,0.75)',
  },

  // ══ PAGE 3 — Invitation ══
  inviteWrap: { paddingHorizontal: 28 },
  inviteEyebrow: {
    fontSize: 11, fontWeight: '700', fontFamily: FontFamily.bold,
    color: ACCENT, letterSpacing: 3, marginBottom: 14,
  },
  inviteTitle: { marginBottom: 18 },
  inviteCityBright: {
    fontSize: 48, fontWeight: '900', fontFamily: FontFamily.black,
    color: '#FFFFFF', lineHeight: 56, letterSpacing: -1.5,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 16,
  },
  inviteCityMid: {
    fontSize: 48, fontWeight: '900', fontFamily: FontFamily.black,
    color: 'rgba(255,255,255,0.7)', lineHeight: 56, letterSpacing: -1.5,
  },
  inviteCityFade: {
    fontSize: 48, fontWeight: '900', fontFamily: FontFamily.black,
    color: 'rgba(255,255,255,0.4)', lineHeight: 56, letterSpacing: -1.5,
  },
  inviteCityFaintest: {
    fontSize: 48, fontWeight: '900', fontFamily: FontFamily.black,
    color: 'rgba(255,255,255,0.2)', lineHeight: 56, letterSpacing: -1.5,
  },
  inviteBody: {
    fontSize: 17, fontWeight: '400', fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.55)', lineHeight: 28,
  },
  inviteHome: {
    color: ACCENT, fontWeight: '700', fontFamily: FontFamily.bold,
  },

  // ── Shared ──
  rule: {
    width: 32, height: 2, borderRadius: 1,
    backgroundColor: ACCENT, marginBottom: 18, opacity: 0.7,
  },

  // ── Bottom ──
  bottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 24, zIndex: 20,
  },
  progressRow: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 5, marginBottom: 24,
  },
  dot: { height: 3.5, borderRadius: 2 },

  // Next
  nextBtn: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center', alignSelf: 'center',
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10,
  },

  // CTA
  ctaWrap: {
    borderRadius: 28, overflow: 'hidden', marginBottom: 14,
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 28, elevation: 14,
  },
  ctaGradient: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, paddingVertical: 18,
  },
  ctaText: {
    fontSize: 18, fontWeight: '700', fontFamily: FontFamily.bold,
    color: '#FFF', letterSpacing: 0.3,
  },
  ctaArrow: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center',
  },

  // Alt
  altRow: { flexDirection: 'row', gap: 10, marginBottom: 6 },
  altBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 24,
    backgroundColor: 'rgba(26, 23, 21, 0.65)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  altText: {
    fontSize: 15, fontWeight: '600', fontFamily: FontFamily.semibold,
    color: 'rgba(255,255,255,0.8)',
  },

  // Terms
  terms: {
    fontSize: 11, fontWeight: '400', fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 14, lineHeight: 17,
  },
  termsLink: { color: ACCENT, fontWeight: '600', fontFamily: FontFamily.semibold },
});

export default OnboardingScreen;
