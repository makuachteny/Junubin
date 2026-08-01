// JuNubin — Discovery preferences
//
// The controls that shape WHO YOU SEE on the Nearby map and in the
// Directory. JuNubin is a free people-discovery + chat app:
//   - There is no paid tier, so there is no `lockable` gating, no lock
//     icons, no "subscriber preferences" split and no upgrade prompt.
//     Every preference below is available to every member.
//   - There is no Dating/Social mode. One mode, one list.
//
// Single-select rows (distance, background) push into
// PreferenceSelectScreen. The multi-selects (languages, open to) are
// rendered inline as chips, matching EditProfileScreen's idiom.

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, Typography, FontFamily, getShadow } from '../theme';
import { useAuth } from '../auth';
import { useCurrentUser } from '../hooks';
import * as profileService from '../api/services/profileService';
import { TRIBES } from '../data/tribes';
import { LANGUAGE_OPTIONS, normalizeLanguages } from '../data/languages';
import { OPEN_TO_OPTIONS, normalizeOpenTo } from '../data/openTo';

// Sentinel for "no filter on this field". Persisted as '' so the
// backend stores an absent preference rather than the literal string.
const OPEN_TO_ALL = 'Open to all';
const DEFAULT_DISTANCE = '25 miles';

// "Verified members only" is a client-side discovery filter (the same
// one DirectoryScreen and PeopleMap apply locally) — there is no
// Profile column for it, so it persists to AsyncStorage rather than
// riding along with the profile write.
const VERIFIED_ONLY_KEY = '@junubin_pref_verified_only';

// ── Single-select rows ──────────────────────────────────────
// Each navigates to PreferenceSelectScreen with PREF_OPTIONS[key].
const DISCOVERY_PREFS = [
  { key: 'distance', label: 'Maximum distance', value: DEFAULT_DISTANCE, icon: 'navigate-outline' },
  { key: 'ethnicity', label: 'Background', value: OPEN_TO_ALL, icon: 'flag-outline' },
];

// ── Options for each single-select preference ───────────────
const PREF_OPTIONS = {
  distance: [
    { label: '5 miles', value: '5 miles', description: 'Very close by' },
    { label: '10 miles', value: '10 miles', description: 'Nearby' },
    { label: '25 miles', value: '25 miles', description: 'Within your area' },
    { label: '50 miles', value: '50 miles', description: 'Extended range' },
    { label: '100 miles', value: '100 miles', description: 'Wide search' },
  ],
  ethnicity: [
    { label: OPEN_TO_ALL, value: OPEN_TO_ALL, icon: 'globe-outline' },
    ...TRIBES.filter((t) => t.key !== 'Other').map((t) => ({
      label: t.key,
      value: t.key,
      icon: 'flag-outline',
      description: t.note || t.region || undefined,
    })),
  ],
};

// Icon chips are deliberately neutral — nothing on this screen should
// read as an alert or a paywall.
const ICON_CHIP = {
  light: '#F4F4F6',
  dark: 'rgba(255,255,255,0.06)',
  iconLight: '#1A1A1A',
  iconDark: '#F5F3F0',
};

// A value is "default" when it isn't narrowing anything.
const isDefaultValue = (val) => !val || val === OPEN_TO_ALL;

// currentUser.preferences.distance is miles rounded from maxDistanceKm,
// so it rarely lands exactly on one of our option values. Snap to the
// closest option instead of silently resetting the user to the default.
const nearestDistanceLabel = (miles) => {
  if (!Number.isFinite(miles)) return DEFAULT_DISTANCE;
  let best = DEFAULT_DISTANCE;
  let bestDelta = Infinity;
  for (const option of PREF_OPTIONS.distance) {
    const delta = Math.abs(Number(String(option.value).split(' ')[0]) - miles);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = option.value;
    }
  }
  return best;
};

// Maps a caller-supplied `returnTo` hint onto the bottom-tab the user
// should land on when they finish with the filters. Anything not in
// this map is treated as a direct stack-screen name (see routeAfterDone).
// `Likes` and `Community` are kept as aliases onto surviving tabs, not
// removed: a stale `returnTo` from a deep link or an older build would
// otherwise fall through to routeAfterDone and try to navigate to a tab
// that no longer exists.
const RETURN_TAB = {
  Discover: 'HomeTab',
  Home: 'HomeTab',
  Connect: 'HomeTab',
  Nearby: 'HomeTab',
  Directory: 'DirectoryTab',
  Messages: 'MessagesTab',
  Likes: 'MessagesTab',
  Community: 'HomeTab',
};

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function PressablePrefRow({ style, onPress, activeOpacity, children, ...a11yProps }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      tension: 68,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 68,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };
  return (
    <AnimatedTouchable
      style={[style, { transform: [{ scale: scaleAnim }] }]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={activeOpacity || 0.6}
      {...a11yProps}
    >
      {children}
    </AnimatedTouchable>
  );
}

