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
import { FontFamily } from '../theme';
import LogoMark from '../components/LogoMark';
import { useAccessibilityPreferences } from '../accessibility';
import { useAuth } from '../auth';

const { width: W, height: H } = Dimensions.get('window');
const PG = 3;

const CITIES = [
  'Juba', 'London', 'Minneapolis', 'Nairobi', 'Sydney', 'Kampala',
  'Melbourne', 'Dallas', 'Toronto', 'Khartoum', 'Nashville', 'Cairo',
  'Addis Ababa', 'Manchester', 'Amsterdam', 'Perth', 'Brisbane',
  'Juba', 'London', 'Minneapolis', 'Nairobi', 'Sydney', 'Kampala',
];
const LH = 62;

const CityTicker = ({ active }) => {
  const y = useRef(new Animated.Value(0)).current;
  const loop = useRef(null);
  useEffect(() => {
    if (!active) { y.setValue(0); loop.current?.stop(); return; }
    const n = CITIES.length - 6;
    loop.current = Animated.loop(Animated.timing(y, { toValue: -(n * LH), duration: n * 1800, useNativeDriver: true }));
    const t = setTimeout(() => loop.current?.start(), 300);
    return () => { clearTimeout(t); loop.current?.stop(); };
  }, [active, y]);
  return (
    <View style={{ height: 6 * LH, overflow: 'hidden' }}>
      <Animated.View style={{ transform: [{ translateY: y }] }}>
        {CITIES.map((c, i) => (
          <Animated.Text key={`${c}${i}`} style={[$.city, {
            opacity: y.interpolate({
              inputRange: [-(i + 4) * LH, -(i + 3) * LH, -(i + 1) * LH, -i * LH],
              outputRange: [0.03, 0.08, 0.3, 1], extrapolate: 'clamp',
            }),
          }]}>{c}</Animated.Text>
        ))}
      </Animated.View>
      <LinearGradient colors={['#080808', 'transparent']} style={$.tickFadeTop} pointerEvents="none" />
      <LinearGradient colors={['transparent', '#080808']} style={$.tickFadeBot} pointerEvents="none" />
    </View>
  );
};

