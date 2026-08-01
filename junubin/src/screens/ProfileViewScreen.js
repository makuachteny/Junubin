// ProfileViewScreen — card-first profile preview.
//
// Sits between an entry point (PeopleMap marker, Notifications row,
// follow-list row, future tap surfaces) and the deep
// ProfileDetailScreen. Renders the person as a single ProfileCard so
// the user gets the same compact, photo-led preview they'd see in
// the swipe deck. Tapping the card (or the explicit CTA) navigates
// onward to ProfileDetail for the full scroll-through.
//
// Actions are social only: Follow / Following, Message (direct when
// we're allowed to, otherwise a short message-request composer), and
// an overflow carrying Block + Report. The old Pass / Like / Super-like
// swipe bar went out with the dating model.

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FontFamily, Typography } from '../theme';
import ProfileCard from '../components/ProfileCard';
import MessageRequestComposer from '../components/MessageRequestComposer';
import * as safetyService from '../api/services/safetyService';
import * as connectionService from '../api/services/connectionService';
import * as messageRequestService from '../api/services/messageRequestService';
import { useAuth } from '../auth';
import { useEligibility } from '../hooks';
import { useFollow } from '../hooks/useFollow';
import { isDemoId } from '../config/demoData';
import { getCountryByCode } from '../data/countries';

// Visual height of the action bar (button slot 58 + 6 gap + ~18 label).
// Used by the cardArea and tapCta to reserve space so they don't overlap.
const ACTION_BAR_HEIGHT = 82;

