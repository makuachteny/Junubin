// ProfileScreen — the "Profile" tab (claude.ai/design "JuNubin
// Redesign", Profile screen). Condensed h1, gold-ringed Blueprint avatar,
// a static follower
// strip, the PROFILE STRENGTH checklist (six rows, driven by the
// profileCompleteness util so the percent and checks can't disagree),
// OPEN TO chips, the ABOUT fact grid, LANGUAGES chips, and the Edit /
// Preview / theme actions.

import React, { useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useTheme, FontFamily } from '../theme';
import Blueprint from '../components/Blueprint';
import { imageSource } from '../utils/imageSource';
import { promptToOpenSettings } from '../utils/permissionAlert';
import { useCurrentUser } from '../hooks';
import { useMyFollowCounts } from '../hooks/useFollow';
import * as profileService from '../api/services/profileService';
import { calculateCompleteness } from '../utils/profileCompleteness';
import { OPEN_TO_BY_KEY, normalizeOpenTo } from '../data/openTo';
import { getCountryByCode } from '../data/countries';
import { getEthnicIdentity } from '../utils/ethnicIdentity';
import { bottomTabInset, layoutForWidth } from '../theme/layout';
import { useTabBarScrollVisibility } from '../navigation/TabBarVisibilityContext';

// The six checklist rows — keys mirror src/utils/profileCompleteness.js
// FIELDS exactly (the util tracks only these six, so each is 1/6).
// `action` names which surface a tap opens: the photo row runs the
// picker in place, verify is the PhotoVerification flow, everything
// else edits in EditProfile.
const STRENGTH_ROWS = [
  { key: 'photos',       label: 'Add a profile photo',      action: 'photo' },
  { key: 'ethnicity',    label: 'Add your background',      action: 'edit' },
  { key: 'languages',    label: 'Add languages',            action: 'edit' },
  { key: 'occupation',   label: 'Add occupation & school',  action: 'edit' },
  { key: 'promptAnswer', label: 'Answer a profile prompt',  action: 'edit' },
  { key: 'verified',     label: 'Verify your photo',        action: 'verify' },
];

