// ProfileScreen — the "Profile" tab (also reachable as the `Profile`
// stack route, e.g. from Messages). Industry redesign: square
// Blueprint-framed avatar, condensed display type, a PROFILE STRENGTH
// checklist driven by the profileCompleteness util, and OPEN TO /
// LANGUAGES chip sections.
//
// Renders correctly both as a bottom tab (no back affordance) and when
// pushed on the stack (back chevron appears because canGoBack() is true).

import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FontFamily } from '../theme';
import Blueprint from '../components/Blueprint';
import { imageSource } from '../utils/imageSource';
import { useCurrentUser } from '../hooks';
import { useMyFollowCounts } from '../hooks/useFollow';
import { calculateCompleteness } from '../utils/profileCompleteness';
import { OPEN_TO_BY_KEY, normalizeOpenTo } from '../data/openTo';

// The strength checklist shows a curated subset of the completeness
// fields (the mock shows ~5 rows, the util tracks 11). Keys/steps
// mirror src/utils/profileCompleteness.js FIELDS — done-ness comes
// from the util's `missing` list, so the percent and the checks can
// never disagree.
const STRENGTH_ROWS = [
  { key: 'photos', label: 'Add at least 3 photos', step: 'photos' },
  { key: 'bio', label: 'Write a bio', step: 'bio' },
  { key: 'job', label: 'Add your job title', step: 'job' },
  { key: 'ethnicity', label: 'Add your tribe / heritage', step: 'ethnicity' },
  { key: 'openTo', label: 'Say what you are open to', step: 'openTo' },
  { key: 'verified', label: 'Verify your photos', step: 'verify' },
];

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { currentUser, refreshUser } = useCurrentUser();

  // Re-pull the user from the server every time Profile gains focus so
  // edits made in EditProfile (a modal pushed on top) are always
  // reflected when the user returns here — never a stale in-memory copy.
  useFocusEffect(
    useCallback(() => {
      refreshUser?.();
    }, [refreshUser]),
  );

  const displayUser = currentUser;
  const followCounts = useMyFollowCounts(currentUser?.id);

  const completeness = useMemo(
    () => calculateCompleteness(displayUser?._raw || displayUser),
    [displayUser],
  );
  const missingKeys = useMemo(
    () => new Set((completeness.missing || []).map((m) => m.key)),
    [completeness],
  );

  const handleEdit = () => navigation.navigate('EditProfile');
  // The verify step has no editor section — it IS the PhotoVerification
  // flow; routing it into EditProfile dead-ended at the top of the form.
  const handleStrengthRow = (step) => (
    step === 'verify'
      ? navigation.navigate('PhotoVerification')
      : navigation.navigate('EditProfile', { focusStep: step })
  );
  // "Preview as others" reuses the same full-screen profile view the
  // Directory opens for other people — no bespoke preview surface.
  const handlePreview = () => navigation.navigate('ProfileView', {
    profile: { ...(displayUser || {}), images: displayUser?.images || [] },
    // Own-profile preview: ProfileView hides Follow/Message so the
    // owner can't fire self-targeted actions from their own card.
    preview: true,
  });
  const openFollowList = (initialTab) => navigation.navigate('FollowList', {
    userId: displayUser?.id, userName: displayUser?.name, initialTab,
  });

  const cityLine = [
    [displayUser?.city, displayUser?.country].filter(Boolean).join(', '),
    displayUser?.pronouns,
  ].filter(Boolean).join(' · ');

  const openToLabels = normalizeOpenTo(displayUser?.openTo)
    .map((key) => OPEN_TO_BY_KEY[key]?.label || key);
  const languages = Array.isArray(displayUser?.languages) ? displayUser.languages : [];

  const canGoBack = navigation?.canGoBack?.();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentInner, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header row ── */}
        <View style={styles.headerRow}>
          {canGoBack ? (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.headerBtn}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Ionicons name="chevron-back" size={24} color={colors.black} />
            </TouchableOpacity>
          ) : null}
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={21} color={colors.black} />
          </TouchableOpacity>
        </View>

        {/* ── Identity block ── */}
        <View style={styles.identityRow}>
          <Blueprint style={styles.avatarFrame}>
            <Image
              source={imageSource(displayUser?.images?.[0])}
              style={styles.avatar}
              resizeMode="cover"
              accessibilityLabel="Your profile photo"
            />
          </Blueprint>
          <View style={styles.identityBody}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {displayUser?.name}
                {displayUser?.age ? `, ${displayUser.age}` : ''}
              </Text>
              {displayUser?.verified ? (
                <Ionicons
                  name="shield-checkmark-outline"
                  size={17}
                  color={colors.accentDark}
                  accessibilityLabel="Verified"
                />
              ) : null}
            </View>
            {cityLine ? <Text style={styles.cityLine} numberOfLines={1}>{cityLine}</Text> : null}
            <View style={styles.followRow}>
              <TouchableOpacity
                onPress={() => openFollowList('Followers')}
                accessibilityRole="button"
                accessibilityLabel={`${followCounts.followers} followers`}
                hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
              >
                <Text style={styles.followText}>
                  <Text style={styles.followNum}>{followCounts.followers}</Text> followers
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => openFollowList('Following')}
                accessibilityRole="button"
                accessibilityLabel={`${followCounts.following} following`}
                hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
              >
                <Text style={styles.followText}>
                  <Text style={styles.followNum}>{followCounts.following}</Text> following
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Profile strength (replaces the old completeness banner) ── */}
        <Blueprint style={styles.strengthCard}>
          <View style={styles.strengthHeader}>
            <Text style={styles.strengthTitle}>PROFILE STRENGTH</Text>
            <Text style={styles.strengthPct}>{completeness.score}%</Text>
          </View>
          <View style={styles.strengthBar}>
            <View style={[styles.strengthFill, { width: `${completeness.score}%` }]} />
          </View>
          <View style={styles.strengthList}>
            {STRENGTH_ROWS.map((row) => {
              const done = !missingKeys.has(row.key);
              return (
                <TouchableOpacity
                  key={row.key}
                  style={styles.strengthRow}
                  onPress={() => handleStrengthRow(row.step)}
                  accessibilityRole="button"
                  accessibilityState={{ checked: done }}
                  accessibilityLabel={`${row.label}${done ? ', done' : ''}`}
                >
                  <View style={[styles.check, done ? styles.checkDone : styles.checkTodo]}>
                    {done ? (
                      <Ionicons name="checkmark" size={11} color={colors.cream} />
                    ) : null}
                  </View>
                  <Text style={[styles.strengthLabel, done && styles.strengthLabelDone]}>
                    {row.label}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.gray400} />
                </TouchableOpacity>
              );
            })}
          </View>
        </Blueprint>

        {/* ── Open to ── */}
        {openToLabels.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>OPEN TO</Text>
            <View style={styles.chipWrap}>
              {openToLabels.map((label) => (
                <View key={label} style={styles.openChip}>
                  <Text style={styles.openChipText}>{label}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* ── Languages ── */}
        {languages.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>LANGUAGES</Text>
            <View style={styles.chipWrap}>
              {languages.map((lang) => (
                <View key={lang} style={styles.langChip}>
                  <Text style={styles.langChipText}>{lang}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* ── Actions ── */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={handleEdit}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            <Text style={styles.outlineBtnText}>Edit profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={handlePreview}
            accessibilityRole="button"
            accessibilityLabel="Preview as others"
          >
            <Text style={styles.outlineBtnText}>Preview as others</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },

  // ── Header ──
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: FontFamily.heading,
    fontSize: 28,
    color: colors.black,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Identity ──
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 12,
  },
  avatarFrame: {
    width: 86,
    height: 86,
    backgroundColor: colors.surfaceMuted,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  identityBody: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  name: {
    fontFamily: FontFamily.heading,
    fontSize: 24,
    color: colors.black,
    flexShrink: 1,
  },
  cityLine: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: colors.gray600,
    marginTop: 2,
  },
  followRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 6,
  },
  followText: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: colors.gray600,
  },
  followNum: {
    fontFamily: FontFamily.bold,
    color: colors.black,
  },

  // ── Profile strength ──
  strengthCard: {
    marginTop: 18,
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 8,
    backgroundColor: colors.cream,
  },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  strengthTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 15,
    letterSpacing: 1,
    color: colors.black,
  },
  strengthPct: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: colors.accentDark,
  },
  strengthBar: {
    height: 5,
    backgroundColor: colors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  strengthFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  strengthList: {
    marginTop: 2,
  },
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 40,
  },
  check: {
    width: 17,
    height: 17,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: {
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  checkTodo: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.gray400,
  },
  strengthLabel: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 13.5,
    color: colors.black,
  },
  strengthLabelDone: {
    color: colors.gray400,
    textDecorationLine: 'line-through',
  },

  // ── Sections ──
  sectionLabel: {
    fontFamily: FontFamily.semibold,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.gray600,
    textTransform: 'uppercase',
    marginTop: 20,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  openChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: colors.accentTint15,
    borderRadius: 2,
  },
  openChipText: {
    fontFamily: FontFamily.semibold,
    fontSize: 12,
    color: colors.accentDark,
  },
  langChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    borderRadius: 2,
  },
  langChipText: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: colors.black,
  },

  // ── Actions ──
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 22,
  },
  outlineBtn: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  outlineBtnText: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    color: colors.black,
  },
});
