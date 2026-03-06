// AnaJunubin — Profile Detail Screen

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GraffitiHeart, GraffitiSparkles, GraffitiStickerIcon, GraffitiShield } from '../components/icons';
import { SpraySplatter } from '../components/GraffitiAccents';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FontFamily, getShadow } from '../theme';
import { imageSource } from '../utils/imageSource';
import { useSubscription } from '../payments';
import { useAuth } from '../auth';
import * as discoverService from '../api/services/discoverService';
import AdBanner from '../components/AdBanner';
import { getEthnicIdentity } from '../utils/ethnicIdentity';

const SW = Dimensions.get('window').width;
const PHOTO_H = SW * 1.3;

const PhotoItem = ({ uri, name, width }) => {
  const [err, setErr] = useState(false);
  const { colors } = useTheme();
  if (err || !uri) {
    return (
      <View style={{ width, height: PHOTO_H, backgroundColor: colors.gray300, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 80, fontWeight: '900', fontFamily: FontFamily.black, color: colors.accent, opacity: 0.4 }}>
          {name ? name.charAt(0).toUpperCase() : '?'}
        </Text>
      </View>
    );
  }
  return (
    <View style={{ width, height: PHOTO_H }}>
      <Image source={imageSource(uri)} style={{ width: '100%', height: '100%' }} resizeMode="cover" onError={() => setErr(true)} fadeDuration={0} />
    </View>
  );
};

const ProfileDetailScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const s = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const profile = route.params?.profile || {};
  const fromLikes = route.params?.fromLikes || false;
  const [photoIdx, setPhotoIdx] = useState(0);
  const { consumeSuperLike, superLikes, hasTier } = useSubscription();
  const { session } = useAuth();

  const handlePass = () => { if (session && profile.id) discoverService.recordSwipe(profile.id, 'pass').catch((e) => { if (__DEV__) console.warn('Pass swipe failed:', e); }); navigation.goBack(); };
  const handleLike = () => {
    if (session && profile.id) {
      discoverService.recordSwipe(profile.id, 'like').then((r) => {
        if (r?.match) Alert.alert('It\'s a Match!', `You and ${profile.name} liked each other!`);
      }).catch((e) => { if (__DEV__) console.warn('Like swipe failed:', e); });
    }
    navigation.goBack();
  };
  const handleMatchAndChat = () => {
    if (session && profile.id) {
      discoverService.recordSwipe(profile.id, 'like').then(() => {
        navigation.replace('Chat', { match: profile });
      }).catch((e) => {
        if (__DEV__) console.warn('Match swipe failed:', e);
        navigation.replace('Chat', { match: profile });
      });
    } else {
      navigation.replace('Chat', { match: profile });
    }
  };
  const handleSuperLike = () => {
    if (superLikes <= 0) { Alert.alert('No Super Likes', 'You\'re out of Super Likes!', [{ text: 'Get More', onPress: () => { navigation.goBack(); navigation.navigate('Boost'); } }, { text: 'Cancel', style: 'cancel' }]); return; }
    consumeSuperLike();
    if (session && profile.id) discoverService.recordSwipe(profile.id, 'super_like').catch((e) => { if (__DEV__) console.warn('Super like failed:', e); });
    navigation.goBack();
  };

  // Section entrance animations
  const factsAnim = useRef(new Animated.Value(0)).current;
  const promptAnim = useRef(new Animated.Value(0)).current;
  const aboutAnim = useRef(new Animated.Value(0)).current;
  const sectionsAnim = useRef(new Animated.Value(0)).current;
  const actionBarAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(50, [
      Animated.timing(factsAnim, { toValue: 1, duration: 280, delay: 100, useNativeDriver: true }),
      Animated.timing(promptAnim, { toValue: 1, duration: 280, delay: 200, useNativeDriver: true }),
      Animated.timing(aboutAnim, { toValue: 1, duration: 280, delay: 250, useNativeDriver: true }),
      Animated.timing(sectionsAnim, { toValue: 1, duration: 280, delay: 300, useNativeDriver: true }),
      Animated.spring(actionBarAnim, { toValue: 1, tension: 68, friction: 10, delay: 200, useNativeDriver: true }),
    ]).start();
  }, [factsAnim, promptAnim, aboutAnim, sectionsAnim, actionBarAnim]);

  const { name = 'User', age = 0, distance = 0, verified = false, bio = '', about = '', job = '', school = '', images = [], interests = [], stickers = [], height = '', lookingFor = '', ethnicity = '', intention = '', pronouns = '', education = '', children = '', promptQuestion = '', promptAnswer = '', currentlyInto = [] } = profile;

  const pQ = promptQuestion || 'The perfect date would be';
  const pA = promptAnswer || bio || about || 'Going on a late drive and getting food while we talk.';
  const gallery = (() => { const src = (images || []).filter(Boolean); if (!src.length) return []; const f = [...src]; let i = 0; while (f.length < 3) { f.push(src[i % src.length]); i++; } return f; })();
  const onScroll = useCallback((e) => setPhotoIdx(Math.round(e.nativeEvent.contentOffset.x / SW)), []);

  // Quick facts — compact inline items
  const quickFacts = [
    age && `${age}`,
    pronouns,
    height,
    distance && `${distance} mi`,
  ].filter(Boolean);

  return (
    <View style={s.root}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} bounces>
        {/* ── Photo with gradient bleed ── */}
        <View style={s.photoWrap}>
          <FlatList data={gallery} horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={16} onScroll={onScroll} keyExtractor={(_, i) => `p${i}`} maxToRenderPerBatch={3} renderItem={({ item }) => <PhotoItem uri={item} name={name} width={SW} />} />

          <TouchableOpacity style={[s.backBtn, { top: insets.top + 10 }]} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={26} color="#FFF" />
          </TouchableOpacity>

          {gallery.length > 1 && (
            <View style={s.dots}>
              {gallery.map((_, i) => <View key={i} style={[s.dot, i === photoIdx ? s.dotOn : s.dotOff]} />)}
            </View>
          )}

          {/* Gradient that bleeds into the info area */}
          <LinearGradient
            colors={['transparent', isDark ? colors.cream : colors.creamDark]}
            style={s.photoGradient}
            pointerEvents="none"
          />

          {/* Name overlays the bottom of the photo */}
          <View style={s.nameOverlay}>
            <View style={s.nameRow}>
              <Text style={s.nameText}>{name}, {age}</Text>
              {verified && <Ionicons name="checkmark-circle" size={20} color={colors.accent} style={{ marginLeft: 5 }} />}
            </View>
            {(job || school || education) && (
              <Text style={s.subtitleText}>
                {job}{job && (school || education) ? '  ·  ' : ''}{school || education}
              </Text>
            )}
          </View>
        </View>

        <View style={s.body}>
          {/* ── Quick facts row ── */}
          <Animated.View style={{
            opacity: factsAnim,
            transform: [{ translateY: factsAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          }}>
            <View style={s.factsRow}>
              {quickFacts.map((f, i) => (
                <View key={i} style={s.factPill}>
                  <Text style={s.factText}>{f}</Text>
                </View>
              ))}
              {ethnicity ? (() => {
                const eth = getEthnicIdentity(ethnicity);
                return (
                  <View style={[s.factPill, { borderColor: eth.color, backgroundColor: eth.tint }]}>
                    <Text style={{ fontSize: 14 }}>{eth.emoji}</Text>
                    <Text style={[s.factText, { color: eth.color }]}>{eth.label}</Text>
                  </View>
                );
              })() : null}
              {(intention || lookingFor) ? (
                <View style={[s.factPill, s.factFilled]}>
                  <GraffitiHeart size={12} color="#FFF" filled />
                  <Text style={s.factFilledText}>{intention || lookingFor}</Text>
                </View>
              ) : null}
              {children ? (
                <View style={s.factPill}>
                  <Text style={s.factText}>{children}</Text>
                </View>
              ) : null}
            </View>
          </Animated.View>

          {/* Tribal divider accent */}


          {/* ── Prompt — the hero card ── */}
          <Animated.View style={{
            opacity: promptAnim,
            transform: [{ scale: promptAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
          }}>
            <View style={s.promptCard}>
              <Text style={s.promptQ}>{pQ}</Text>
              <Text style={s.promptA}>{pA}</Text>
            </View>
          </Animated.View>

          {/* ── About ── */}
          {(about || bio) ? (
            <Animated.View style={{ opacity: aboutAnim }}>
              <View style={s.aboutSection}>
                <Text style={s.aboutText}>{about || bio}</Text>
              </View>
            </Animated.View>
          ) : null}

          {/* ── Interests ── */}
          {interests.length > 0 && (
            <Animated.View style={{
              opacity: sectionsAnim,
              transform: [{ translateY: sectionsAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }}>
              <View style={s.section}>
                <Text style={s.sectionLabel}>Interests</Text>
                <View style={s.pillRow}>
                  {interests.map((item, i) => (
                    <View key={i} style={s.interestPill}>
                      <Text style={s.interestText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Animated.View>
          )}

          {/* ── Currently Into ── */}
          {currentlyInto?.length > 0 && (
            <Animated.View style={{
              opacity: sectionsAnim,
              transform: [{ translateY: sectionsAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }}>
              <View style={s.section}>
                <Text style={s.sectionLabel}>Currently Into</Text>
                <View style={s.pillRow}>
                  {currentlyInto.map((item, i) => (
                    <View key={i} style={s.intoPill}>
                      <Text style={s.intoText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Animated.View>
          )}

          {/* ── Identity — large emoji circles ── */}
          {stickers.length > 0 && (
            <Animated.View style={{
              opacity: sectionsAnim,
              transform: [{ translateY: sectionsAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }}>
              <View style={s.section}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <GraffitiShield size={16} color={colors.accent} filled />
                  <Text style={s.sectionLabel}>Identity</Text>
                </View>
                <View style={s.stickerRow}>
                  {stickers.map((st, i) => {
                    const eth = getEthnicIdentity(st.label);
                    const isEthnic = ['Dinka','Nuer','Shilluk','Bari','Zande','Acholi','Murle','Toposa','Lotuko','Madi','Luo'].includes(st.label);
                    const ringColor = isEthnic ? eth.color : colors.accentTint25;
                    const bgColor = isEthnic ? eth.tint : (isDark ? 'rgba(255,255,255,0.06)' : colors.accentTint08);
                    const iconColor = isEthnic ? eth.color : colors.accent;
                    return (
                      <View key={i} style={s.stickerItem}>
                        <View style={[s.stickerCircle, { borderColor: ringColor, backgroundColor: bgColor }]}>
                          {GraffitiStickerIcon.has(st.emoji) ? (
                            <GraffitiStickerIcon emoji={st.emoji} size={26} color={iconColor} />
                          ) : (
                            <Text style={s.stickerEmoji}>{st.emoji}</Text>
                          )}
                        </View>
                        <Text style={[s.stickerLabel, isEthnic && { color: eth.color }]}>{st.label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </Animated.View>
          )}

          {/* ── Ad Banner ── */}
          <AdBanner colors={colors} style={{ marginBottom: 12 }} />

          <View style={{ height: 110 }} />
        </View>
      </ScrollView>

      {/* ── Bottom Action Bar ── */}
      <Animated.View style={[
        s.actionBar,
        { paddingBottom: insets.bottom + 12 },
        {
          opacity: actionBarAnim,
          transform: [{
            translateY: actionBarAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [60, 0],
            }),
          }],
        },
      ]}>
        {fromLikes ? (
          <>
            <TouchableOpacity style={s.passBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
              <Ionicons name="close" size={28} color={colors.rose} />
            </TouchableOpacity>
            <TouchableOpacity style={s.matchBtn} onPress={handleMatchAndChat} activeOpacity={0.8}>
              <Ionicons name="chatbubble-ellipses" size={20} color="#FFF" />
              <Text style={s.likeBtnText}>Match & Chat</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={s.passBtn} onPress={handlePass} activeOpacity={0.7}>
              <Ionicons name="close" size={28} color={colors.rose} />
            </TouchableOpacity>
            <TouchableOpacity style={s.likeBtn} onPress={handleLike} activeOpacity={0.8}>
              <GraffitiHeart size={22} color="#FFF" filled />
              <Text style={s.likeBtnText}>Like</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.superBtn} onPress={handleSuperLike} activeOpacity={0.7}>
              <GraffitiSparkles size={22} color={colors.accent} filled />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.challengeBtn}
              onPress={() => {
                if (!hasTier('plus')) {
                  Alert.alert('JuNubin+ Feature', 'In-chat games require JuNubin+ or higher.', [
                    { text: 'Upgrade', onPress: () => navigation.navigate('Elite') },
                    { text: 'Cancel', style: 'cancel' },
                  ]);
                  return;
                }
                navigation.navigate('Chat', { match: profile, startGame: true });
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="game-controller" size={20} color="#FFD700" />
            </TouchableOpacity>
          </>
        )}
      </Animated.View>
    </View>
  );
};

const getStyles = (colors, isDark) => StyleSheet.create({
  root: { flex: 1, backgroundColor: isDark ? colors.cream : colors.creamDark },

  // ── Photo ──
  photoWrap: { width: SW, height: PHOTO_H, backgroundColor: colors.gray200 },
  backBtn: { position: 'absolute', left: 14, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  dots: { position: 'absolute', bottom: 70, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6, zIndex: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { backgroundColor: '#FFF', shadowColor: '#FFF', shadowOpacity: 0.8, shadowRadius: 4 },
  dotOff: { backgroundColor: 'rgba(255,255,255,0.4)' },
  photoGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 160 },
  nameOverlay: { position: 'absolute', bottom: 16, left: 20, right: 20, zIndex: 5 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  nameText: { fontSize: 30, fontWeight: '800', fontFamily: FontFamily.extrabold, color: '#FFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  subtitleText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontFamily: FontFamily.semibold, marginTop: 4, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },

  // ── Body ──
  body: { paddingHorizontal: 18, marginTop: -4 },

  // ── Quick facts ──
  factsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20, marginTop: 8 },
  factPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.white, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.gray200 },
  factText: { fontSize: 13, fontWeight: '600', fontFamily: FontFamily.semibold, color: colors.black },
  factAccent: { borderColor: colors.accent, backgroundColor: isDark ? colors.accentTint10 : colors.accentTint06 },
  factFilled: { backgroundColor: colors.accent, borderColor: colors.accent },
  factFilledText: { fontSize: 13, fontWeight: '700', fontFamily: FontFamily.bold, color: '#FFF' },

  // ── Prompt — hero card ──
  promptCard: {
    backgroundColor: isDark ? colors.accentTint12 : colors.accentTint08,
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: isDark ? colors.accentTint25 : colors.accentTint15,
  },
  promptQ: { fontSize: 12, fontWeight: '600', fontFamily: FontFamily.semibold, color: colors.accent, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },
  promptA: { fontSize: 22, lineHeight: 32, fontWeight: '700', fontFamily: FontFamily.bold, color: colors.black, fontStyle: 'italic' },

  // ── About ──
  aboutSection: { marginBottom: 20 },
  aboutText: { fontSize: 16, lineHeight: 26, color: colors.gray600, fontFamily: FontFamily.regular },

  // ── Sections ──
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '700', fontFamily: FontFamily.bold, color: colors.gray400, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  interestPill: { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.white, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.gray200 },
  interestText: { color: colors.black, fontSize: 14, fontWeight: '600', fontFamily: FontFamily.semibold },

  intoPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1.5, borderColor: colors.accent, backgroundColor: 'transparent' },
  intoText: { color: colors.accent, fontSize: 13, fontWeight: '700', fontFamily: FontFamily.bold },

  // ── Identity — circles ──
  stickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  stickerItem: { alignItems: 'center', gap: 6 },
  stickerCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.accentTint08, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: isDark ? colors.accentTint25 : colors.accentTint25, borderStyle: 'dashed' },
  stickerEmoji: { fontSize: 24 },
  stickerLabel: { fontSize: 11, fontWeight: '700', fontFamily: FontFamily.bold, color: colors.gray500 },

  // ── Action Bar ──
  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.95)', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, paddingHorizontal: 24, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.08)' },
  passBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(201,93,79,0.12)', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(201,93,79,0.2)' },
  likeBtn: { flex: 1, height: 54, backgroundColor: colors.accent, borderRadius: 27, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 8 },
  matchBtn: { flex: 1, height: 54, backgroundColor: '#22C55E', borderRadius: 27, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, shadowColor: '#22C55E', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 8 },
  likeBtnText: { color: '#FFF', fontSize: 17, fontWeight: '700', fontFamily: FontFamily.bold, letterSpacing: 0.5 },
  superBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.roseTint12, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: colors.roseTint20 },
  challengeBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,215,0,0.12)', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(255,215,0,0.25)' },
});

export default ProfileDetailScreen;
