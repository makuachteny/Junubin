// JuNubin — Profile Detail Screen

import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FontFamily } from '../theme';
import { imageSource } from '../utils/imageSource';
import { useAuth } from '../auth';
import * as safetyService from '../api/services/safetyService';
import * as connectionService from '../api/services/connectionService';
import * as messageRequestService from '../api/services/messageRequestService';
import MessageRequestComposer from '../components/MessageRequestComposer';
import { useMyFollowCounts, useFollow } from '../hooks/useFollow';
import { useCurrentUser, useEligibility } from '../hooks';
import { getEthnicIdentity } from '../utils/ethnicIdentity';
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
  const { session } = useAuth();
  const followCounts = useMyFollowCounts(profile.id);
  const {
    isFollowing,
    isFriend,
    toggleFollow,
    loading: followLoading,
  } = useFollow(profile.id);
  const { currentUser } = useCurrentUser();
  const { nudge: surveyNudge } = useEligibility();
  const isOwnProfile = !!currentUser?.id && currentUser.id === profile.id;

  // ── Messaging permission ──
  // canMessageDirectly is true for a mutual connection OR an accepted
  // message request. Anyone else has to send a request first. We start
  // pessimistic (false) so the composer is the default for strangers —
  // failing open would drop people straight into a chat they aren't
  // allowed to post in, and the server would reject the send.
  const [canMessage, setCanMessage] = useState(false);
  const [requestStatus, setRequestStatus] = useState('none');
  const [showComposer, setShowComposer] = useState(false);

  const refreshConnection = useCallback(async () => {
    if (!session || !profile?.id || isOwnProfile) return;
    try {
      const [state, direct] = await Promise.all([
        connectionService.getConnectionState(profile.id),
        connectionService.canMessageDirectly(profile.id),
      ]);
      setRequestStatus(state?.requestStatus || 'none');
      setCanMessage(!!direct);
    } catch (e) {
      // Degrade to "send a request" rather than blanking the screen.
      if (__DEV__) console.warn('Connection state failed:', e?.message);
      setCanMessage(false);
    }
  }, [session, profile?.id, isOwnProfile]);

  useEffect(() => { refreshConnection(); }, [refreshConnection]);

  const handleMessage = useCallback(() => {
    if (canMessage) {
      navigation.navigate('Chat', { match: profile });
      return;
    }
    if (requestStatus === 'pending_out') {
      Alert.alert('Request sent', `${profile.name || 'They'} will see your note. You can chat once they accept.`);
      return;
    }
    if (requestStatus === 'declined') {
      Alert.alert('Request not accepted', 'You cannot send another request to this person.');
      return;
    }
    setShowComposer(true);
  }, [canMessage, requestStatus, navigation, profile]);

  const handleSendRequest = useCallback(async (text) => {
    try {
      const res = await messageRequestService.sendMessageRequest(profile.id, text);
      setShowComposer(false);
      setRequestStatus(res?.status === 'accepted' ? 'accepted' : 'pending_out');
      Alert.alert('Request sent', `${profile.name || 'They'} will see your note and can start the conversation.`);
    } catch (e) {
      Alert.alert('Could not send', e?.message || 'Try again in a moment.');
    }
  }, [profile.id, profile.name]);

  const messageLabel = canMessage ? 'Message'
    : requestStatus === 'pending_out' ? 'Requested'
    : 'Message';

  // ── Header overflow menu — Report / Block ──
  // App Review requires safety actions to be reachable from a user's
  // profile, not just from inside an active chat. Both `reportUser` and
  // `blockUser` operate on the User row; `reportAndBlock` does both in
  // a single RPC. Mirrors the tone of ChatScreen's handleHeaderMenu.
  const handleProfileMenu = () => {
    if (isOwnProfile) return;
    const targetId = profile.userId || profile.id;
    const displayName = profile.name || 'this person';
    Alert.alert(displayName, null, [
      {
        text: 'Report',
        style: 'destructive',
        onPress: () => Alert.alert(
          `Report ${displayName}?`,
          'Our safety team will review this account. The user will not be told you reported them.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Report',
              style: 'destructive',
              onPress: async () => {
                if (!targetId) {
                  Alert.alert('Reported', 'Thanks — our team will review this account.');
                  navigation.goBack();
                  return;
                }
                try {
                  await safetyService.reportUser({ reportedId: targetId, reason: 'profile_report' });
                  Alert.alert('Reported', 'Thanks — our team will review this account.');
                  navigation.goBack();
                } catch (e) {
                  Alert.alert('Could not file report', e?.message || 'Try again later.');
                }
              },
            },
          ]
        ),
      },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () => Alert.alert(
          `Block ${displayName}?`,
          'You will both stop seeing each other across JuNubin — profiles, conversations, and the directory.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Block',
              style: 'destructive',
              onPress: async () => {
                if (!targetId) {
                  navigation.goBack();
                  return;
                }
                try {
                  await safetyService.blockUser(targetId);
                  Alert.alert('Blocked', `${displayName} has been blocked.`);
                  navigation.goBack();
                } catch (e) {
                  Alert.alert('Could not block', e?.message || 'Try again later.');
                }
              },
            },
          ]
        ),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
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

  const {
    name = 'User', age = 0, distance = 0, verified = false, bio = '', about = '',
    job = '', school = '', images = [], interests = [], stickers = [], height = '',
    ethnicity = '', pronouns = '', education = '',
    promptQuestion = '', promptAnswer = '', currentlyInto = [],
    // Social-pivot fields. All optional — a profile written before the
    // pivot simply renders without these rows.
    city = '', countryCode = '', languages = [], openTo = [], profession = '',
    lastActiveAt = null,
  } = profile;

  // "Active 3h ago" style hint. Deliberately coarse — an exact
  // last-seen timestamp is a stalking vector, so anything inside the
  // hour collapses to "Active now" and anything past a week is dropped.
  const lastActiveLabel = (() => {
    if (!lastActiveAt) return '';
    const diff = Date.now() - new Date(lastActiveAt).getTime();
    if (Number.isNaN(diff) || diff < 0) return '';
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 1) return 'Active now';
    if (hrs < 24) return `Active ${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days <= 7) return `Active ${days}d ago`;
    return '';
  })();

  const pQ = promptQuestion || 'The perfect date would be';
  const pA = promptAnswer || bio || about || 'Going on a late drive and getting food while we talk.';
  const gallery = (() => { const src = (images || []).filter(Boolean); if (!src.length) return []; const f = [...src]; let i = 0; while (f.length < 6) { f.push(src[i % src.length]); i++; } return f; })();

  // Quick facts — compact inline items (age already shown in name overlay, skip it)
  const countryInfo = getCountryByCode(countryCode || profile.country);
  const quickFacts = [
    // Where someone is and what they do are the two things that matter
    // most on a community platform — they lead the pill row now.
    [city, getCountryByCode(countryCode)?.name].filter(Boolean).join(', '),
    profession || job,
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

          {!isOwnProfile && (
            <TouchableOpacity
              style={[s.moreBtn, { top: insets.top + 10 }]}
              onPress={handleProfileMenu}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="More options"
            >
              <Ionicons name="ellipsis-horizontal" size={22} color="#FFF" />
            </TouchableOpacity>
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
              <Text style={s.nameText}>{name}, {age} {countryInfo?.flag || ''}</Text>
              {verified && <Ionicons name="checkmark-circle" size={20} color={colors.black} style={{ marginLeft: 5 }} />}
            </View>
            {(profession || job || school || education) && (
              <Text style={s.subtitleText}>
                {profession || job}{(profession || job) && (school || education) ? '  ·  ' : ''}{school || education}
              </Text>
            )}
            {lastActiveLabel ? (
              <Text style={s.subtitleText}>{lastActiveLabel}</Text>
            ) : null}
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
            {!isOwnProfile && (
              <TouchableOpacity
                testID="profile-follow-action"
                accessibilityRole="button"
                accessibilityLabel={
                  isFriend ? `Friends with ${name}`
                  : isFollowing ? `Following ${name}, tap to unfollow`
                  : `Follow ${name}`
                }
                onPress={toggleFollow}
                disabled={followLoading}
                style={[
                  s.followPill,
                  (isFollowing || isFriend) ? s.followPillActive : s.followPillIdle,
                  followLoading && { opacity: 0.6 },
                ]}
              >
                <Text style={[
                  s.followPillText,
                  { color: isFollowing || isFriend ? colors.black : '#FFFFFF' },
                ]}>
                  {isFriend ? 'Friends' : isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}
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
              {/* The dating-era `intention` / `lookingFor` and
                  `children` pills are gone — "open to" badges rendered
                  elsewhere on this sheet cover intent now. */}
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
          {/* ── Languages ── */}
          {languages?.length > 0 && (
            <Animated.View style={{
              opacity: sectionsAnim,
              transform: [{ translateY: sectionsAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }}>
              <View style={s.section}>
                <View style={s.sectionHeader}>
                  <Ionicons name="language-outline" size={16} color={colors.gray500} />
                  <Text style={s.sectionLabel}>Speaks</Text>
                </View>
                <View style={s.pillRow}>
                  {languages.map((lang, i) => (
                    <View key={`lang-${i}`} style={s.interestPill}>
                      <Text style={s.interestText}>{typeof lang === 'string' ? lang : lang?.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Animated.View>
          )}

          {/* ── Open to — what this person actually wants out of
              JuNubin (mentoring, business, housing leads, community
              events…). Filled pills so they read as intent, not trivia. ── */}
          {openTo?.length > 0 && (
            <Animated.View style={{
              opacity: sectionsAnim,
              transform: [{ translateY: sectionsAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }}>
              <View style={[s.section, { marginTop: languages?.length > 0 ? 20 : 0 }]}>
                <View style={s.sectionHeader}>
                  <Ionicons name="people-outline" size={16} color={colors.gray500} />
                  <Text style={s.sectionLabel}>Open to</Text>
                </View>
                <View style={s.pillRow}>
                  {openTo.map((item, i) => (
                    <View key={`open-${i}`} style={s.openToPill}>
                      <Text style={s.openToText}>{typeof item === 'string' ? item : item?.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Animated.View>
          )}
        </View>

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
          <View style={{ height: 110 }} />
        </View>
      </ScrollView>

      {/* ── Bottom Action Bar ──
          Social actions only: Follow / Following, Message (direct when
          we're allowed, otherwise a request composer), and the overflow
          that carries Block + Report. The like / pass / super-like /
          whisper / game row that used to live here is gone with the
          dating model. */}
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
        {!isOwnProfile && (
          <>
            <TouchableOpacity
              style={[s.followActionBtn, (isFollowing || isFriend) && s.followActionBtnActive]}
              onPress={() => {
                toggleFollow();
                // Following back can complete a mutual connection, which
                // is what unlocks direct messaging — re-read the state
                // rather than guessing at it locally.
                setTimeout(refreshConnection, 400);
              }}
              disabled={followLoading}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ selected: isFollowing || isFriend, disabled: followLoading }}
              accessibilityLabel={
                isFriend ? `Connected with ${name}, tap to unfollow`
                : isFollowing ? `Following ${name}, tap to unfollow`
                : `Follow ${name}`
              }
            >
              <Ionicons
                name={isFriend ? 'people' : isFollowing ? 'checkmark' : 'person-add-outline'}
                size={17}
                color={(isFollowing || isFriend) ? colors.black : '#FFF'}
              />
              <Text style={[
                s.followActionText,
                { color: (isFollowing || isFriend) ? colors.black : '#FFF' },
              ]}>
                {isFriend ? 'Connected' : isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.messageActionBtn}
              onPress={handleMessage}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={
                canMessage
                  ? `Message ${name}`
                  : requestStatus === 'pending_out'
                    ? `Message request already sent to ${name}`
                    : `Send ${name} a message request`
              }
            >
              <Ionicons name="chatbubble-outline" size={17} color={colors.black} />
              <Text style={s.messageActionText}>{messageLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.moreActionBtn}
              onPress={handleProfileMenu}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="More options, including block and report"
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.black} />
            </TouchableOpacity>
          </>
        )}
      </Animated.View>

      <MessageRequestComposer
        visible={showComposer}
        name={name}
        onCancel={() => setShowComposer(false)}
        onSend={handleSendRequest}
      />
      {surveyNudge}
    </View>
  );
};

const getStyles = (colors, isDark) => StyleSheet.create({
  root: { flex: 1, backgroundColor: isDark ? colors.cream : colors.creamDark },

  // ── Photo ──
  photoWrap: { width: SW, height: PHOTO_H, backgroundColor: colors.gray200 },
  backBtn: { position: 'absolute', left: 14, width: 44, height: 44, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  moreBtn: { position: 'absolute', right: 14, width: 44, height: 44, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  photoGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 160 },
  inlinePhotoCard: { marginHorizontal: 18, borderRadius: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, overflow: 'hidden', marginVertical: 0, height: (SW - 36) * 1.25 },
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
  followPill: {
    marginLeft: 'auto',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followPillIdle: {
    backgroundColor: colors.accent,
  },
  followPillActive: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,13,12,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
  },
  followPillText: {
    fontSize: 13.5,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  // ── Quick facts ──
  factsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14, marginTop: 8 },
  factPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.surfaceMuted, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 4 },
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
  identityPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceMuted, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 4 },
  identityEmoji: { fontSize: 16 },
  identityLabel: { fontSize: 13, fontWeight: '600', fontFamily: FontFamily.semibold, color: colors.black },

  // ── Sections ──
  section: { marginBottom: 4 },
  sectionLabel: { fontSize: 12, fontWeight: '600', fontFamily: FontFamily.semibold, color: colors.gray600, letterSpacing: 1, textTransform: 'uppercase' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  interestPill: {
    backgroundColor: 'transparent',
    borderWidth: 1, borderColor: colors.separator,
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: 4,
  },
  interestText: { color: colors.black, fontSize: 14, fontWeight: '600', fontFamily: FontFamily.semibold },

  intoPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 4, backgroundColor: colors.surfaceMuted, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
  intoText: { color: colors.black, fontSize: 13, fontWeight: '600', fontFamily: FontFamily.semibold },

  // ── Action Bar ──
  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: isDark ? colors.surface : 'rgba(255,255,255,0.97)', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: colors.separator },
  // Follow and Message share the width; More is a fixed square. All
  // three clear 46pt, comfortably over the 44pt minimum.
  followActionBtn: {
    flex: 1, height: 46, borderRadius: 4, backgroundColor: colors.accent,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
  },
  followActionBtnActive: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,13,12,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)',
  },
  followActionText: { fontSize: 15, fontWeight: '700', fontFamily: FontFamily.bold, letterSpacing: 0.2 },
  messageActionBtn: {
    flex: 1, height: 46, borderRadius: 4,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,13,12,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)',
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6,
  },
  messageActionText: { color: colors.black, fontSize: 15, fontWeight: '700', fontFamily: FontFamily.bold, letterSpacing: 0.2 },
  moreActionBtn: {
    width: 46, height: 46, borderRadius: 4, justifyContent: 'center', alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,13,12,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)',
  },
  openToPill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 2, backgroundColor: colors.accentTint15 },
  openToText: { color: colors.accentDark, fontSize: 13, fontWeight: '600', fontFamily: FontFamily.semibold },
});

export default ProfileDetailScreen;
