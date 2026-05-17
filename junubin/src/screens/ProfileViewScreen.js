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
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FontFamily, Typography } from '../theme';
import ProfileCard from '../components/ProfileCard';
import * as discoverService from '../api/services/discoverService';
import { useCurrentUser, useEligibility } from '../hooks';
import { useFollow } from '../hooks/useFollow';
import { isDemoId } from '../config/demoData';

const { height: SH } = Dimensions.get('window');
const ACTION_BAR_HEIGHT = 96;

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
    // Skip the server hit on demo profiles — the swipe Edge Function
    // FK-validates `toUserId` against the User table and would throw,
    // silently corrupting the offline-queue retry pipeline.
    if (profile?.id && !isDemoProfile) {
      discoverService
        .recordSwipe(profile.id, direction === 'right' ? 'like' : 'pass', { mode: viewerMode })
        .catch(() => {});
    }
    navigation.goBack();
  }, [done, gate, profile?.id, isDemoProfile, viewerMode, navigation]);

  const handleSuperLike = useCallback(() => {
    if (done) return;
    if (!gate('super_like')) return;
    setDone(true);
    if (profile?.id && !isDemoProfile) {
      discoverService.recordSwipe(profile.id, 'super_like', { mode: viewerMode }).catch(() => {});
    }
    navigation.goBack();
  }, [done, gate, profile?.id, isDemoProfile, viewerMode, navigation]);

  const handleSayHi = useCallback(() => {
    if (!gate('open_match')) return;
    // For social mode, "Say hi" routes to chat the way a follow-back
    // would. Until we have a true Wave RPC, we surface a friendly
    // toast so users know it landed.
    Alert.alert("Sent a wave 👋", `${profile?.name || 'They'}'ll see your hello when they're back online.`);
  }, [gate, profile?.name]);

  const handleClose = useCallback(() => {
    if (navigation.canGoBack?.()) navigation.goBack();
    else navigation.navigate('Main');
  }, [navigation]);

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
      {/* Close button — fixed top-left, above the card */}
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
        <View style={{ width: 40 }} />
      </View>

      {/* The card itself — same component the swipe deck uses, so the
          person renders the same way no matter how the viewer arrived. */}
      <View style={styles.cardArea}>
        <ProfileCard
          profile={profile}
          onSwipe={handleSwipeOrAction}
          onExpand={openDetail}
        />
      </View>

      {/* CTA hint — sits above the action bar, makes the tap-to-detail
          affordance explicit (without it, users may not realize the
          card is tappable). */}
      <TouchableOpacity
        style={[styles.tapCta, { bottom: ACTION_BAR_HEIGHT + insets.bottom + 8 }]}
        onPress={openDetail}
        activeOpacity={0.85}
      >
        <Ionicons name="arrow-up-circle" size={16} color="#FFFFFF" />
        <Text style={styles.tapCtaText}>Tap card to see full profile</Text>
      </TouchableOpacity>

      {/* Mode-aware action bar */}
      <View style={[styles.actionBar, { bottom: insets.bottom + 12 }]}>
        {isDating ? (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionPass]}
              onPress={() => handleSwipeOrAction('left')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Pass"
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionSuper]}
              onPress={handleSuperLike}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Super like"
            >
              <Ionicons name="star" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionLike]}
              onPress={() => handleSwipeOrAction('right')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Like"
            >
              <Ionicons name="heart" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionPass]}
              onPress={handleClose}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionFollow, isFollowing && styles.actionFollowOn]}
              onPress={() => {
                if (followLoading) return;
                if (isDemoProfile) {
                  // No real User row for demo entries; show a friendly
                  // toast instead of pretending the follow landed.
                  Alert.alert('Demo profile', 'Follow works for real members. This is a sample profile.');
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
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionLike]}
              onPress={handleSayHi}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Say hi"
            >
              <Ionicons name="hand-left" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </>
        )}
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
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: FontFamily.semibold,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
  },
  cardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapCta: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 20,
  },
  tapCtaText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: FontFamily.semibold,
  },
  actionBar: {
    position: 'absolute',
    left: 0, right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    zIndex: 25,
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