// ── Graphic feature card — each one is a mini illustration ──
const FeatureVis = ({ icon, iconColor, iconBg, label, desc, accent }) => (
  <View style={$.feat}>
    {/* Graphic circle with icon — the "illustration" */}
    <View style={$.featVisual}>
      <View style={[$.featRing, { borderColor: accent + '18' }]}>
        <View style={[$.featCircle, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={28} color={iconColor} />
        </View>
      </View>
      {/* Decorative arcs */}
      <View style={[$.featArc, $.featArc1, { borderColor: accent + '10' }]} />
      <View style={[$.featArc, $.featArc2, { borderColor: accent + '08' }]} />
    </View>
    <Text style={$.featLabel}>{label}</Text>
    <Text style={$.featDesc}>{desc}</Text>
  </View>
);

export default function OnboardingScreen({ navigation }) {
  const { prefs } = useAccessibilityPreferences();
  const { isAuthenticated, setDevBypass } = useAuth();
  const [pg, setPg] = useState(0);
  const sx = useRef(new Animated.Value(0)).current;
  const sr = useRef(null);
  const ins = useSafeAreaInsets();

  useEffect(() => { if (isAuthenticated) navigation.replace('Main'); }, [isAuthenticated, navigation]);

  // Staggered entrance — 4 beats
  const e1 = useRef(new Animated.Value(0)).current;
  const e2 = useRef(new Animated.Value(0)).current;
  const e3 = useRef(new Animated.Value(0)).current;
  const e4 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const t = prefs?.reducedMotion ? 60 : 180;
    Animated.stagger(t, [
      Animated.spring(e1, { toValue: 1, tension: 35, friction: 7, useNativeDriver: true }),
      Animated.spring(e2, { toValue: 1, tension: 32, friction: 7, useNativeDriver: true }),
      Animated.spring(e3, { toValue: 1, tension: 29, friction: 7, useNativeDriver: true }),
      Animated.spring(e4, { toValue: 1, tension: 26, friction: 7, useNativeDriver: true }),
    ]).start();
  }, []);

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: sx } } }],
    { useNativeDriver: false, listener: (ev) => setPg(Math.round(ev.nativeEvent.contentOffset.x / W)) },
  );
  const next = useCallback(() => {
    if (pg < PG - 1) sr.current?.scrollTo({ x: W * (pg + 1), animated: true });
    else navigation.navigate('Signup');
  }, [pg, navigation]);
  const signup = useCallback(() => navigation.navigate('Signup'), [navigation]);

  const pf = (i) => ({
    op: sx.interpolate({ inputRange: [(i - 1) * W, i * W, (i + 1) * W], outputRange: [0, 1, 0], extrapolate: 'clamp' }),
    ty: sx.interpolate({ inputRange: [(i - 1) * W, i * W, (i + 1) * W], outputRange: [50, 0, -50], extrapolate: 'clamp' }),
  });
  const f1 = pf(1), f2 = pf(2);

  const flagW = sx.interpolate({ inputRange: [0, W * (PG - 1)], outputRange: [48, W], extrapolate: 'clamp' });

  const anim = (a) => ({
    opacity: a,
    transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
  });

  return (
    <View style={$.root}>
      <LinearGradient colors={['#080808', '#0A0808', '#080808']} style={StyleSheet.absoluteFill} />

      {/* Flag bar */}
      <Animated.View style={[$.flagBar, { width: flagW }]}>
        <LinearGradient colors={['#CE1126','#CE1126','#FCCD12','#009739','#0047AB']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <ScrollView
        ref={sr} horizontal pagingEnabled scrollEventThrottle={16}
        onScroll={onScroll} showsHorizontalScrollIndicator={false}
        style={StyleSheet.absoluteFill} contentContainerStyle={{ width: W * PG }}
      >
        {/* ═══ PAGE 1 — Identity ═══ */}
        <View style={$.pg}>
          <View style={[$.page, { paddingTop: ins.top + H * 0.12 }]}>

            <Animated.View style={anim(e1)}>
              <LogoMark size={72} light />
            </Animated.View>

            <View style={{ height: H * 0.06 }} />

            <Animated.View style={anim(e2)}>
              <Text style={$.h1}>
                Where{'\n'}Junubin{'\n'}
                <Text style={$.h1Gold}>connect.</Text>
              </Text>
            </Animated.View>

            <View style={{ height: 24 }} />

            <Animated.View style={anim(e3)}>
              <Text style={$.p1Sub}>
                The app built by us, for us.{'\n'}Community first. Always.
              </Text>
            </Animated.View>

            <View style={{ flex: 1 }} />

            <Animated.View style={[anim(e4), { alignItems: 'flex-start' }]}>
              <View style={$.flag}>
                {['#1A1A1A','#CE1126','#FCCD12','#009739','#0047AB'].map((c, i) => (
                  <View key={i} style={{ flex: i === 2 ? 0.5 : 1, backgroundColor: c, height: '100%' }} />
                ))}
              </View>
            </Animated.View>

          </View>
        </View>

        {/* ═══ PAGE 2 — Features with graphic cards ═══ */}
        <View style={$.pg}>
          <View style={[$.page, { paddingTop: ins.top + H * 0.08 }]}>
            <Animated.View style={[$.flex1, { opacity: f1.op, transform: [{ translateY: f1.ty }] }]}>

              <Text style={$.h2}>
                More than{'\n'}an app.
              </Text>
              <View style={{ height: 6 }} />
              <Text style={$.p2Sub}>
                A space that moves with you.
              </Text>

              <View style={{ flex: 1, justifyContent: 'center' }} />

              {/* 2x2 graphic feature grid */}
              <View style={$.featGrid}>
                <FeatureVis
                  icon="people" iconColor="#FFF" iconBg="#CE1126"
                  accent="#CE1126"
                  label="Community" desc="Your tribe, organized"
                />
                <FeatureVis
                  icon="chatbubbles" iconColor="#FFF" iconBg="#F0A030"
                  accent="#F0A030"
                  label="Socialize" desc="Friends, not followers"
                />
                <FeatureVis
                  icon="globe" iconColor="#FFF" iconBg="#009739"
                  accent="#009739"
                  label="Network" desc="Junubin in every field"
                />
                <FeatureVis
                  icon="heart" iconColor="#FFF" iconBg="#FCCD12"
                  accent="#FCCD12"
                  label="Dating" desc="When you're ready"
                />
              </View>

              <View style={{ height: 8 }} />

            </Animated.View>
          </View>
        </View>

        {/* ═══ PAGE 3 — Cities ═══ */}
        <View style={$.pg}>
          <View style={[$.page, { paddingTop: ins.top + H * 0.08 }]}>
            <Animated.View style={[$.flex1, { opacity: f2.op, transform: [{ translateY: f2.ty }] }]}>

              <Text style={$.eyebrow}>WE'RE EVERYWHERE</Text>
              <View style={{ height: 12 }} />

              <CityTicker active={pg === 2} />

              <View style={{ flex: 1 }} />

              <Text style={$.closing}>
                Wherever you landed,{'\n'}
                your people are already there.
              </Text>
              <Text style={$.closingGold}>Come find them.</Text>

              <View style={{ height: 4 }} />

            </Animated.View>
          </View>
        </View>

      </ScrollView>

      {/* Top bar */}
      <View style={[$.top, { paddingTop: ins.top + 6 }]}>
        <Animated.View style={{ opacity: sx.interpolate({ inputRange: [0, W * 0.3], outputRange: [0, 1], extrapolate: 'clamp' }) }}>
          <LogoMark size={22} light />
        </Animated.View>
        {__DEV__ && pg < PG - 1 && (
          <TouchableOpacity testID="onboarding-skip" onPress={() => setDevBypass(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={$.skip}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Bottom */}
      <Animated.View style={[$.bot, { paddingBottom: ins.bottom + 12, opacity: e4, transform: [{ translateY: e4.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}>
        <View style={$.dots}>
          {Array.from({ length: PG }).map((_, i) => (
            <View key={i} style={[$.dot, pg === i && $.dotOn]} />
          ))}
        </View>

        <TouchableOpacity style={$.cta} onPress={next} activeOpacity={0.92}>
          <LinearGradient colors={['#FFFFFF', '#F0F0F0']} style={$.ctaIn}>
            <Text style={$.ctaT}>{pg === PG - 1 ? 'Get Started' : 'Continue'}</Text>
            <Ionicons name="arrow-forward" size={16} color="#080808" />
          </LinearGradient>
        </TouchableOpacity>

        {pg === PG - 1 ? (
          <TouchableOpacity onPress={signup} style={$.si} activeOpacity={0.7}>
            <Text style={$.siT}>Already a member? <Text style={$.siB}>Sign in</Text></Text>
          </TouchableOpacity>
        ) : <View style={{ height: 28 }} />}

        <Text style={$.leg}>Terms & Privacy</Text>
      </Animated.View>
    </View>
  );
}

const FEAT_W = (W - 56 - 14) / 2;

const $ = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080808' },
  pg: { width: W, height: H },
  flex1: { flex: 1 },
  flagBar: { position: 'absolute', bottom: 0, left: 0, height: 3, zIndex: 5, overflow: 'hidden' },

  page: { flex: 1, paddingLeft: 28, paddingRight: 28, paddingBottom: 186 },

  // ── Page 1 ──
  h1: {
    fontSize: 52, lineHeight: 58, letterSpacing: -2,
    fontWeight: '900', fontFamily: FontFamily.black, color: '#FFFFFF',
  },
  h1Gold: {
    color: '#FCCD12',
    textShadowColor: 'rgba(252,205,18,0.12)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 28,
  },
  p1Sub: {
    fontSize: 17, lineHeight: 26, fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.3)',
  },
  flag: {
    flexDirection: 'row', width: 72, height: 4, borderRadius: 2, overflow: 'hidden',
  },

  // ── Page 2 ──
  h2: {
    fontSize: 44, lineHeight: 50, letterSpacing: -1.5,
    fontWeight: '900', fontFamily: FontFamily.black, color: '#FFFFFF',
  },
  p2Sub: {
    fontSize: 16, lineHeight: 24, fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.25)',
  },

  // Feature grid — graphic cards
  featGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 14,
  },
  feat: {
    width: FEAT_W,
    paddingTop: 18, paddingBottom: 16, paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  featVisual: {
    width: 56, height: 56,
    marginBottom: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featRing: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  featCircle: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  featArc: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 999,
  },
  featArc1: {
    width: 72, height: 72, top: -8, left: -8,
  },
  featArc2: {
    width: 88, height: 88, top: -16, left: -16,
  },
  featLabel: {
    fontSize: 16, fontWeight: '700', fontFamily: FontFamily.bold,
    color: '#FFFFFF', marginBottom: 4,
  },
  featDesc: {
    fontSize: 12, fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.3)', lineHeight: 17,
  },

  // ── Page 3 ──
  eyebrow: {
    fontSize: 11, fontWeight: '700', fontFamily: FontFamily.bold,
    color: 'rgba(255,255,255,0.2)', letterSpacing: 3,
  },
  city: {
    fontSize: 56, lineHeight: LH, letterSpacing: -2.2,
    fontWeight: '900', fontFamily: FontFamily.black, color: '#FFFFFF',
  },
  tickFadeTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: LH * 0.8,
  },
  tickFadeBot: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: LH * 1.5,
  },
  closing: {
    fontSize: 18, lineHeight: 28, fontFamily: FontFamily.regular,
    color: 'rgba(255,255,255,0.3)',
  },
  closingGold: {
    fontSize: 18, lineHeight: 28, fontWeight: '700', fontFamily: FontFamily.bold,
    color: '#FCCD12', marginTop: 2,
  },

  // ── Chrome ──
  top: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24,
  },
  skip: { fontSize: 13, fontFamily: FontFamily.medium, color: 'rgba(255,255,255,0.25)' },

  bot: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 24, zIndex: 20,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginBottom: 16 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.1)' },
  dotOn: { width: 20, backgroundColor: '#FCCD12' },

  cta: {
    borderRadius: 28, overflow: 'hidden', marginBottom: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 16, elevation: 10,
  },
  ctaIn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, height: 54, borderRadius: 28,
  },
  ctaT: { fontSize: 16, fontWeight: '700', fontFamily: FontFamily.bold, color: '#080808' },

  si: { alignItems: 'center', paddingVertical: 10 },
  siT: { fontSize: 13, fontFamily: FontFamily.regular, color: 'rgba(255,255,255,0.2)' },
  siB: { color: 'rgba(255,255,255,0.5)', fontFamily: FontFamily.semibold },
  leg: { fontSize: 10, color: 'rgba(255,255,255,0.07)', textAlign: 'center', fontFamily: FontFamily.regular },
});