// Multi-select chip. Same press/scale feel as PressablePrefRow so the
// screen animates consistently.
function PrefChip({ label, icon, active, onPress, styles, colors }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <AnimatedTouchable
      style={[styles.chip, active && styles.chipActive, { transform: [{ scale }] }]}
      activeOpacity={0.75}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 50, bounciness: 8 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 10 }).start()}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!active }}
      accessibilityLabel={label}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={14}
          color={active ? colors.black : colors.gray500}
          style={{ marginRight: 6 }}
        />
      ) : null}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      {active && (
        <Ionicons name="checkmark" size={14} color={colors.black} style={{ marginLeft: 6 }} />
      )}
    </AnimatedTouchable>
  );
}

export default function PreferencesScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { session } = useAuth();
  const { currentUser, refreshUser } = useCurrentUser();

  const [prefValues, setPrefValues] = useState(() =>
    DISCOVERY_PREFS.reduce((acc, pref) => ({ ...acc, [pref.key]: pref.value }), {})
  );
  const [city, setCity] = useState('');
  const [languages, setLanguages] = useState([]);
  const [openTo, setOpenTo] = useState([]);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [saving, setSaving] = useState(false);

  // Seed the form from the profile exactly once, and only once a real
  // User row has landed — re-seeding on every currentUser identity change
  // would clobber whatever the user is currently typing into the city
  // field. Every field is normalized so a profile from an un-migrated
  // backend (languages/openTo === null, no city, no ethnicity) renders
  // as empty rather than throwing.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !currentUser?.id) return;
    seededRef.current = true;
    setCity(typeof currentUser.city === 'string' ? currentUser.city : '');
    setLanguages(normalizeLanguages(currentUser.languages));
    setOpenTo(normalizeOpenTo(currentUser.openTo));
    setPrefValues((prev) => ({
      ...prev,
      distance: nearestDistanceLabel(Number(currentUser?.preferences?.distance)),
      ethnicity:
        typeof currentUser.ethnicity === 'string' && currentUser.ethnicity.trim()
          ? currentUser.ethnicity
          : OPEN_TO_ALL,
    }));
  }, [currentUser]);

  // Verified-only is local-device state, so it hydrates from storage
  // rather than the profile.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(VERIFIED_ONLY_KEY)
      .then((raw) => {
        if (!cancelled && raw != null) setVerifiedOnly(raw === 'true');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Listen for a returned selection from PreferenceSelectScreen.
  useEffect(() => {
    const updated = route?.params?.updatedPref;
    if (!updated) return;
    setPrefValues((prev) => ({ ...prev, [updated.key]: updated.value }));
    // Clear the param so it doesn't re-fire
    navigation.setParams({ updatedPref: undefined });
  }, [route?.params?.updatedPref, navigation]);

  const toggleInArray = useCallback((setter, value) => {
    try { Haptics.selectionAsync(); } catch {}
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }, []);

  const toggleVerifiedOnly = useCallback(() => {
    try { Haptics.selectionAsync(); } catch {}
    setVerifiedOnly((prev) => {
      const next = !prev;
      AsyncStorage.setItem(VERIFIED_ONLY_KEY, next ? 'true' : 'false').catch(() => {});
      return next;
    });
  }, []);

  // Where to land when the user finishes with the filters. Honors an
  // explicit `returnTo` (the screen/tab that opened the filters) so Done
  // always routes to the correct place — even after drilling into a
  // PreferenceSelect sub-screen, which threads returnTo back to us. Falls
  // back to goBack(), then to the Home tab so we never dead-end.
  const returnTo = route?.params?.returnTo;
  const routeAfterDone = useCallback(() => {
    const tab = RETURN_TAB[returnTo];
    if (tab) {
      navigation.navigate('Main', { screen: tab });
      return;
    }
    if (returnTo) {
      navigation.navigate(returnTo);
      return;
    }
    if (navigation.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Main', { screen: 'HomeTab' });
  }, [navigation, returnTo]);

  const handleDone = async () => {
    // Persist via API. If the network call fails, surface it so the user
    // knows their changes didn't land — and stay on the screen so they can
    // retry without losing the form state.
    if (session) {
      const miles = Number(String(prefValues.distance || DEFAULT_DISTANCE).split(' ')[0]);
      const ethnicity = prefValues.ethnicity;
      const updates = {
        // User.city — free text, same contract as ProfileSetup.
        city: city.trim(),
        languages,
        openTo,
        // '' means "no background filter"; never persist the sentinel.
        ethnicity: isDefaultValue(ethnicity) ? '' : ethnicity,
      };
      if (!Number.isNaN(miles)) updates.maxDistanceKm = Math.round(miles * 1.6);

      setSaving(true);
      try {
        await profileService.updateProfile(updates);
        await refreshUser();
      } catch (err) {
        Alert.alert(
          'Could not save preferences',
          err?.message || 'Check your connection and try again.',
        );
        return;
      } finally {
        setSaving(false);
      }
    }

    routeAfterDone();
  };

  const openPref = (pref) => {
    const options = PREF_OPTIONS[pref.key];
    if (!options) return;
    navigation.navigate('PreferenceSelect', {
      prefKey: pref.key,
      title: pref.label,
      options,
      currentValue: prefValues[pref.key] || pref.value,
      prefType: 'discovery',
      returnTo,
    });
  };

  const activeCount = useMemo(() => {
    let count = DISCOVERY_PREFS.filter(
      (p) => !isDefaultValue(prefValues[p.key] || p.value)
    ).length;
    if (city.trim()) count += 1;
    if (languages.length) count += 1;
    if (openTo.length) count += 1;
    if (verifiedOnly) count += 1;
    return count;
  }, [prefValues, city, languages, openTo, verifiedOnly]);

  const renderPrefRow = (pref, index, total) => {
    const iconBg = isDark ? ICON_CHIP.dark : ICON_CHIP.light;
    const iconColor = isDark ? ICON_CHIP.iconDark : ICON_CHIP.iconLight;
    const val = prefValues[pref.key] || pref.value;
    const isSet = !isDefaultValue(val);

    return (
      <PressablePrefRow
        key={pref.key}
        style={[styles.prefRow, index < total - 1 && styles.prefRowBorder]}
        activeOpacity={0.6}
        onPress={() => openPref(pref)}
        accessibilityRole="button"
        accessibilityLabel={`${pref.label}, ${val}`}
        accessibilityHint="Opens a list of options"
      >
        <View style={styles.prefLeft}>
          <View style={[styles.prefIconWrap, { backgroundColor: iconBg }]}>
            <Ionicons name={pref.icon} size={18} color={iconColor} />
          </View>
          <Text style={styles.prefLabel}>{pref.label}</Text>
        </View>
        <View style={styles.prefRight}>
          <View style={[styles.prefValuePill, isSet && styles.prefValuePillSet]}>
            <Text style={[styles.prefValue, isSet && styles.prefValueSet]} numberOfLines={1}>
              {val}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={isSet ? colors.black : colors.gray400} />
        </View>
      </PressablePrefRow>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleDone}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Save and go back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.black} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Discovery</Text>
        </View>
        <TouchableOpacity
          onPress={handleDone}
          style={styles.doneBtn}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Save preferences"
          accessibilityState={{ disabled: saving }}
        >
          <Text style={styles.doneText} numberOfLines={1}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconWrap}>
            <Ionicons name="compass-outline" size={20} color={colors.black} />
          </View>
          <View style={styles.summaryTextWrap}>
            <Text style={styles.summaryTitle}>Who you see</Text>
            <Text style={styles.summaryMeta}>
              Shapes the Nearby map and the Directory • {activeCount} active
            </Text>
          </View>
        </View>

        {/* ── LOCATION ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Location</Text>
        </View>
        <View style={styles.card}>
          <View style={[styles.prefRow, styles.prefRowBorder]}>
            <View style={styles.prefLeft}>
              <View style={[styles.prefIconWrap, { backgroundColor: isDark ? ICON_CHIP.dark : ICON_CHIP.light }]}>
                <Ionicons name="location-outline" size={18} color={isDark ? ICON_CHIP.iconDark : ICON_CHIP.iconLight} />
              </View>
              <Text style={styles.prefLabel}>My city</Text>
            </View>
            <TextInput
              style={styles.cityInput}
              value={city}
              onChangeText={setCity}
              placeholder="Add your city"
              placeholderTextColor={colors.gray400}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="done"
              maxLength={80}
              accessibilityLabel="My city"
              accessibilityHint="Type the city you want to be discovered in"
            />
          </View>
          {renderPrefRow(DISCOVERY_PREFS[0], 0, 1)}
        </View>
        <Text style={styles.sectionHint}>
          Whether you appear on the map is a separate privacy setting — manage it in Settings.
        </Text>

        {/* ── PEOPLE ── */}
        <View style={[styles.sectionHeaderRow, { marginTop: 28 }]}>
          <Text style={styles.sectionHeader}>People</Text>
        </View>
        <View style={styles.card}>
          {renderPrefRow(DISCOVERY_PREFS[1], 0, 2)}
          <PressablePrefRow
            style={styles.prefRow}
            activeOpacity={0.75}
            onPress={toggleVerifiedOnly}
            accessibilityRole="switch"
            accessibilityLabel="Verified members only"
            accessibilityState={{ checked: verifiedOnly }}
          >
            <View style={styles.prefLeft}>
              <View style={[styles.prefIconWrap, { backgroundColor: isDark ? ICON_CHIP.dark : ICON_CHIP.light }]}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color={isDark ? ICON_CHIP.iconDark : ICON_CHIP.iconLight}
                />
              </View>
              <Text style={styles.prefLabel}>Verified members only</Text>
            </View>
            <View style={styles.prefRight}>
              <Ionicons
                name={verifiedOnly ? 'checkbox' : 'square-outline'}
                size={22}
                color={verifiedOnly ? colors.black : colors.gray400}
              />
            </View>
          </PressablePrefRow>
        </View>

        {/* ── LANGUAGES ── */}
        <View style={[styles.sectionHeaderRow, { marginTop: 28 }]}>
          <Text style={styles.sectionHeader}>Languages</Text>
          <View style={styles.sectionCountPill}>
            <Text style={styles.sectionCountText}>{languages.length}</Text>
          </View>
        </View>
        <View style={styles.chipCard}>
          <Text style={styles.chipCardHint}>Find people who speak what you speak.</Text>
          <View style={styles.chipRow}>
            {LANGUAGE_OPTIONS.map((option) => (
              <PrefChip
                key={option}
                label={option}
                active={languages.includes(option)}
                onPress={() => toggleInArray(setLanguages, option)}
                styles={styles}
                colors={colors}
              />
            ))}
          </View>
        </View>

        {/* ── OPEN TO ── */}
        <View style={[styles.sectionHeaderRow, { marginTop: 28 }]}>
          <Text style={styles.sectionHeader}>Open to</Text>
          <View style={styles.sectionCountPill}>
            <Text style={styles.sectionCountText}>{openTo.length}</Text>
          </View>
        </View>
        <View style={styles.chipCard}>
          <Text style={styles.chipCardHint}>Pick everything that fits — this is how people find their people.</Text>
          <View style={styles.chipRow}>
            {OPEN_TO_OPTIONS.map((option) => (
              <PrefChip
                key={option.key}
                label={option.label}
                icon={option.icon}
                active={openTo.includes(option.key)}
                onPress={() => toggleInArray(setOpenTo, option.key)}
                styles={styles}
                colors={colors}
              />
            ))}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: FontFamily.black,
    color: colors.black,
    textAlign: 'center',
    letterSpacing: -0.8,
  },
  doneText: {
    ...Typography.bodySemibold,
    color: colors.black,
  },
  doneBtn: {
    minWidth: 64,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#ECECF0',
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F7F7F9',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 24,
  },
  summaryIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
    marginRight: 10,
  },
  summaryTextWrap: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 14,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    color: colors.black,
  },
  summaryMeta: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    color: colors.gray600,
  },

  // Section headers
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionHint: {
    marginTop: 10,
    marginLeft: 4,
    fontSize: 12,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    color: colors.gray500,
    lineHeight: 17,
  },
  sectionCountPill: {
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E0E0E4',
    borderRadius: 999,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8F8FA',
    paddingHorizontal: 7,
    paddingVertical: 1,
    minWidth: 22,
    alignItems: 'center',
  },
  sectionCountText: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    color: colors.black,
  },

  // Preference card
  card: {
    backgroundColor: isDark ? colors.surface : colors.gray100,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: isDark ? colors.cardBorder : colors.separator,
    ...getShadow('sm', isDark),
  },

  // Preference rows
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
  },
  prefRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.separator,
  },
  prefLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  prefIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  prefLabel: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.black,
    flexShrink: 1,
  },
  prefRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '45%',
  },
  prefValuePill: {
    borderRadius: 999,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.gray100,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.14)' : colors.gray200,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexShrink: 1,
  },
  prefValuePillSet: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E8E8EC',
    borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#E0E0E4',
  },
  prefValue: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: FontFamily.medium,
    color: colors.gray500,
  },
  prefValueSet: {
    color: colors.black,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  cityInput: {
    ...Typography.body,
    color: colors.black,
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
    paddingVertical: 6,
    minHeight: 44,
  },

  // Multi-select chips
  chipCard: {
    backgroundColor: isDark ? colors.surface : colors.gray100,
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: isDark ? colors.cardBorder : colors.separator,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...getShadow('sm', isDark),
  },
  chipCardHint: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    color: colors.gray500,
    marginBottom: 12,
    lineHeight: 17,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.cardBg,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  chipActive: {
    borderColor: colors.black,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E8E8EC',
  },
  chipText: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    color: colors.gray600,
  },
  chipTextActive: {
    color: colors.black,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
  },
});