// ss-tag chips cycle the four flag tint/dark pairs by index — the
// design's `ssTag(label, i)` helper.
const TAG_CYCLE = ['Blue', 'Green', 'Gold', 'Red'];
const tagColors = (colors, index) => {
  const c = TAG_CYCLE[index % TAG_CYCLE.length];
  return { backgroundColor: colors[`ss${c}Tint`], color: colors[`ss${c}Dark`] };
};

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, isDark, toggleTheme } = useTheme();
  const layout = useMemo(() => layoutForWidth(width), [width]);
  const styles = useMemo(() => getStyles(colors, layout), [colors, layout]);
  const { currentUser, refreshUser } = useCurrentUser();
  const [uploading, setUploading] = useState(false);
  const tabBarScrollProps = useTabBarScrollVisibility();

  // Re-pull the user every time Profile gains focus so edits made in
  // EditProfile / PhotoVerification are reflected on return — never a
  // stale in-memory copy.
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

  // "Add a profile photo" runs the picker right here — EditProfile no
  // longer manages photos, and bouncing through a form to add one photo
  // dead-ended the checklist's most important row.
  const handleAddPhoto = async () => {
    if (uploading) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      promptToOpenSettings({
        title: 'Photo access needed',
        message: 'JuNubin needs photo access to add profile photos. Enable it in Settings.',
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      await profileService.uploadPhoto(result.assets[0].uri);
      await refreshUser();
    } catch (err) {
      Alert.alert('Upload failed', err.message || 'Could not upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleStrengthRow = (action) => {
    if (action === 'photo') return handleAddPhoto();
    if (action === 'verify') return navigation.navigate('PhotoVerification');
    return navigation.navigate('EditProfile');
  };

  const handleEdit = () => navigation.navigate('EditProfile');
  // "Preview as others" reuses the same full-screen detail view the
  // Directory opens for other people — no bespoke preview surface.
  const handlePreview = () => navigation.navigate('ProfileDetail', {
    profile: {
      ...(displayUser || {}),
      userId: displayUser?.id,
      images: displayUser?.images || [],
    },
    selfPreview: true,
  });

  const countryName =
    getCountryByCode(displayUser?.countryCode)?.name || displayUser?.country;
  const cityLine = [
    [displayUser?.city, countryName].filter(Boolean).join(', '),
    displayUser?.pronouns,
  ].filter(Boolean).join(' · ');

  const openToLabels = normalizeOpenTo(displayUser?.openTo)
    .map((key) => OPEN_TO_BY_KEY[key]?.label || key);
  const languages = Array.isArray(displayUser?.languages) ? displayUser.languages : [];

  // ABOUT grid — the design's `meFacts`. Unset cells keep the design's
  // "Add …" placeholder in muted ink rather than collapsing, so the
  // grid always reads as four (here three) equal cells.
  //
  // The design's HOMETOWN cell is omitted: Profile has no hometown
  // column, and User.city is the person's CURRENT city (already shown
  // in the header line), so filling HOMETOWN from it would put a
  // different datum under the design's label. Blocked on a migration.
  const facts = [
    { k: 'OCCUPATION', v: displayUser?.profession, placeholder: 'Add occupation' },
    { k: 'SCHOOL',     v: displayUser?.education,  placeholder: 'Add school' },
    { k: 'BACKGROUND', v: displayUser?.ethnicity,  placeholder: 'Add background' },
  ].map((f) => {
    const value = typeof f.v === 'string' ? f.v.trim() : '';
    return { k: f.k, v: value || f.placeholder, isSet: !!value };
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <ScrollView
        {...tabBarScrollProps}
        style={styles.content}
        contentContainerStyle={[styles.contentInner, { paddingBottom: bottomTabInset(insets.bottom) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header row: h1 + gear ── */}
        <View style={styles.headerRow}>
          <View style={styles.headerBody}>
            <Text style={styles.headerTitle} accessibilityRole="header">Profile</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={21} color={colors.black} />
          </TouchableOpacity>
        </View>

        {/* ── Identity row ── */}
        <View style={styles.identityRow}>
          <View style={styles.avatarRing}>
            <Blueprint style={styles.avatarFrame}>
              <Image
                source={imageSource(displayUser?.images?.[0])}
                style={styles.avatar}
                resizeMode="cover"
                accessibilityLabel="Your profile photo"
              />
            </Blueprint>
          </View>
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
            {/* Static stats — FollowList is gone; these are facts, not links. */}
            <View style={styles.statsStrip}>
              <View style={[styles.statCell, styles.statCellDivided]}>
                <Text style={styles.statText}>
                  <Text style={styles.statNum}>{followCounts.followers}</Text>
                  <Text> followers</Text>
                </Text>
              </View>
              <View style={styles.statCell}>
                <Text style={styles.statText}>
                  <Text style={styles.statNum}>{followCounts.following}</Text>
                  <Text> following</Text>
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Profile strength ── */}
        <Blueprint style={styles.strengthCard}>
          <View style={styles.strengthHeader}>
            <Text style={styles.strengthTitle}>PROFILE STRENGTH</Text>
            <Text style={styles.strengthPct}>{completeness.score}%</Text>
          </View>
          <View style={styles.strengthTrack}>
            <LinearGradient
              colors={[colors.ssGreen, colors.ssGold, colors.ssBlue]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.strengthFill, { width: `${completeness.score}%` }]}
            />
          </View>
          <View style={styles.strengthList}>
            {STRENGTH_ROWS.map((row) => {
              const done = !missingKeys.has(row.key);
              return (
                <TouchableOpacity
                  key={row.key}
                  style={styles.strengthRow}
                  onPress={() => handleStrengthRow(row.action)}
                  disabled={row.action === 'photo' && uploading}
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
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>OPEN TO</Text>
            <View style={styles.chipWrap}>
              {openToLabels.map((label, i) => {
                const tag = tagColors(colors, i);
                return (
                  <View key={label} style={[styles.tagChip, { backgroundColor: tag.backgroundColor }]}>
                    <Text style={[styles.tagChipText, { color: tag.color }]}>{label}</Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}

        {/* ── About ── */}
        <Text style={[styles.sectionLabel, { marginTop: 18 }]}>ABOUT</Text>
        <View style={styles.factGrid}>
          {facts.map((fact) => (
            <View key={fact.k} style={styles.factSlot}>
              <View style={styles.factCell}>
                <Text style={styles.factKey}>{fact.k}</Text>
                <Text style={[styles.factValue, !fact.isSet && styles.factValueUnset]}>
                  {fact.v}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Languages ── */}
        {languages.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 18 }]}>LANGUAGES</Text>
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
        <TouchableOpacity
          style={[styles.outlineBtn, styles.themeBtn]}
          onPress={toggleTheme}
          accessibilityRole="button"
          accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <Text style={styles.outlineBtnText}>
            {isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors, layout) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: layout.horizontal,
    ...layout.centeredContent,
  },

  // ── Header ──
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBody: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 31,
    lineHeight: 31,
    marginTop: 2,
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
  // Design: `outline: 3px solid var(--ss-gold); outline-offset: 2px` —
  // RN has no outline, so a bordered wrapper with a 2px gap stands in.
  avatarRing: {
    borderWidth: 3,
    borderColor: colors.ssGold,
    padding: 2,
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
    color: colors.gray500,
    marginTop: 2,
  },
  statsStrip: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
  },
  statCell: {
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  statCellDivided: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.separator,
  },
  statText: {
    fontFamily: FontFamily.regular,
    fontSize: 12.5,
    color: colors.gray500,
  },
  statNum: {
    fontFamily: FontFamily.heading,
    fontSize: 15,
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
    letterSpacing: 0.9,
    color: colors.black,
  },
  strengthPct: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: colors.accentDark,
  },
  strengthTrack: {
    height: 5,
    backgroundColor: colors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
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
    color: colors.gray500,
    textTransform: 'uppercase',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tagChip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 2,
  },
  tagChipText: {
    fontFamily: FontFamily.semibold,
    fontSize: 12,
  },
  // Design: `grid-template-columns:1fr 1fr; gap:10`. RN has no grid, so
  // half-width slots with 5pt side padding (outdented by the same 5 on
  // the container) give a true 10pt gutter at any screen width, and an
  // odd cell out stays in the left column instead of stretching.
  factGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginHorizontal: -5,
    rowGap: 10,
  },
  factSlot: {
    width: '50%',
    paddingHorizontal: 5,
  },
  factCell: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  factKey: {
    fontFamily: FontFamily.semibold,
    fontSize: 10.5,
    letterSpacing: 1.05,
    color: colors.gray400,
  },
  factValue: {
    fontFamily: FontFamily.medium,
    fontSize: 13.5,
    marginTop: 3,
    color: colors.black,
  },
  factValueUnset: {
    color: colors.gray400,
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
  themeBtn: {
    flex: 0,
    width: '100%',
    marginTop: 10,
  },
  outlineBtnText: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    color: colors.black,
  },
});
