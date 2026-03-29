// JuNubin — Profile Detail Screen

import React, { useMemo, useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GraffitiHeart, GraffitiSparkles } from '../components/icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FontFamily } from '../theme';
import { imageSource } from '../utils/imageSource';
import { useSubscription, canUseWhispers } from '../payments';
import { useAuth } from '../auth';
import * as discoverService from '../api/services/discoverService';
import AdBanner from '../components/AdBanner';
import { getEthnicIdentity } from '../utils/ethnicIdentity';
import { useFollow } from '../hooks/useFollow';
import { getCountryByCode } from '../data/countries';

const SW = Dimensions.get('window').width;
const PHOTO_H = SW * 1.3;

const PhotoItem = ({ uri, name, width }) => {
  const [err, setErr] = useState(false);
  const { colors } = useTheme();
  if (err || !uri) {
    return (
      <View style={{ width, height: PHOTO_H, backgroundColor: colors.gray300, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 80, fontWeight: '900', fontFamily: FontFamily.black, color: colors.gray400, opacity: 0.4 }}>
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
  const { consumeSuperLike, superLikes, hasTier, whispers, consumeWhisper, tier } = useSubscription();
  const { session } = useAuth();
  const { isFollowing, isFriend, counts: followCounts, toggleFollow } = useFollow(profile.id);

  const goBackWithSwipe = (direction) => {
    navigation.navigate({ name: 'Main', params: { screen: 'Home', params: { swipeAction: direction, swipedProfileId: profile.id } }, merge: true });
  };

  const handlePass = () => {
    if (session && profile.id) discoverService.recordSwipe(profile.id, 'pass').catch((e) => { if (__DEV__) console.warn('Pass swipe failed:', e); });
    goBackWithSwipe('left');
  };
  const handleLike = () => {
    if (session && profile.id) {
      discoverService.recordSwipe(profile.id, 'like').then((r) => {
        if (r?.match) Alert.alert('It\'s a Match!', `You and ${profile.name} liked each other!`);
      }).catch((e) => { if (__DEV__) console.warn('Like swipe failed:', e); });
    }
    goBackWithSwipe('right');
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
  const handleWhisper = () => {
    if (!canUseWhispers(tier || 'free')) {
      Alert.alert('JuNubin+ Feature', 'Whispers let you message before matching. Upgrade to JuNubin+ to unlock.', [
        { text: 'See Plans', onPress: () => navigation.navigate('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    if (whispers <= 0) {
      Alert.alert('No Whispers', 'You\'re out of whispers!', [
        { text: 'Get More', onPress: () => navigation.navigate('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    consumeWhisper();
    navigation.navigate('Chat', { match: profile, whisper: true });
  };

  const handleSuperLike = () => {
    if (superLikes <= 0) { Alert.alert('No Super Likes', 'You\'re out of Super Likes!', [{ text: 'Get More', onPress: () => { navigation.goBack(); navigation.navigate('Boost'); } }, { text: 'Cancel', style: 'cancel' }]); return; }
    const consumed = consumeSuperLike();
    if (consumed === false) return;
    if (session && profile.id) discoverService.recordSwipe(profile.id, 'super_like').catch((e) => { if (__DEV__) console.warn('Super like failed:', e); });
    goBackWithSwipe('right');
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
  const gallery = (() => { const src = (images || []).filter(Boolean); if (!src.length) return []; const f = [...src]; let i = 0; while (f.length < 6) { f.push(src[i % src.length]); i++; } return f; })();

  // Quick facts — compact inline items (age already shown in name overlay, skip it)
  const countryInfo = getCountryByCode(profile.country);
  const quickFacts = [
    pronouns,
    height,
    distance && `${distance} mi`,
  ].filter(Boolean);

  // Inline photo component — card-style with rounded corners
  const InlinePhoto = ({ index }) => {
    if (!gallery[index]) return null;
    return (
      <View style={s.inlinePhotoCard}>
        <PhotoItem uri={gallery[index]} name={name} width={SW - 36} />
      </View>
    );
  };

  return (
    <View style={s.root}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} bounces={false}>
        {/* ── Photo 1 — Hero with name overlay ── */}
        <View style={s.photoWrap}>
          <PhotoItem uri={gallery[0]} name={name} width={SW} />

          <TouchableOpacity style={[s.backBtn, { top: insets.top + 10 }]} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={26} color="#FFF" />
          </TouchableOpacity>

          {/* Gradient that bleeds into the info area */}
          <LinearGradient
            colors={['transparent', isDark ? colors.cream : colors.creamDark]}
            style={s.photoGradient}
            pointerEvents="none"
          />

          {/* Name overlays the bottom of the photo */}
          <View style={s.nameOverlay}>
            <View style={s.nameRow}>
              <Text style={s.nameText}>{name}, {age} {countryInfo?.flag || ''}</Text>
              {verified && <Ionicons name="checkmark-circle" size={20} color={colors.black} style={{ marginLeft: 5 }} />}
            </View>
            {(job || school || education) && (
              <Text style={s.subtitleText}>
                {job}{job && (school || education) ? '  ·  ' : ''}{school || education}
              </Text>
            )}
          </View>
        </View>

        <View style={s.body}>
          {/* ── Follow bar ── */}
          <View style={s.followBar}>
            <TouchableOpacity
              style={s.followCountBtn}
              onPress={() => navigation.navigate('FollowList', { userId: profile.id, userName: name, initialTab: 'Followers' })}
            >
              <Text style={s.followCountNum}>{followCounts.followers}</Text>
              <Text style={s.followCountLabel}>Followers</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.followCountBtn}
              onPress={() => navigation.navigate('FollowList', { userId: profile.id, userName: name, initialTab: 'Following' })}
            >
              <Text style={s.followCountNum}>{followCounts.following}</Text>
              <Text style={s.followCountLabel}>Following</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                s.followActionBtn,
                (isFollowing || isFriend)
                  ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: isFriend ? '#CE1126' : colors.black }
                  : { backgroundColor: colors.black },
              ]}
              onPress={toggleFollow}
              activeOpacity={0.8}
            >
              {isFriend && <Ionicons name="people" size={14} color="#CE1126" style={{ marginRight: 4 }} />}
              <Text style={[
                s.followActionText,
                { color: (isFollowing || isFriend) ? (isFriend ? '#CE1126' : colors.black) : (isDark ? '#1A1A1A' : '#FFF') },
              ]}>
                {isFriend ? 'Friends' : isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          </View>

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
                  <View style={s.factPill}>
                    <Text style={{ fontSize: 14 }}>{eth.emoji}</Text>
                    <Text style={s.factText}>{eth.label}</Text>
                  </View>
                );
              })() : null}
              {(intention || lookingFor) ? (
                <View style={[s.factPill, s.factFilled]}>
                  <Text style={s.factFilledText}>{intention || lookingFor}</Text>
                </View>
              ) : null}
              {children ? (
                <View style={s.factPill}>
                  <Text style={s.factText}>{children}</Text>
                </View>
              ) : null}
              {/* Identity stickers inline (skip ethnicity dupes and hobby stickers) */}
              {stickers.filter(st => {
                const lbl = st.label.toLowerCase();
                if (ethnicity && lbl === ethnicity.toLowerCase()) return false;
                const hobbyWords = ['photo', 'water', 'music', 'cooking', 'travel', 'art', 'sports', 'gaming', 'reading', 'fitness', 'dance', 'fashion', 'film', 'yoga', 'hiking'];
                if (hobbyWords.some(h => lbl.includes(h))) return false;
                return true;
              }).map((st, i) => (
                <View key={`st-${i}`} style={s.factPill}>
                  <Text style={{ fontSize: 13 }}>{st.emoji}</Text>
                  <Text style={s.factText}>{st.label}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        </View>

        {/* ── Photo 2 ── */}
        <InlinePhoto index={1} />

        <View style={s.sectionBody}>
          {/* ── Prompt — the hero card ── */}
          <Animated.View style={{
            opacity: promptAnim,
            transform: [{ scale: promptAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
          }}>
            <View style={s.promptCard}>
              <View style={s.sectionHeader}>
                <Ionicons name="chatbubble-outline" size={14} color={colors.gray500} />
                <Text style={s.promptQ}>{pQ}</Text>
              </View>
              <Text style={s.promptA}>{pA}</Text>
            </View>
          </Animated.View>
        </View>

        {/* ── Photo 3 ── */}
        <InlinePhoto index={2} />

        <View style={s.sectionBody}>
          {/* ── About ── */}
          {(about || bio) ? (
            <Animated.View style={{ opacity: aboutAnim }}>
              <View style={s.aboutSection}>
                <View style={s.sectionHeader}>
                  <Ionicons name="person-outline" size={16} color={colors.gray500} />
                  <Text style={s.aboutLabel}>About</Text>
                </View>
                <Text style={s.aboutText}>{about || bio}</Text>
              </View>
            </Animated.View>
          ) : null}
        </View>

        {/* ── Photo 4 ── */}
        <InlinePhoto index={3} />

        <View style={s.sectionBody}>
          {/* ── Interests (includes hobby stickers) ── */}
          {(interests.length > 0 || stickers.length > 0) && (() => {
            const hobbyWords = ['photo', 'water', 'music', 'cooking', 'travel', 'art', 'sports', 'gaming', 'reading', 'fitness', 'dance', 'fashion', 'film', 'yoga', 'hiking'];
            const hobbyStickers = stickers.filter(st => hobbyWords.some(h => st.label.toLowerCase().includes(h)));
            const hobbyLabels = hobbyStickers.map(st => `${st.emoji} ${st.label}`);
            const allInterests = [...interests, ...hobbyLabels.filter(h => !interests.includes(h))];
            if (allInterests.length === 0) return null;
            return (
            <Animated.View style={{
              opacity: sectionsAnim,
              transform: [{ translateY: sectionsAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }}>
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Ionicons name="heart-outline" size={16} color={colors.gray500} />
                  <Text style={s.sectionLabel}>Interests</Text>
                </View>
                <View style={s.pillRow}>
                  {allInterests.map((item, i) => (
                    <View key={i} style={s.interestPill}>
                      <Text style={s.interestText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Animated.View>
            );
          })()}
        </View>

        {/* ── Photo 5 ── */}
        <InlinePhoto index={4} />

        <View style={s.sectionBody}>
          {/* ── Currently Into ── */}
          {currentlyInto?.length > 0 && (
            <Animated.View style={{
              opacity: sectionsAnim,
              transform: [{ translateY: sectionsAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }}>
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Ionicons name="flash-outline" size={16} color={colors.gray500} />
                  <Text style={s.sectionLabel}>Currently Into</Text>
                </View>
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
        </View>

        {/* ── Photo 6 ── */}
        <InlinePhoto index={5} />

        <View style={s.sectionBody}>
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
            </TouchableOpacity>
            <TouchableOpacity style={s.superBtn} onPress={handleSuperLike} activeOpacity={0.7}>
              <GraffitiSparkles size={22} color={colors.black} filled />
            </TouchableOpacity>
            <TouchableOpacity style={s.whisperBtn} onPress={handleWhisper} activeOpacity={0.7}>
              <Ionicons name="chatbubble-ellipses" size={20} color={colors.accent} />
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
              <Ionicons name="game-controller" size={20} color="#FCCD12" />
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
  photoGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 160 },
  inlinePhotoCard: { marginHorizontal: 18, borderRadius: 20, overflow: 'hidden', marginVertical: 0, height: (SW - 36) * 1.25, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 8 },
  nameOverlay: { position: 'absolute', bottom: 16, left: 18, right: 18, zIndex: 5 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  nameText: { fontSize: 30, fontWeight: '800', fontFamily: FontFamily.extrabold, color: '#FFF', textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  subtitleText: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontFamily: FontFamily.semibold, marginTop: 4, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },

  // ── Body ──
  body: { paddingHorizontal: 18, marginTop: -4 },
  sectionBody: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 4 },

  // ── Follow bar ──
  followBar: {
    flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16, marginTop: 4, paddingVertical: 8,
  },
  followCountBtn: { alignItems: 'center' },
  followCountNum: { fontSize: 18, fontWeight: '800', fontFamily: FontFamily.extrabold, color: colors.black },
  followCountLabel: { fontSize: 11, fontFamily: FontFamily.medium, color: colors.gray500, marginTop: 1 },
  followActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 22, marginLeft: 8,
  },
  followActionText: { fontSize: 14, fontWeight: '700', fontFamily: FontFamily.bold },

  // ── Quick facts ──
  factsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14, marginTop: 8 },
  factPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F4F4F6', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  factText: { fontSize: 13, fontWeight: '600', fontFamily: FontFamily.semibold, color: colors.black },
  factFilled: { backgroundColor: colors.black },
  factFilledText: { fontSize: 13, fontWeight: '700', fontFamily: FontFamily.bold, color: isDark ? '#1A1A1A' : '#FFF' },

  // ── Prompt — hero card with left accent stripe ──
  promptCard: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F6F6F8',
    borderRadius: 20,
    padding: 24,
    paddingLeft: 22,
    marginBottom: 4,
    borderLeftWidth: 4,
    borderLeftColor: colors.black,
  },
  promptQ: { fontSize: 11, fontWeight: '700', fontFamily: FontFamily.bold, color: colors.gray500, letterSpacing: 1.2, textTransform: 'uppercase' },
  promptA: { fontSize: 21, lineHeight: 32, fontWeight: '700', fontFamily: FontFamily.bold, color: colors.black },

  // ── About ──
  aboutSection: { marginBottom: 4, paddingLeft: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  aboutLabel: { fontSize: 12, fontWeight: '800', fontFamily: FontFamily.extrabold, color: colors.gray500, letterSpacing: 1, textTransform: 'uppercase' },
  aboutText: { fontSize: 16, lineHeight: 26, color: isDark ? colors.gray600 : colors.gray700, fontFamily: FontFamily.regular },

  // ── Identity — inline pills ──
  identitySection: { marginBottom: 6 },
  identityPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F4F4F6', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  identityEmoji: { fontSize: 16 },
  identityLabel: { fontSize: 13, fontWeight: '600', fontFamily: FontFamily.semibold, color: colors.black },

  // ── Sections ──
  section: { marginBottom: 4 },
  sectionLabel: { fontSize: 12, fontWeight: '800', fontFamily: FontFamily.extrabold, color: colors.gray500, letterSpacing: 1, textTransform: 'uppercase' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  interestPill: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F4F4F6',
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24,
  },
  interestText: { color: colors.black, fontSize: 14, fontWeight: '600', fontFamily: FontFamily.semibold },

  intoPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F4F4F6' },
  intoText: { color: colors.black, fontSize: 13, fontWeight: '600', fontFamily: FontFamily.semibold },

  // ── Action Bar ──
  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: isDark ? colors.surface : 'rgba(255,255,255,0.97)', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, paddingHorizontal: 18, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: colors.separator },
  passBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(201,93,79,0.12)', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(201,93,79,0.2)' },
  likeBtn: { flex: 1, height: 54, backgroundColor: colors.accent, borderRadius: 27, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 8 },
  matchBtn: { flex: 1, height: 54, backgroundColor: colors.accent, borderRadius: 27, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 8 },
  likeBtnText: { color: '#FFF', fontSize: 17, fontWeight: '700', fontFamily: FontFamily.bold, letterSpacing: 0.5 },
  superBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.roseTint12, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: colors.roseTint20 },
  whisperBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(206,17,38,0.10)', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(206,17,38,0.20)' },
  challengeBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(252,205,18,0.12)', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: 'rgba(252,205,18,0.25)' },
});

export default ProfileDetailScreen;
