// ProfileDetailScreen — the single "Person detail" page (redesign).
// Reached from Directory / Nearby / Chats / Notifications with a
// `profile` route param, and from Profile's "Preview as others" with
// `selfPreview: true`. Layout mirrors the design exactly: 340pt hero
// photo fading into the page background, identity block, Follow +
// Message actions, OPEN TO tags, and a two-column ABOUT facts grid.

import React, { useMemo, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  TouchableOpacity,
  ScrollView,
  Alert,
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
import * as chatService from '../api/services/chatService';
import MessageRequestComposer from '../components/MessageRequestComposer';
import { useFollow } from '../hooks/useFollow';
import { useCurrentUser, useEligibility } from '../hooks';
import { getEthnicIdentity } from '../utils/ethnicIdentity';
import { getCountryByCode } from '../data/countries';
import { openToLabels } from '../data/openTo';

const SW = Dimensions.get('window').width;
const HERO_H = 340;

// ss-tag palette cycle (blue → green → gold → red by index), matching
// the design's ssTag helper. Tint fills with the readable dark step.
const TAG_CYCLE = [
  ['ssBlueTint', 'ssBlueDark'],
  ['ssGreenTint', 'ssGreenDark'],
  ['ssGoldTint', 'ssGoldDark'],
  ['ssRedTint', 'ssRedDark'],
];

const ProfileDetailScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const s = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const profile = route.params?.profile || {};
  // "Preview as others" passes the viewer's own profile — same layout,
  // but the social actions and the safety menu make no sense on self.
  const selfPreview = !!route.params?.selfPreview;
  // Chat surfaces pass conversation rows whose `.id` is the MATCH id;
  // the person's real user id is `.userId`. Every service call below
  // needs the USER id — using the match id made follow toggles fail,
  // canMessageDirectly return false, and request sends hit FK errors.
  const peerUserId = profile.userId || profile.id;
  const { session } = useAuth();
  const {
    isFollowing,
    isFriend,
    toggleFollow,
    loading: followLoading,
  } = useFollow(peerUserId);
  const { currentUser } = useCurrentUser();
  const { nudge: surveyNudge } = useEligibility();
  const isOwnProfile = selfPreview || (!!currentUser?.id && currentUser.id === peerUserId);

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
    if (!session || !peerUserId || isOwnProfile) return;
    try {
      const [state, direct] = await Promise.all([
        connectionService.getConnectionState(peerUserId),
        connectionService.canMessageDirectly(peerUserId),
      ]);
      setRequestStatus(state?.requestStatus || 'none');
      setCanMessage(!!direct);
    } catch (e) {
      // Degrade to "send a request" rather than blanking the screen.
      if (__DEV__) console.warn('Connection state failed:', e?.message);
      setCanMessage(false);
    }
  }, [session, peerUserId, isOwnProfile]);

  useEffect(() => { refreshConnection(); }, [refreshConnection]);

  const [openingChat, setOpeningChat] = useState(false);
  const handleMessage = useCallback(async () => {
    if (canMessage) {
      if (openingChat) return;
      setOpeningChat(true);
      try {
        // Server-side gate + mint (00048): reuses the pair's existing
        // conversation or creates Match+Conversation+members for a
        // mutual connection. ChatScreen requires the conversationId —
        // without it the composer refuses to send.
        const conversationId = await chatService.getOrCreateDirectConversation(peerUserId);
        navigation.navigate('Chat', {
          conversationId,
          match: { ...profile, id: peerUserId, userId: peerUserId, conversationId },
        });
      } catch (e) {
        // not_connected → fall back to the request composer; anything
        // else (offline, blocked) gets a plain error.
        if (/not_connected/i.test(e?.message || '')) {
          setShowComposer(true);
        } else {
          Alert.alert('Could not open chat', e?.message || 'Try again in a moment.');
        }
      } finally {
        setOpeningChat(false);
      }
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
  }, [canMessage, requestStatus, navigation, profile, peerUserId, openingChat]);

  const handleSendRequest = useCallback(async (text) => {
    try {
      const res = await messageRequestService.sendMessageRequest(peerUserId, text);
      setShowComposer(false);
      setRequestStatus(res?.status === 'accepted' ? 'accepted' : 'pending_out');
      Alert.alert('Request sent', `${profile.name || 'They'} will see your note and can start the conversation.`);
    } catch (e) {
      Alert.alert('Could not send', e?.message || 'Try again in a moment.');
    }
  }, [peerUserId, profile.name]);

  // ── Overflow menu (⋯) — Report / Block ──
  // App Review requires safety actions to be reachable from a user's
  // profile, not just from inside an active chat. Both `reportUser` and
  // `blockUser` operate on the User row. Mirrors the tone of
  // ChatScreen's handleHeaderMenu.
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

  const {
    name = 'User', age = 0, distance = 0, verified = false,
    job = '', school = '', ethnicity = '', education = '',
    city = '', countryCode = '', languages = [], openTo = [], profession = '',
  } = profile;

  const [heroErr, setHeroErr] = useState(false);
  const heroUri = [...(profile.photos || []), ...(profile.images || [])].filter(Boolean)[0];

  // "City, Country · {distance or city}" — distance when we have one
  // (nearby surfaces), otherwise the city repeats as the locator, same
  // as the design's far-away people ("Kampala, Uganda · Kampala").
  const countryName = getCountryByCode(countryCode || profile.country)?.name || '';
  const place = [city, countryName].filter(Boolean).join(', ');
  const locator = distance ? `${distance} mi` : city;
  const cityLine = [place, locator].filter(Boolean).join(' · ');

  // OPEN TO tags — canonical labels when the values are known keys,
  // otherwise whatever strings the profile carries. No invented data.
  const tags = (() => {
    const labels = openToLabels(openTo);
    if (labels.length) return labels;
    return (openTo || [])
      .map((t) => (typeof t === 'string' ? t : t?.label))
      .filter(Boolean);
  })();

  // ABOUT facts grid — cells with no data are omitted, never padded.
  const languagesLine = (languages || [])
    .map((l) => (typeof l === 'string' ? l : l?.label))
    .filter(Boolean)
    .join(', ');
  const facts = [
    { k: 'BACKGROUND', v: ethnicity ? getEthnicIdentity(ethnicity).label : '' },
    { k: 'LANGUAGES', v: languagesLine },
    { k: 'PROFESSION', v: profession || job },
    { k: 'SCHOOL', v: education || school },
  ].filter((f) => !!f.v);

  const following = isFollowing || isFriend;

  return (
    <View style={s.root}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} bounces={false}>
        {/* ── Hero photo ── */}
        <View style={s.hero}>
          {heroUri && !heroErr ? (
            <Image
              source={imageSource(heroUri)}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onError={() => setHeroErr(true)}
              fadeDuration={0}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={s.heroFallback}>
              <Text style={s.heroFallbackInitial}>{name ? name.charAt(0).toUpperCase() : '?'}</Text>
            </View>
          )}
          <LinearGradient
            colors={['transparent', colors.cream]}
            locations={[0.55, 0.96]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <TouchableOpacity
            style={[s.floatBtn, { top: insets.top + 10, left: 10 }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={colors.black} />
          </TouchableOpacity>
          {!isOwnProfile && (
            <TouchableOpacity
              style={[s.floatBtn, { top: insets.top + 10, right: 10 }]}
              onPress={handleProfileMenu}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Report or block"
            >
              <Ionicons name="ellipsis-vertical" size={20} color={colors.black} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Identity + actions + sections ── */}
        <View style={[s.body, { paddingBottom: insets.bottom + 24 }]}>
          <View style={s.nameRow}>
            <Text style={s.nameText}>{name}{age ? `, ${age}` : ''}</Text>
            {verified && (
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color={colors.accentDark}
                accessibilityLabel="Verified"
              />
            )}
          </View>
          {cityLine ? <Text style={s.cityLine}>{cityLine}</Text> : null}

          {!isOwnProfile && (
            <>
              <View style={s.actionsRow}>
                <TouchableOpacity
                  testID="profile-follow-action"
                  style={[s.followBtn, following ? s.followBtnActive : s.followBtnIdle, followLoading && { opacity: 0.6 }]}
                  onPress={() => {
                    toggleFollow();
                    // Following back can complete a mutual connection,
                    // which is what unlocks direct messaging — re-read
                    // the state rather than guessing at it locally.
                    setTimeout(refreshConnection, 400);
                  }}
                  disabled={followLoading}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected: following, disabled: followLoading }}
                  accessibilityLabel={following ? `Following ${name}, tap to unfollow` : `Follow ${name}`}
                >
                  <Text style={[s.followBtnText, { color: following ? colors.gray500 : colors.accentDark }]}>
                    {following ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="profile-message-action"
                  style={s.messageBtn}
                  onPress={handleMessage}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={canMessage ? `Message ${name}` : `Send ${name} a message request`}
                >
                  <Text style={s.messageBtnText}>{canMessage ? 'Message' : 'Send request'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.msgHint}>
                {canMessage
                  ? "You're connected — chat away."
                  : 'One request per person. They see your note before your chat.'}
              </Text>
            </>
          )}

          {tags.length > 0 && (
            <>
              <Text style={s.sectionLabel}>OPEN TO</Text>
              <View style={s.tagRow}>
                {tags.map((label, i) => {
                  const [tint, dark] = TAG_CYCLE[i % TAG_CYCLE.length];
                  return (
                    <View key={`${label}-${i}`} style={[s.tag, { backgroundColor: colors[tint] }]}>
                      <Text style={[s.tagText, { color: colors[dark] }]}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {facts.length > 0 && (
            <>
              <Text style={[s.sectionLabel, { marginTop: 18 }]}>ABOUT</Text>
              <View style={s.factsGrid}>
                {facts.map((f) => (
                  <View key={f.k} style={s.factCell}>
                    <Text style={s.factKey}>{f.k}</Text>
                    <Text style={s.factValue}>{f.v}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>

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
  root: { flex: 1, backgroundColor: colors.cream },

  // ── Hero ──
  hero: { width: SW, height: HERO_H, backgroundColor: colors.surfaceMuted },
  heroFallback: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroFallbackInitial: {
    fontSize: 96,
    fontFamily: FontFamily.headingBold,
    color: colors.gray400,
    opacity: 0.4,
  },
  // 80% page-background over the photo, matching the design's
  // color-mix(bg 80%) floating controls. Both palettes' cream is a
  // 6-digit hex, so the CC alpha suffix is safe.
  floatBtn: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 4,
    backgroundColor: `${colors.cream}CC`,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  // ── Identity ──
  body: { paddingHorizontal: 20, marginTop: -8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nameText: { fontSize: 34, fontFamily: FontFamily.heading, color: colors.black },
  cityLine: { fontSize: 14, fontFamily: FontFamily.regular, color: colors.gray500, marginTop: 4 },

  // ── Actions ──
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  followBtn: {
    flex: 1,
    height: 46,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followBtnIdle: { borderColor: colors.accent, backgroundColor: colors.accentTint15 },
  followBtnActive: { borderColor: colors.separator, backgroundColor: colors.cream },
  followBtnText: { fontSize: 14.5, fontFamily: FontFamily.semibold },
  messageBtn: {
    flex: 1,
    height: 46,
    borderRadius: 4,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBtnText: { fontSize: 14.5, fontFamily: FontFamily.semibold, color: colors.cream },
  msgHint: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    color: colors.gray400,
    marginTop: 8,
    textAlign: 'center',
  },

  // ── Sections ──
  sectionLabel: {
    marginTop: 22,
    fontSize: 12,
    fontFamily: FontFamily.semibold,
    letterSpacing: 1,
    color: colors.gray500,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 2 },
  tagText: { fontSize: 12, fontFamily: FontFamily.semibold },
  factsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  factCell: {
    width: (SW - 40 - 10) / 2,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  factKey: {
    fontSize: 10.5,
    fontFamily: FontFamily.semibold,
    letterSpacing: 1,
    color: colors.gray400,
  },
  factValue: {
    fontSize: 13.5,
    fontFamily: FontFamily.medium,
    color: colors.black,
    marginTop: 3,
  },
});

export default ProfileDetailScreen;