export default function ProfileViewScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const profile = route.params?.profile || {};
  const { session } = useAuth();
  const { nudge } = useEligibility();
  // Demo roster ids (demo_*) aren't backed by real User rows — server
  // RPCs error out on the FK. Pass null so useFollow short-circuits
  // its fetches and recordSwipe / toggleFollow no-op below.
  const isDemoProfile = isDemoId(profile?.id);
  const { isFollowing, isFriend, toggleFollow, loading: followLoading } = useFollow(
    isDemoProfile ? null : profile?.id,
  );

  // Details strip content. Everything is optional — a profile written
  // before the social pivot simply renders fewer chips (or none, in
  // which case the strip isn't mounted at all).
  const metaChips = useMemo(() => {
    const chips = [];
    const place = [profile.city, getCountryByCode(profile.countryCode)?.name]
      .filter(Boolean).join(', ');
    if (place) chips.push({ key: 'place', icon: 'location-outline', label: place });
    if (profile.profession) chips.push({ key: 'job', icon: 'briefcase-outline', label: profile.profession });
    (profile.languages || []).forEach((lang, i) => {
      const label = typeof lang === 'string' ? lang : lang?.label;
      if (label) chips.push({ key: `lang-${i}`, icon: i === 0 ? 'language-outline' : null, label });
    });
    (profile.openTo || []).forEach((item, i) => {
      const label = typeof item === 'string' ? item : item?.label;
      if (label) chips.push({ key: `open-${i}`, label, strong: true });
    });
    (profile.interests || []).slice(0, 4).forEach((item, i) => {
      if (item) chips.push({ key: `int-${i}`, label: item });
    });
    return chips;
  }, [profile.city, profile.countryCode, profile.profession, profile.languages, profile.openTo, profile.interests]);
  // Messaging permission. Pessimistic default — a stranger gets the
  // request composer, not a chat thread the server would reject their
  // first message from.
  const [canMessage, setCanMessage] = useState(false);
  const [requestStatus, setRequestStatus] = useState('none');
  const [showComposer, setShowComposer] = useState(false);

  const refreshConnection = useCallback(async () => {
    if (!session || !profile?.id || isDemoProfile) return;
    try {
      const [state, direct] = await Promise.all([
        connectionService.getConnectionState(profile.id),
        connectionService.canMessageDirectly(profile.id),
      ]);
      setRequestStatus(state?.requestStatus || 'none');
      setCanMessage(!!direct);
    } catch (e) {
      if (__DEV__) console.warn('Connection state failed:', e?.message);
      setCanMessage(false);
    }
  }, [session, profile?.id, isDemoProfile]);

  useEffect(() => { refreshConnection(); }, [refreshConnection]);

  // Tap-anywhere-on-card → deep profile. ProfileCard fires onExpand
  // when the user taps the centre band; left/right zones cycle photos.
  const openDetail = useCallback(() => {
    navigation.navigate('ProfileDetail', { profile, fromCard: true });
  }, [navigation, profile]);

  const handleClose = useCallback(() => {
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.navigate('Main');
  }, [navigation]);

  const handleMessage = useCallback(() => {
    if (isDemoProfile) {
      Alert.alert('Demo profile', 'Messaging works with real members.');
      return;
    }
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
  }, [isDemoProfile, canMessage, requestStatus, navigation, profile]);

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

  const handleFollow = useCallback(() => {
    if (followLoading) return;
    if (isDemoProfile) {
      Alert.alert('Demo profile', 'This is a demo card — following works with real members.');
      return;
    }
    toggleFollow();
    // A follow-back can complete the mutual connection that unlocks
    // direct messaging, so re-read rather than assume.
    setTimeout(refreshConnection, 400);
  }, [followLoading, isDemoProfile, toggleFollow, refreshConnection]);

  // Report — opens a short reason prompt then files via safetyService.
  // RLS lets reporters file but not read other reports, so this is
  // fire-and-forget. Demo profiles short-circuit since they have no
  // backing User row for the FK.
  const handleReport = useCallback(() => {
    if (isDemoProfile) {
      Alert.alert('Demo profile', 'Reporting works for real members.');
      return;
    }
    if (!profile?.id) return;
    Alert.alert(
      `Report ${profile.name || 'this profile'}?`,
      'Our moderation team will review this account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () => {
            safetyService
              .reportUser({ reportedId: profile.id, reason: 'profile_view_flag' })
              .then(() => Alert.alert('Reported', "Thanks — we'll take a look."))
              .catch((err) => Alert.alert("Couldn't report", err?.message || 'Try again in a moment.'));
          },
        },
      ],
    );
  }, [isDemoProfile, profile?.id, profile?.name]);

  // Block — confirmation then safetyService.blockUser. After a successful
  // block we close the screen since the viewer shouldn't keep looking at
  // someone they just blocked.
  const handleBlock = useCallback(() => {
    if (isDemoProfile) {
      Alert.alert('Demo profile', 'Block works for real members.');
      return;
    }
    if (!profile?.id) return;
    Alert.alert(
      `Block ${profile.name || 'this person'}?`,
      "They won't be able to message you or see your profile.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            safetyService
              .blockUser(profile.id)
              .then(() => {
                Alert.alert('Blocked', `${profile.name || 'They'} won't appear anymore.`);
                handleClose();
              })
              .catch((err) => Alert.alert("Couldn't block", err?.message || 'Try again in a moment.'));
          },
        },
      ],
    );
  }, [isDemoProfile, profile?.id, profile?.name, handleClose]);

  const handleMore = useCallback(() => {
    Alert.alert(
      profile.name || 'Profile',
      undefined,
      [
        { text: 'Report', style: 'destructive', onPress: handleReport },
        { text: 'Block',  style: 'destructive', onPress: handleBlock },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [profile.name, handleReport, handleBlock]);

  if (!profile?.id && !profile?.name) {
    // Empty params — bounce back to where the user came from rather
    // than render a blank card. Keeps the deep-link / map-tap paths
    // recoverable when the source row is malformed.
    return (
      <View style={styles.container}>
        <View style={[styles.errState, { paddingTop: insets.top + 80 }]}>
          <Ionicons name="person-circle-outline" size={56} color={colors.gray400} />
          <Text style={styles.errTitle}>Profile unavailable</Text>
          <Text style={styles.errBody}>This person's profile couldn't be loaded.</Text>
          <TouchableOpacity onPress={handleClose} style={styles.errBtn} activeOpacity={0.85}>
            <Text style={styles.errBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header bar — close on the left, label centred, more menu on the
          right. The more menu surfaces report + block so the top bar
          isn't visually left-heavy with just the close button. */}
      <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
        <TouchableOpacity
          onPress={handleClose}
          style={styles.closeBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Close profile"
        >
          <Ionicons name="chevron-down" size={26} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.topBarLabel} numberOfLines={1}>Profile</Text>
        <TouchableOpacity
          onPress={handleMore}
          style={styles.closeBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="More options"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* The card itself — same component the swipe deck uses, so the
          person renders the same way no matter how the viewer arrived.
          A small chevron-up chip overlays the card's top-right; tapping
          it (or the card itself) opens the full profile. Replaces the
          old floating "Tap card to see full profile" pill, which clogged
          the space between the card and the action bar. */}
      <View
        style={[
          styles.cardArea,
          {
            paddingTop: insets.top + 76,
            paddingBottom: ACTION_BAR_HEIGHT + insets.bottom + 36,
          },
        ]}
      >
        <View style={styles.cardWrap}>
          <ProfileCard
            profile={profile}
            onExpand={openDetail}
            style={styles.fullCard}
            // Action bar lives below the card on this screen (not
            // overlapping it like on HomeScreen), so the info pills
            // can sit near the natural bottom of the photo instead
            // of floating 96pt above it with empty space beneath.
            infoBottom={22}
          />
          <TouchableOpacity
            onPress={openDetail}
            style={styles.cardChevron}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="See full profile"
          >
            <Ionicons name="chevron-up" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Details strip — the facts that matter on a community
          platform (where they are, what they do, what they speak, what
          they're open to). Horizontal scroll so a long list degrades
          into a swipe rather than pushing the action bar off-screen. */}
      {metaChips.length > 0 && (
        <View style={[styles.metaWrap, { bottom: insets.bottom + ACTION_BAR_HEIGHT + 26 }]} pointerEvents="box-none">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.metaRow}
          >
            {metaChips.map((chip) => (
              <View
                key={chip.key}
                style={[styles.metaChip, chip.strong && styles.metaChipStrong]}
              >
                {chip.icon ? (
                  <Ionicons
                    name={chip.icon}
                    size={12}
                    color={chip.strong ? '#1A1A1A' : 'rgba(255,255,255,0.85)'}
                  />
                ) : null}
                <Text style={[styles.metaChipText, chip.strong && styles.metaChipTextStrong]}>
                  {chip.label}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Social action bar: Follow / Following · Message · More.
          Captions sit under each button — the icons alone aren't
          self-evident, and this screen is often someone's first
          encounter with the person. */}
      <View style={[styles.actionBarWrap, { bottom: insets.bottom + 20 }]} pointerEvents="box-none">
        <View style={styles.actionBar}>
          <View style={styles.actionItem}>
            <View style={styles.actionBtnSlot}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionFollow, (isFollowing || isFriend) && styles.actionFollowOn]}
                onPress={handleFollow}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: isFollowing || isFriend, disabled: followLoading }}
                accessibilityLabel={
                  isFriend ? `Connected with ${profile.name || 'this person'}, tap to unfollow`
                  : isFollowing ? `Following ${profile.name || 'this person'}, tap to unfollow`
                  : `Follow ${profile.name || 'this person'}`
                }
              >
                <Ionicons
                  name={isFriend ? 'people' : isFollowing ? 'checkmark' : 'person-add'}
                  size={22}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.actionBtnLabel}>
              {isFriend ? 'Connected' : isFollowing ? 'Following' : 'Follow'}
            </Text>
          </View>

          <View style={styles.actionItem}>
            <View style={styles.actionBtnSlot}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionMessage]}
                onPress={handleMessage}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={
                  canMessage
                    ? `Message ${profile.name || 'this person'}`
                    : requestStatus === 'pending_out'
                      ? `Message request already sent to ${profile.name || 'this person'}`
                      : `Send ${profile.name || 'this person'} a message request`
                }
              >
                <Ionicons name="chatbubble" size={22} color="#1A1A1A" />
              </TouchableOpacity>
            </View>
            <Text style={styles.actionBtnLabel}>
              {requestStatus === 'pending_out' && !canMessage ? 'Requested' : 'Message'}
            </Text>
          </View>

          <View style={styles.actionItem}>
            <View style={styles.actionBtnSlot}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionMore]}
                onPress={handleMore}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="More options, including block and report"
              >
                <Ionicons name="ellipsis-horizontal" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.actionBtnLabel}>More</Text>
          </View>
        </View>
      </View>

      <MessageRequestComposer
        visible={showComposer}
        name={profile.name}
        onCancel={() => setShowComposer(false)}
        onSend={handleSendRequest}
      />

      {nudge}
    </View>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    position: 'absolute',
    left: 0, right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 30,
  },
  closeBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    // Light tint so the button is visible on the screen's pure black bg.
    // The previous `rgba(0,0,0,0.45)` was invisible against #000.
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: FontFamily.semibold,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
  },
  cardArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  // Wraps ProfileCard so we can absolutely-position the chevron-up chip
  // inside the card's bounds (relative to this View) rather than the
  // whole screen.
  cardWrap: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  // ProfileCard has no intrinsic size — it expects the caller to stretch
  // it. HomeScreen passes the same shape; without this the card collapses
  // to zero width inside a centred parent and the screen looks empty.
  fullCard: {
    flex: 1,
    width: '100%',
  },
  // Small chevron-up chip in the card's top-right corner. Replaces the
  // old "Tap card to see full profile" floating pill — the affordance
  // now lives ON the card itself, freeing the space below the card and
  // matching the photo-card pattern users already know.
  cardChevron: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  // Outer container for the action group. Stays full width so the
  // pill inside can centre via alignItems; pointerEvents="box-none"
  // on the JSX lets taps pass through the transparent surround.
  actionBarWrap: {
    position: 'absolute',
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 25,
  },
  // The three action buttons float on the screen's black background —
  // no pill backdrop, no border. The earlier frosted-pill grouping was
  // pulled per design call.
  actionBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 22,
  },
  // Each action button + its caption stack vertically. Captions are
  // especially needed in Social mode where the buttons don't follow
  // the standard Tinder/dating iconography users already know.
  actionItem: {
    alignItems: 'center',
    gap: 6,
    width: 64,
  },
  // Fixed-size slot so the visually smaller Super / Follow buttons
  // (50×50) still occupy the same row height as the 58×58 primaries.
  // Without this the smaller buttons end higher than the others and
  // their captions render on a different baseline — exactly the
  // misalignment in the screenshots.
  actionBtnSlot: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 11,
    fontFamily: FontFamily.semibold,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowRadius: 4,
  },
  actionBtn: {
    width: 58, height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  actionFollow: {
    backgroundColor: colors.accent,
  },
  // Following/Connected is a neutral grey — the filled accent is
  // reserved for the action that's still available to take.
  actionFollowOn: {
    backgroundColor: '#6A6A6A',
  },
  // Warm flag-yellow for the primary conversation action.
  actionMessage: {
    backgroundColor: colors.accent,
  },
  actionMore: {
    backgroundColor: '#262626',
  },

  // ── Details strip ──
  metaWrap: {
    position: 'absolute',
    left: 0, right: 0,
    zIndex: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  // "Open to" chips are intent, not trivia — filled so they read first.
  metaChipStrong: {
    backgroundColor: colors.accent,
    borderColor: 'transparent',
  },
  metaChipText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 12,
    fontFamily: FontFamily.semibold,
  },
  metaChipTextStrong: {
    color: '#1A1A1A',
  },
  errState: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  errTitle: {
    ...Typography.h2,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  errBody: {
    ...Typography.body,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  errBtn: {
    marginTop: 16,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  errBtnText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.semibold,
    fontSize: 14,
  },
});
