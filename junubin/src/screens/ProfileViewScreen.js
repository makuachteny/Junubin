// ProfileViewScreen — card-first profile preview.
//
// Sits between an entry point (PeopleMap marker, Notifications row,
// follow-list row, future tap surfaces) and the deep
// ProfileDetailScreen. Renders the person as a single ProfileCard so
// the user gets the same compact, photo-led preview they'd see in
// the swipe deck. Tapping the card (or the explicit CTA) navigates
// onward to ProfileDetail for the full scroll-through.
//
// Mode awareness: when the viewer is in Social mode we hide the
// Dating action set (Pass / Like / Super-like) and surface a Follow
// + Say hi affordance instead. Social-mode users shouldn't be nudged
// into swipe semantics they didn't sign up for.

import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FontFamily, Typography } from '../theme';
import ProfileCard from '../components/ProfileCard';
import * as discoverService from '../api/services/discoverService';
import * as safetyService from '../api/services/safetyService';
import { useCurrentUser, useEligibility } from '../hooks';
import { useFollow } from '../hooks/useFollow';
import { isDemoId } from '../config/demoData';
import { reportError } from '../utils/reportError';

// Visual height of the action bar (button slot 58 + 6 gap + ~18 label).
// Used by the cardArea and tapCta to reserve space so they don't overlap.
const ACTION_BAR_HEIGHT = 82;

