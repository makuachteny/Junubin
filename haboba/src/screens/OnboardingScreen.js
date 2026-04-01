import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontFamily, useTheme } from '../theme';
import LogoMark from '../components/LogoMark';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAccessibilityPreferences } from '../accessibility';
import { useAuth } from '../auth';
import { trackEvent, AnalyticsEvents } from '../utils/analytics';
import FlagBackdrop from '../components/FlagBackdrop';

const { width: W, height: H } = Dimensions.get('window');
const PG = 2;



export default function OnboardingScreen({ navigation }) {
  const { prefs } = useAccessibilityPreferences();
  const { isDark } = useTheme();
  const { setDevBypass } = useAuth();

  // Theme-aware colors
  const bg = '#000000';
  const txt = isDark ? '#FFFFFF' : '#1A1A1A';
  const txtSub = isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.35)';
  const accent = '#CE1126';
  const border = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const [pg, setPg] = useState(0);
  const sx = useRef(new Animated.Value(0)).current;
  const sr = useRef(null);
  const ins = useSafeAreaInsets();

  const e4 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.stagger(prefs?.reducedMotion ? 60 : 180, [
      Animated.spring(e4, { toValue: 1, tension: 26, friction: 7, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    trackEvent(AnalyticsEvents.ONBOARDING_PAGE_VIEW, { page: pg });
  }, [pg]);

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: sx } } }],
    { useNativeDriver: false, listener: (ev) => setPg(Math.round(ev.nativeEvent.contentOffset.x / W)) },
  );
  const signup = useCallback(() => {
    AsyncStorage.setItem('@haboba_onboarded', 'true').catch(() => {});
    trackEvent(AnalyticsEvents.ONBOARDING_COMPLETE);
    navigation.navigate('Signup');
  }, [navigation]);

  const pf = (i) => ({
    op: sx.interpolate({ inputRange: [(i - 1) * W, i * W, (i + 1) * W], outputRange: [0, 1, 0], extrapolate: 'clamp' }),
    ty: sx.interpolate({ inputRange: [(i - 1) * W, i * W, (i + 1) * W], outputRange: [50, 0, -50], extrapolate: 'clamp' }),
  });
  const f0 = pf(0), f1 = pf(1);

  const flagW = sx.interpolate({ inputRange: [0, W * (PG - 1)], outputRange: [48, W], extrapolate: 'clamp' });

  return (
    <View style={[$.root, { backgroundColor: bg }]}>
      <FlagBackdrop dimOverlay={isDark ? 0.22 : 0.3} />
      <Animated.View style={[$.flagBar, { width: flagW }]}>
        <LinearGradient colors={['#CE1126','#CE1126','#FCCD12','#009739','#0047AB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <ScrollView
        ref={sr} horizontal pagingEnabled scrollEventThrottle={16}
        onScroll={onScroll} showsHorizontalScrollIndicator={false}
        style={StyleSheet.absoluteFill} contentContainerStyle={{ width: W * PG }}
      >
        {/* ═══ PAGE 1 — Features ═══ */}
        <View style={$.pg}>
          <View style={$.pageCentered}>
            <Animated.View style={{ opacity: f0.op, transform: [{ translateY: f0.ty }] }}>
              <Text style={[$.h1, { color: txt }]}>
                Welcome to{'\n'}JuNubin
              </Text>
              <Text style={[$.p2Lead, { color: txtSub }]}>
                A space that moves with you.
              </Text>

              <View style={{ height: 22 }} />

              <View style={$.featList}>
                {[
                  { icon: 'people', color: '#CE1126', t: 'Community', d: 'Events, groups, shared culture' },
                  { icon: 'chatbubbles', color: '#F0A030', t: 'Socialize', d: 'Real friendships, not followers' },
                  { icon: 'globe', color: '#009739', t: 'Network', d: 'Junubin professionals worldwide' },
                  { icon: 'heart', color: '#CE1126', t: 'Dating', d: 'When you\'re ready for it' },
                ].map((f, i) => (
                  <View key={i} style={[$.featRow, i === 3 && $.featRowLast]}>
                    <View style={[$.featDot, { backgroundColor: f.color + '15' }]}>
                      <Ionicons name={f.icon} size={22} color={f.color} />
                    </View>
                    <View style={$.featText}>
                      <Text style={[$.featT, { color: txt }]}>{f.t}</Text>
                      <Text style={[$.featD, { color: txtSub }]}>{f.d}</Text>
                    </View>
                  </View>
                ))}
              </View>

            </Animated.View>
          </View>
        </View>

        {/* ═══ PAGE 2 — CTA ═══ */}
        <View style={$.pg}>
          <View style={[$.page, { paddingTop: ins.top + H * 0.16, paddingBottom: ins.bottom + 190 }]}>
            <Animated.View style={[$.flex1, { opacity: f1.op, transform: [{ translateY: f1.ty }] }]}>
              <Text style={[$.h3, { color: txt }]}>
                It doesn't{'\n'}matter where{'\n'}you are.
              </Text>

              <View style={{ height: 20 }} />

              <Text style={[$.p3Sub, { color: txtSub }]}>
                There's probably a Junubin{'\n'}right around the corner.
              </Text>

              <View style={{ height: 14 }} />

              <Text style={[$.diaspora, { color: txtSub }]}>
                Juba. Minneapolis. London. Cairo.
              </Text>

              <Text style={[$.homeLine, { color: txtSub }]}>
                Find home wherever you are.
              </Text>

              <View style={{ flex: 1 }} />

              <Text style={[$.p3Big, { color: txt }]}>
                Find them.{'\n'}
                <Text testID="onboarding-hero-connect" style={{ color: accent }}>Connect.</Text>
              </Text>
            </Animated.View>
          </View>
        </View>
      </ScrollView>

      {/* Top */}
      <View style={[$.top, { paddingTop: ins.top + 6 }]}>
        <Animated.View style={{ opacity: sx.interpolate({ inputRange: [0, W * 0.3], outputRange: [0, 1], extrapolate: 'clamp' }) }}>
          <LogoMark size={22} light={isDark} />
        </Animated.View>
        {__DEV__ && pg < PG - 1 && (
          <TouchableOpacity
            testID="onboarding-skip"
            onPress={() => { trackEvent(AnalyticsEvents.ONBOARDING_SKIP); setDevBypass(true); }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[$.skip, { color: txtSub }]}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Bottom */}
      <Animated.View style={[$.bot, { paddingBottom: ins.bottom + 12, opacity: e4, transform: [{ translateY: e4.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}>
        <View style={$.dots}>
          {Array.from({ length: PG }).map((_, i) => (
            <View key={i} style={[$.dot, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)' }, pg === i && { width: 20, backgroundColor: accent }]} />
          ))}
        </View>

        <View style={pg === PG - 1 ? null : $.ctaHidden} pointerEvents={pg === PG - 1 ? 'auto' : 'none'}>
          <TouchableOpacity style={$.cta} onPress={signup} activeOpacity={0.92}>
            <View style={[$.ctaIn, { backgroundColor: isDark ? '#FFFFFF' : '#1A1A1A' }]}>
              <Text style={[$.ctaT, { color: isDark ? '#1A1A1A' : '#FFFFFF' }]}>Get Started</Text>
              <Ionicons name="arrow-forward" size={16} color={isDark ? '#1A1A1A' : '#FFFFFF'} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={signup} style={$.si} activeOpacity={0.7}>
            <Text style={[$.siT, { color: txtSub }]}>Already a member? <Text style={[$.siB, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.6)' }]}>Sign in</Text></Text>
          </TouchableOpacity>

          <Text style={[$.leg, { color: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.15)' }]}>
            <Text onPress={() => navigation.navigate('SettingsInfo', { pageKey: 'terms' })} style={$.legLink}>Terms</Text>
            {' '}and{' '}
            <Text onPress={() => navigation.navigate('SettingsInfo', { pageKey: 'privacy' })} style={$.legLink}>Privacy</Text>
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const $ = StyleSheet.create({
  root: { flex: 1 },
  pg: { width: W, height: H },
  flex1: { flex: 1 },
  flagBar: { position: 'absolute', bottom: 0, left: 0, height: 3, zIndex: 5, overflow: 'hidden' },

  page: { flex: 1, paddingLeft: 28, paddingRight: 28, paddingBottom: 120 },
  pageCentered: { flex: 1, justifyContent: 'center', paddingLeft: 28, paddingRight: 28, paddingTop: 40, paddingBottom: 140 },

  // ── Page 1 ──
  h1: {
    fontSize: 40, lineHeight: 46, letterSpacing: -1.3,
    fontWeight: '900', fontFamily: FontFamily.black, color: '#1A1A1A',
    marginBottom: 6,
  },
  h1Gold: {
    color: '#CE1126',
    textShadowColor: 'rgba(206,17,38,0.08)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  p1Sub: {
    fontSize: 16, lineHeight: 24, fontFamily: FontFamily.regular,
    color: 'rgba(0,0,0,0.35)',
  },
  flagWrap: {
    borderRadius: 4, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },

  // ── Page 2 ──
  p2Lead: {
    fontSize: 18, lineHeight: 26, fontFamily: FontFamily.medium,
  },
  featList: {
    gap: 0,
    borderWidth: 0,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  featRow: {
    flexDirection: 'row', alignItems: 'center', gap: 18,
    paddingVertical: 22, paddingHorizontal: 16,
    borderBottomWidth: 0,
  },
  featRowLast: {
    borderBottomWidth: 0,
  },
  featDot: {
    width: 50, height: 50, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  featText: { flex: 1 },
  featT: {
    fontSize: 20, fontWeight: '700', fontFamily: FontFamily.bold,
    marginBottom: 4,
  },
  featD: {
    fontSize: 15, fontFamily: FontFamily.regular,
    lineHeight: 21,
  },

  // ── Page 3 ──
  h3: {
    fontSize: 46, lineHeight: 52, letterSpacing: -1.5,
    fontWeight: '900', fontFamily: FontFamily.black, color: '#1A1A1A',
  },
  p3Sub: {
    fontSize: 17, lineHeight: 26, fontFamily: FontFamily.regular,
    color: 'rgba(0,0,0,0.35)',
  },
  diaspora: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: FontFamily.medium,
  },
  homeLine: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FontFamily.regular,
  },
  p3Big: {
    fontSize: 32, lineHeight: 40, letterSpacing: -1,
    fontWeight: '900', fontFamily: FontFamily.black, color: '#1A1A1A',
  },
  p3BigAccent: {
    color: '#CE1126',
  },

  // ── Chrome ──
  top: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24,
  },
  skip: { fontSize: 13, fontFamily: FontFamily.medium, color: 'rgba(0,0,0,0.3)' },

  bot: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 24, zIndex: 20,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginBottom: 16 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(0,0,0,0.12)' },
  dotOn: { width: 20, backgroundColor: '#CE1126' },

  cta: {
    borderRadius: 28, overflow: 'hidden', marginBottom: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
  },
  ctaIn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 54, borderRadius: 28, backgroundColor: '#1A1A1A',
  },
  ctaT: { fontSize: 16, fontWeight: '700', fontFamily: FontFamily.bold, color: '#FFFFFF' },

  si: { alignItems: 'center', paddingVertical: 10 },
  siT: { fontSize: 13, fontFamily: FontFamily.regular, color: 'rgba(0,0,0,0.3)' },
  siB: { color: 'rgba(0,0,0,0.6)', fontFamily: FontFamily.semibold },
  leg: { fontSize: 10, color: 'rgba(0,0,0,0.15)', textAlign: 'center', fontFamily: FontFamily.regular },
  legLink: {
    textDecorationLine: 'underline',
  },
  ctaHidden: {
    opacity: 0,
  },
});