export default function ProfileViewScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const profile = route.params?.profile || {};
  // The caller may pass an explicit mode — useful when the entry
  // point already knows it (e.g. PeopleMap is rendered inside a
  // specific mode context). Otherwise we fall back to the viewer's
  // current preference.
  const { currentUser } = useCurrentUser();
  const explicitMode = route.params?.mode;
  const viewerMode = explicitMode
    || (currentUser?.preferences?.mode === 'Social' ? 'social' : 'dating');
  const isDating = viewerMode === 'dating';

  const { gate, nudge } = useEligibility();
  // Demo roster ids (demo_*) aren't backed by real User rows — server
  // RPCs error out on the FK. Pass null so useFollow short-circuits
  // its fetches and recordSwipe / toggleFollow no-op below.
  const isDemoProfile = isDemoId(profile?.id);
  const { isFollowing, toggleFollow, loading: followLoading } = useFollow(
    isDemoProfile ? null : profile?.id,
  );
  const [done, setDone] = useState(false);

  // Tap-anywhere-on-card → deep profile. ProfileCard fires onExpand
  // when the user taps the centre band; left/right zones cycle photos.
  const openDetail = useCallback(() => {
    navigation.navigate('ProfileDetail', { profile, fromCard: true });
  }, [navigation, profile]);

  const handleSwipeOrAction = useCallback((direction) => {
    if (done) return;
    const action = direction === 'right' ? 'swipe_like' : 'swipe_pass';
    if (action === 'swipe_like' && !gate('swipe_like')) return;
    setDone(true);
    // Pass swipes don't need a result — they go back immediately so
    // the user keeps browsing. Like swipes need the result so we can
    // surface a Match (route to chat) when one happens. Demo profiles
    // bypass the network round-trip and just close.
    if (!profile?.id || isDemoProfile) {
      navigation.goBack();
      return;
    }
    if (direction !== 'right') {
      // Fire-and-forget pass — we don't block the navigation on the
      // round trip because pass swipes don't need a result. Errors get
      // reported so we can see if pass swipes are dropping silently
      // (early symptom of an outage in the swipe Edge Function).
      discoverService
        .recordSwipe(profile.id, 'pass', { mode: viewerMode })
        .catch((err) => reportError('ProfileViewScreen.recordSwipe.pass', err, { profileId: profile.id }));
      navigation.goBack();
      return;
    }
    discoverService
      .recordSwipe(profile.id, 'like', { mode: viewerMode })
      .then((result) => {
        if (result?.match?.conversation?.id) {
          // Mutual like → route to the brand-new conversation so the
          // celebration overlay on HomeScreen's next focus and the
          // chat thread land in one navigation tick. Same UX HomeScreen
          // gives when the swipe deck produces a match.
          navigation.navigate('Main', {
            screen: 'HomeTab',
            params: { celebrateMatchId: result.match.id, matchedProfile: profile },
          });
          return;
        }
        navigation.goBack();
      })
      .catch((err) => {
        // Network blip — unlock the buttons so the user can retry
        // instead of being stuck on a frozen "done" state with no
        // visible feedback that the network failed.
        reportError('ProfileViewScreen.recordSwipe.like', err, { profileId: profile.id });
        setDone(false);
      });
  }, [done, gate, profile, isDemoProfile, viewerMode, navigation]);

  const handleSuperLike = useCallback(() => {
    if (done) return;
    if (!gate('super_like')) return;
    setDone(true);
    if (!profile?.id || isDemoProfile) {
      navigation.goBack();
      return;
    }
    discoverService
      .recordSwipe(profile.id, 'super_like', { mode: viewerMode })
      .then((result) => {
        if (result?.match?.conversation?.id) {
          navigation.navigate('Main', {
            screen: 'HomeTab',
            params: { celebrateMatchId: result.match.id, matchedProfile: profile },
          });
          return;
        }
        navigation.goBack();
      })
      .catch((err) => {
        reportError('ProfileViewScreen.recordSwipe.super_like', err, { profileId: profile.id });
        setDone(false);
      });
  }, [done, gate, profile, isDemoProfile, viewerMode, navigation]);

  const handleSayHi = useCallback(() => {
    if (done) return;
    // Social-mode equivalent of a like — gate on swipe_like (the
    // server-side check is identical; Social wave and Dating like
    // both write a Swipe row and both can produce a Match if
    // reciprocal). Previously this gated on 'open_match', which
    // was the wrong action and surfaced the wrong nudge copy.
    if (!gate('swipe_like')) return;
    setDone(true);
    // Persist the wave as a like with mode='social'. The swipe Edge
    // Function records the row, runs Elo updates, and creates a Match
    // if the recipient has already waved at the caller (Profile.appMode
    // = social on either side preserves the social-mode framing on
    // the resulting conversation). Without this call the previous
    // "Sent a wave 👋" toast was cosmetic — nothing actually shipped
    // to the server and the recipient never saw the wave.
    if (profile?.id && !isDemoProfile) {
      discoverService
        .recordSwipe(profile.id, 'like', { mode: 'social' })
        .then((result) => {
          if (result?.match) {
            // Mutual wave → route the user into the new conversation.
            // Matches the Dating-mode behaviour where a mutual like
            // takes you to chat. Falls back to a friendly toast if
            // the server didn't return a conversation id (rare —
            // would be a transient downstream failure).
            const convId = result.match?.conversation?.id;
            if (convId) {
              navigation.navigate('Chat', { match: profile, conversationId: convId, fromMatch: true });
              return;
            }
          }
          // No match yet — just confirm the wave landed and head back.
          // No popup; the Likes/Waves screen is where the recipient
          // will discover it, and the sender's own send is implicit.
          navigation.goBack();
        })
        .catch(() => {
          // Network blip — restore the action so the user can retry
          // rather than being stuck on a stale "done" state.
          setDone(false);
        });
    } else {
      navigation.goBack();
    }
  }, [done, gate, profile, isDemoProfile, navigation]);

  const handleClose = useCallback(() => {
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.navigate('Main');
  }, [navigation]);

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
        <Text style={styles.topBarLabel} numberOfLines={1}>
          {isDating ? 'Preview' : 'Say hi'}
        </Text>
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
            onSwipe={handleSwipeOrAction}
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

      {/* Mode-aware action bar. Each button is wrapped with a small caption
          underneath — Dating actions follow Tinder convention but Social
          mode (Close / Follow / Say hi) is less obvious without labels, so
          we standardise on labelling all three for consistency. The whole
          group sits inside a soft frosted pill so it reads as a single
          control dock rather than three free-floating circles. */}
      <View style={[styles.actionBarWrap, { bottom: insets.bottom + 20 }]} pointerEvents="box-none">
        <View style={styles.actionBar}>
        {isDating ? (
          <>
            <View style={styles.actionItem}>
              <View style={styles.actionBtnSlot}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionPass]}
                  onPress={() => handleSwipeOrAction('left')}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Pass"
                >
                  <Ionicons name="close" size={28} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.actionBtnLabel}>Pass</Text>
            </View>
            <View style={styles.actionItem}>
              <View style={styles.actionBtnSlot}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionSuper]}
                  onPress={handleSuperLike}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Super like"
                >
                  <Ionicons name="star" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.actionBtnLabel}>Super</Text>
            </View>
            <View style={styles.actionItem}>
              <View style={styles.actionBtnSlot}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionLike]}
                  onPress={() => handleSwipeOrAction('right')}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Like"
                >
                  <Ionicons name="heart" size={26} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.actionBtnLabel}>Like</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.actionItem}>
              <View style={styles.actionBtnSlot}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionPass]}
                  onPress={handleClose}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={28} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.actionBtnLabel}>Close</Text>
            </View>
            <View style={styles.actionItem}>
              <View style={styles.actionBtnSlot}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionFollow, isFollowing && styles.actionFollowOn]}
                  onPress={() => {
                    if (followLoading) return;
                    if (isDemoProfile) {
                      // No real User row for demo entries; show a friendly
                      // toast instead of pretending the follow landed.
                      Alert.alert('Demo profile', 'This is a demo card — follow works once you connect with real members.');
                      return;
                    }
                    toggleFollow();
                  }}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={isFollowing ? 'Unfollow' : 'Follow'}
                >
                  <Ionicons name={isFollowing ? 'person-remove' : 'person-add'} size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.actionBtnLabel}>{isFollowing ? 'Following' : 'Follow'}</Text>
            </View>
            <View style={styles.actionItem}>
              <View style={styles.actionBtnSlot}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionSayHi]}
                  onPress={handleSayHi}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Say hi"
                >
                  <Ionicons name="hand-left" size={24} color="#1A1A1A" />
                </TouchableOpacity>
              </View>
              <Text style={styles.actionBtnLabel}>Say hi</Text>
            </View>
          </>
        )}
        </View>
      </View>

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
  actionPass: {
    backgroundColor: '#262626',
  },
  actionSuper: {
    backgroundColor: '#4DA6FF',
    width: 50, height: 50, borderRadius: 25,
  },
  actionLike: {
    backgroundColor: colors.accent,
  },
  actionFollow: {
    backgroundColor: '#0095F6',
    width: 50, height: 50, borderRadius: 25,
  },
  actionFollowOn: {
    backgroundColor: '#6A6A6A',
  },
  // Warm flag-yellow for the social-mode wave. Red (the old style)
  // reads as a block/stop signal — the very opposite of "say hi".
  actionSayHi: {
    backgroundColor: '#FCCD12',
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
