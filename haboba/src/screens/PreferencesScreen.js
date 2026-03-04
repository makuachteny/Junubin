// AnaJunubin — Dating Preferences
// BLK-style layout: Member Preferences + Subscriber Preferences (locked)
// Each row navigates to a selection screen

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme, Typography, FontFamily, getShadow } from '../theme';
import { GraffitiSparkles } from '../components/icons';
import Button from '../components/Button';
import { useSubscription } from '../payments';
import { useAuth } from '../auth';
import { useCurrentUser } from '../hooks';
import * as profileService from '../api/services/profileService';
import { interactiveStore } from '../utils/interactiveStore';

// ── Member preferences ──────────────────────────────────────
const MEMBER_PREFS = [
  { key: 'interestedIn', label: "I'm interested in", value: 'Women', icon: 'heart-outline', tint: 'accent' },
  { key: 'neighborhood', label: 'My neighborhood', value: 'Set your location', icon: 'location-outline', tint: 'warm' },
  { key: 'distance', label: 'Maximum distance', value: '25 miles', icon: 'navigate-outline', tint: 'warm' },
  { key: 'ageRange', label: 'Age range', value: '21 – 35', icon: 'calendar-outline', tint: 'neutral' },
  { key: 'ethnicity', label: 'Ethnicity', value: 'Open to all', icon: 'flag-outline', tint: 'gold' },
  { key: 'religion', label: 'Religion', value: 'Open to all', icon: 'book-outline', tint: 'gold' },
  { key: 'relationshipType', label: 'Relationship Type', value: 'Monogamy', icon: 'people-outline', tint: 'accent' },
];

// ── Subscriber preferences ──────────────────────────────────
const SUBSCRIBER_PREFS = [
  { key: 'height', label: 'Height', icon: 'resize-outline', tint: 'neutral' },
  { key: 'datingIntentions', label: 'Dating Intentions', icon: 'search-outline', tint: 'accent' },
  { key: 'children', label: 'Children', icon: 'happy-outline', tint: 'warm' },
  { key: 'familyPlans', label: 'Family Plans', icon: 'home-outline', tint: 'warm' },
  { key: 'drugs', label: 'Drugs', icon: 'medical-outline', tint: 'neutral' },
  { key: 'smoking', label: 'Smoking', icon: 'flame-outline', tint: 'neutral' },
  { key: 'marijuana', label: 'Marijuana', icon: 'leaf-outline', tint: 'neutral' },
  { key: 'drinking', label: 'Drinking', icon: 'wine-outline', tint: 'neutral' },
  { key: 'politics', label: 'Politics', icon: 'business-outline', tint: 'neutral' },
  { key: 'educationLevel', label: 'Education Level', icon: 'school-outline', tint: 'gold' },
];

// ── Social preferences ──────────────────────────────────────
const SOCIAL_PREFS = [
  { key: 'activityType', label: 'Activity type', value: 'Open to all', icon: 'sparkles-outline', tint: 'accent' },
  { key: 'hangoutSize', label: 'Group size', value: 'Any size', icon: 'people-outline', tint: 'warm' },
  { key: 'neighborhood', label: 'My neighborhood', value: 'Set your location', icon: 'location-outline', tint: 'warm' },
  { key: 'distance', label: 'Maximum distance', value: '25 miles', icon: 'navigate-outline', tint: 'warm' },
  { key: 'ageRange', label: 'Age range', value: '21 – 35', icon: 'calendar-outline', tint: 'neutral' },
  { key: 'ethnicity', label: 'Ethnicity', value: 'Open to all', icon: 'flag-outline', tint: 'gold' },
  { key: 'vibe', label: 'Vibe', value: 'Open to all', icon: 'musical-notes-outline', tint: 'accent' },
];

// Icon tint colors based on category
const ICON_TINTS = {
  accent: { light: 'rgba(245, 96, 64, 0.10)', dark: 'rgba(245, 96, 64, 0.14)', iconLight: '#F56040', iconDark: '#F56040' },
  warm: { light: 'rgba(245, 96, 64, 0.10)', dark: 'rgba(245, 96, 64, 0.14)', iconLight: '#F56040', iconDark: '#F56040' },
  gold: { light: 'rgba(249, 168, 37, 0.10)', dark: 'rgba(255, 213, 79, 0.14)', iconLight: '#F9A825', iconDark: '#FFD54F' },
  neutral: { light: 'rgba(115, 115, 115, 0.08)', dark: 'rgba(142, 142, 142, 0.12)', iconLight: '#737373', iconDark: '#8E8E8E' },
};

// Check if a value is a "default" / unset value
const isDefaultValue = (val) => !val || val === 'Open to all' || val === 'Set your location' || val === 'Any size';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function PressablePrefRow({ style, onPress, activeOpacity, children }) {
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
    >
      {children}
    </AnimatedTouchable>
  );
}

// ── Options for each preference ─────────────────────────────
const PREF_OPTIONS = {
  interestedIn: [
    { label: 'Women', value: 'Women', icon: 'woman-outline' },
    { label: 'Men', value: 'Men', icon: 'man-outline' },
    { label: 'Everyone', value: 'Everyone', icon: 'people-outline' },
  ],
  neighborhood: [
    { label: 'Set your location', value: 'Set your location', icon: 'location-outline', description: 'Manually set your neighborhood' },
    { label: 'Near me', value: 'Near me', icon: 'navigate-outline', description: 'Use your current location' },
    { label: 'Within my city', value: 'Within my city', icon: 'business-outline', description: 'Match with anyone in your city' },
  ],
  distance: [
    { label: '5 miles', value: '5 miles', description: 'Very close by' },
    { label: '10 miles', value: '10 miles', description: 'Nearby' },
    { label: '25 miles', value: '25 miles', description: 'Within your area' },
    { label: '50 miles', value: '50 miles', description: 'Extended range' },
    { label: '100 miles', value: '100 miles', description: 'Wide search' },
  ],
  ageRange: [
    { label: '18 – 24', value: '18 – 24' },
    { label: '21 – 30', value: '21 – 30' },
    { label: '21 – 35', value: '21 – 35' },
    { label: '23 – 32', value: '23 – 32' },
    { label: '25 – 35', value: '25 – 35' },
    { label: '25 – 40', value: '25 – 40' },
    { label: '30 – 45', value: '30 – 45' },
    { label: '35 – 50', value: '35 – 50' },
  ],
  ethnicity: [
    { label: 'Open to all', value: 'Open to all', icon: 'globe-outline' },
    { label: 'Dinka', value: 'Dinka', icon: 'flag-outline' },
    { label: 'Nuer', value: 'Nuer', icon: 'flag-outline' },
    { label: 'Shilluk', value: 'Shilluk', icon: 'flag-outline' },
    { label: 'Bari', value: 'Bari', icon: 'flag-outline' },
    { label: 'Azande', value: 'Azande', icon: 'flag-outline' },
    { label: 'Murle', value: 'Murle', icon: 'flag-outline' },
    { label: 'Acholi', value: 'Acholi', icon: 'flag-outline' },
  ],
  religion: [
    { label: 'Open to all', value: 'Open to all', icon: 'globe-outline' },
    { label: 'Christian', value: 'Christian', icon: 'book-outline' },
    { label: 'Muslim', value: 'Muslim', icon: 'moon-outline' },
    { label: 'Traditional', value: 'Traditional', icon: 'leaf-outline' },
  ],
  relationshipType: [
    { label: 'Monogamy', value: 'Monogamy', icon: 'heart-outline', description: 'One committed partner' },
    { label: 'Long-term', value: 'Long-term', icon: 'time-outline', description: 'Looking for something lasting' },
    { label: 'Short-term', value: 'Short-term', icon: 'flash-outline', description: 'Keeping it casual for now' },
    { label: 'Still figuring out', value: 'Still figuring out', icon: 'help-circle-outline', description: 'Open to seeing what happens' },
  ],
  height: [
    { label: "Under 5'0\"", value: "Under 5'0\"" },
    { label: "5'0\" – 5'4\"", value: "5'0\" – 5'4\"" },
    { label: "5'5\" – 5'7\"", value: "5'5\" – 5'7\"" },
    { label: "5'8\" – 5'10\"", value: "5'8\" – 5'10\"" },
    { label: "5'11\" – 6'1\"", value: "5'11\" – 6'1\"" },
    { label: "6'2\"+", value: "6'2\"+" },
    { label: 'Open to all', value: 'Open to all' },
  ],
  datingIntentions: [
    { label: 'Serious relationship', value: 'Serious relationship', icon: 'heart-outline' },
    { label: 'Marriage', value: 'Marriage', icon: 'diamond-outline' },
    { label: 'Casual dating', value: 'Casual dating', icon: 'cafe-outline' },
    { label: 'Still figuring out', value: 'Still figuring out', icon: 'help-circle-outline' },
    { label: 'Open to all', value: 'Open to all', icon: 'globe-outline' },
  ],
  children: [
    { label: 'Want children', value: 'Want children', icon: 'happy-outline' },
    { label: 'Don\'t want children', value: 'Don\'t want children', icon: 'close-circle-outline' },
    { label: 'Have children', value: 'Have children', icon: 'people-outline' },
    { label: 'Open to all', value: 'Open to all', icon: 'globe-outline' },
  ],
  familyPlans: [
    { label: 'Want to start a family', value: 'Want to start a family' },
    { label: 'Not sure yet', value: 'Not sure yet' },
    { label: 'Don\'t want a family', value: 'Don\'t want a family' },
    { label: 'Open to all', value: 'Open to all' },
  ],
  drugs: [
    { label: 'Never', value: 'Never' },
    { label: 'Sometimes', value: 'Sometimes' },
    { label: 'Prefer not to say', value: 'Prefer not to say' },
    { label: 'Open to all', value: 'Open to all' },
  ],
  smoking: [
    { label: 'Never', value: 'Never' },
    { label: 'Socially', value: 'Socially' },
    { label: 'Regularly', value: 'Regularly' },
    { label: 'Open to all', value: 'Open to all' },
  ],
  marijuana: [
    { label: 'Never', value: 'Never' },
    { label: 'Sometimes', value: 'Sometimes' },
    { label: 'Regularly', value: 'Regularly' },
    { label: 'Open to all', value: 'Open to all' },
  ],
  drinking: [
    { label: 'Never', value: 'Never' },
    { label: 'Socially', value: 'Socially' },
    { label: 'Regularly', value: 'Regularly' },
    { label: 'Open to all', value: 'Open to all' },
  ],
  politics: [
    { label: 'Liberal', value: 'Liberal' },
    { label: 'Moderate', value: 'Moderate' },
    { label: 'Conservative', value: 'Conservative' },
    { label: 'Not political', value: 'Not political' },
    { label: 'Open to all', value: 'Open to all' },
  ],
  educationLevel: [
    { label: 'High school', value: 'High school' },
    { label: 'Some college', value: 'Some college' },
    { label: 'Bachelor\'s degree', value: 'Bachelor\'s degree' },
    { label: 'Master\'s degree', value: 'Master\'s degree' },
    { label: 'Doctorate', value: 'Doctorate' },
    { label: 'Open to all', value: 'Open to all' },
  ],
  activityType: [
    { label: 'Open to all', value: 'Open to all', icon: 'globe-outline' },
    { label: 'Coffee & conversation', value: 'Coffee & conversation', icon: 'cafe-outline' },
    { label: 'Sports & fitness', value: 'Sports & fitness', icon: 'fitness-outline' },
    { label: 'Cultural events', value: 'Cultural events', icon: 'color-palette-outline' },
    { label: 'Food & dining', value: 'Food & dining', icon: 'restaurant-outline' },
    { label: 'Outdoors & nature', value: 'Outdoors & nature', icon: 'leaf-outline' },
  ],
  hangoutSize: [
    { label: 'Any size', value: 'Any size', icon: 'globe-outline' },
    { label: 'One-on-one', value: 'One-on-one', icon: 'person-outline' },
    { label: 'Small group (3-5)', value: 'Small group (3-5)', icon: 'people-outline' },
    { label: 'Larger group', value: 'Larger group', icon: 'people-circle-outline' },
  ],
  vibe: [
    { label: 'Open to all', value: 'Open to all', icon: 'globe-outline' },
    { label: 'Chill & lowkey', value: 'Chill & lowkey', icon: 'cafe-outline' },
    { label: 'Adventurous', value: 'Adventurous', icon: 'compass-outline' },
    { label: 'Intellectual', value: 'Intellectual', icon: 'book-outline' },
    { label: 'Party & nightlife', value: 'Party & nightlife', icon: 'musical-notes-outline' },
  ],
};

export default function PreferencesScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [mode, setMode] = useState('Dating');
  const slideAnim = useRef(new Animated.Value(0)).current; // 0 = Dating, 1 = Social
  const [segmentWidth, setSegmentWidth] = useState(0);
  const [memberPrefValues, setMemberPrefValues] = useState(() =>
    MEMBER_PREFS.reduce((acc, pref) => ({ ...acc, [pref.key]: pref.value }), {})
  );
  const [subscriberPrefValues, setSubscriberPrefValues] = useState(() =>
    SUBSCRIBER_PREFS.reduce((acc, pref) => ({ ...acc, [pref.key]: 'Open to all' }), {})
  );
  const [socialPrefValues, setSocialPrefValues] = useState(() =>
    SOCIAL_PREFS.reduce((acc, pref) => ({ ...acc, [pref.key]: pref.value }), {})
  );
  const [friendLayerEnabled, setFriendLayerEnabled] = useState(true);
  const [seasonMode, setSeasonMode] = useState('Festival');
  const [questAnswers] = useState({
    weekend: 'Adventure',
    chat: 'Playful',
  });
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { hasTier } = useSubscription();
  const isSubscriber = hasTier('plus');

  // Read persisted mode on mount
  useEffect(() => {
    AsyncStorage.getItem('@haboba_mode').then((stored) => {
      if (stored === 'Social' || stored === 'Dating') {
        setMode(stored);
        slideAnim.setValue(stored === 'Social' ? 1 : 0);
      }
    });
    interactiveStore.getFriendLayer().then((enabled) => setFriendLayerEnabled(!!enabled));
    interactiveStore.getSeasonMode().then((saved) => {
      if (saved) setSeasonMode(saved);
    });
  }, [slideAnim]);

  const handleModeToggle = useCallback((newMode) => {
    const toValue = newMode === 'Social' ? 1 : 0;
    Animated.spring(slideAnim, {
      toValue,
      useNativeDriver: false,
      tension: 68,
      friction: 12,
    }).start();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMode(newMode);
    AsyncStorage.setItem('@haboba_mode', newMode);
  }, [slideAnim]);

  // Listen for returned selection from PreferenceSelectScreen
  useEffect(() => {
    const updated = route.params?.updatedPref;
    if (!updated) return;

    if (updated.type === 'subscriber') {
      setSubscriberPrefValues((prev) => ({ ...prev, [updated.key]: updated.value }));
    } else if (updated.type === 'social') {
      setSocialPrefValues((prev) => ({ ...prev, [updated.key]: updated.value }));
    } else {
      setMemberPrefValues((prev) => ({ ...prev, [updated.key]: updated.value }));
    }

    // Clear the param so it doesn't re-fire
    navigation.setParams({ updatedPref: undefined });
  }, [route.params?.updatedPref, navigation]);

  const { session } = useAuth();
  const { refreshUser } = useCurrentUser();

  const handleSeasonMode = useCallback((nextMode) => {
    setSeasonMode(nextMode);
    interactiveStore.setSeasonMode(nextMode);
  }, []);

  const toggleFriendLayer = useCallback(() => {
    if (!isSubscriber) {
      navigation?.navigate?.('Elite');
      return;
    }
    setFriendLayerEnabled((prev) => {
      const next = !prev;
      interactiveStore.setFriendLayer(next);
      return next;
    });
  }, [isSubscriber, navigation]);

  const handleDone = async () => {
    const prefSource = mode === 'Social' ? socialPrefValues : memberPrefValues;
    const [minAge, maxAge] = (prefSource.ageRange || '21 – 35')
      .split('–')
      .map((n) => Number(String(n).trim()));
    const parsedDistance = Number((prefSource.distance || '25 miles').split(' ')[0]);

    // Persist via API — no more direct mutation
    if (session) {
      const updates = {};
      if (!Number.isNaN(minAge)) updates.minPreferredAge = minAge;
      if (!Number.isNaN(maxAge)) updates.maxPreferredAge = maxAge;
      if (!Number.isNaN(parsedDistance)) updates.maxDistanceKm = Math.round(parsedDistance * 1.6);
      if (mode === 'Dating' && memberPrefValues.interestedIn) updates.lookingForGender = memberPrefValues.interestedIn;
      try {
        await profileService.updateProfile(updates);
        await refreshUser();
      } catch {
        // Silently fail — preferences will sync next time
      }
    }

    navigation.goBack();
  };

  const openMemberPref = (pref) => {
    const options = PREF_OPTIONS[pref.key];
    if (!options) return;
    navigation.navigate('PreferenceSelect', {
      prefKey: pref.key,
      title: pref.label,
      options,
      currentValue: memberPrefValues[pref.key] || pref.value,
      prefType: 'member',
    });
  };

  const openSubscriberPref = (pref) => {
    if (!isSubscriber) {
      navigation?.navigate?.('Elite');
      return;
    }
    const options = PREF_OPTIONS[pref.key];
    if (!options) return;
    navigation.navigate('PreferenceSelect', {
      prefKey: pref.key,
      title: pref.label,
      options,
      currentValue: subscriberPrefValues[pref.key] || 'Open to all',
      prefType: 'subscriber',
    });
  };

  const openSocialPref = (pref) => {
    const options = PREF_OPTIONS[pref.key];
    if (!options) return;
    navigation.navigate('PreferenceSelect', {
      prefKey: pref.key,
      title: pref.label,
      options,
      currentValue: socialPrefValues[pref.key] || pref.value,
      prefType: 'social',
    });
  };

  const isSocial = mode === 'Social';

  const renderPrefRow = (pref, index, total, value, onPress, locked = false) => {
    const tint = ICON_TINTS[pref.tint || 'neutral'];
    const iconBg = isDark ? tint.dark : tint.light;
    const iconColor = locked ? colors.gray400 : (isDark ? tint.iconDark : tint.iconLight);
    const val = value || 'Open to all';
    const isSet = !isDefaultValue(val);

    return (
      <PressablePrefRow
        key={pref.key}
        style={[styles.prefRow, index < total - 1 && styles.prefRowBorder, locked && styles.prefRowLocked]}
        activeOpacity={locked ? 1 : 0.6}
        onPress={onPress}
      >
        <View style={styles.prefLeft}>
          <View style={[styles.prefIconWrap, { backgroundColor: locked ? colors.gray200 : iconBg }]}>
            <Ionicons name={pref.icon} size={18} color={iconColor} />
          </View>
          <Text style={[styles.prefLabel, locked && styles.prefLabelLocked]}>{pref.label}</Text>
        </View>
        <View style={styles.prefRight}>
          {locked ? (
            <Ionicons name="lock-closed" size={14} color={colors.gray400} />
          ) : (
            <>
              <Text style={[styles.prefValue, isSet && styles.prefValueSet]}>{val}</Text>
              <Ionicons name="chevron-forward" size={16} color={isSet ? colors.accent : colors.gray400} />
            </>
          )}
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
        >
          <Ionicons name="chevron-back" size={24} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isSocial ? 'Socializing' : 'Dating'}
        </Text>
        <TouchableOpacity onPress={handleDone}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── MODE SEGMENTED CONTROL ── */}
        <View
          style={styles.segmentedContainer}
          onLayout={(e) => setSegmentWidth(e.nativeEvent.layout.width - 6)}
        >
          {segmentWidth > 0 && (
            <Animated.View
              style={[
                styles.segmentPill,
                {
                  width: segmentWidth / 2,
                  transform: [{
                    translateX: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, segmentWidth / 2],
                    }),
                  }],
                },
              ]}
            />
          )}
          {[{ label: 'Date', value: 'Dating' }, { label: 'Socialize', value: 'Social' }].map((seg) => (
            <TouchableOpacity
              key={seg.value}
              style={styles.segmentButton}
              activeOpacity={0.7}
              onPress={() => handleModeToggle(seg.value)}
            >
              <Animated.Text
                style={[
                  styles.segmentText,
                  {
                    color: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: seg.value === 'Dating'
                        ? ['#FFFFFF', colors.gray600]
                        : [colors.gray600, '#FFFFFF'],
                    }),
                  },
                ]}
              >
                {seg.label}
              </Animated.Text>
            </TouchableOpacity>
          ))}
        </View>

        {isSocial ? (
          <>
            {/* ── SOCIAL PREFERENCES ── */}
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionDot, { backgroundColor: colors.accent }]} />
              <Text style={styles.sectionHeader}>Socializing Preferences</Text>
            </View>
            <View style={styles.card}>
              {SOCIAL_PREFS.map((pref, index) =>
                renderPrefRow(pref, index, SOCIAL_PREFS.length, socialPrefValues[pref.key] || pref.value, () => openSocialPref(pref))
              )}
            </View>
          </>
        ) : (
          <>
            {/* ── MEMBER PREFERENCES ── */}
            <View style={styles.sectionHeaderRow}>
              <View style={[styles.sectionDot, { backgroundColor: colors.accent }]} />
              <Text style={styles.sectionHeader}>Member Preferences</Text>
            </View>
            <View style={styles.card}>
              {MEMBER_PREFS.map((pref, index) =>
                renderPrefRow(pref, index, MEMBER_PREFS.length, memberPrefValues[pref.key] || pref.value, () => openMemberPref(pref))
              )}
            </View>

            {/* ── SUBSCRIBER PREFERENCES ── */}
            <View style={[styles.sectionHeaderRow, { marginTop: 28 }]}>
              <View style={[styles.sectionDot, { backgroundColor: colors.gold }]} />
              <Text style={styles.sectionHeader}>Subscriber Preferences</Text>
              {!isSubscriber && (
                <View style={styles.lockBadge}>
                  <Ionicons name="lock-closed" size={10} color="#FFFFFF" />
                </View>
              )}
            </View>

            {!isSubscriber && (
              <View style={styles.unlockBanner}>
                <View style={styles.unlockIconRow}>
                  <GraffitiSparkles size={20} color={colors.gold} filled />
                </View>
                <Text style={styles.unlockTitle}>Unlock Advanced Filters</Text>
                <Text style={styles.unlockText}>
                  Fine-tune who you see with height, lifestyle, and more
                </Text>
                <Button
                  title="Upgrade to Plus"
                  variant="primary"
                  size="sm"
                  fullWidth={false}
                  onPress={() => navigation?.navigate?.('Elite')}
                  style={{ marginTop: 14, paddingHorizontal: 36, alignSelf: 'center' }}
                />
              </View>
            )}

            <View style={styles.card}>
              {SUBSCRIBER_PREFS.map((pref, index) =>
                renderPrefRow(
                  pref, index, SUBSCRIBER_PREFS.length,
                  subscriberPrefValues[pref.key],
                  () => openSubscriberPref(pref),
                  !isSubscriber
                )
              )}
            </View>
          </>
        )}

        <View style={[styles.sectionHeaderRow, { marginTop: 28 }]}>
          <View style={[styles.sectionDot, { backgroundColor: colors.accent }]} />
          <Text style={styles.sectionHeader}>Interactive Experience</Text>
        </View>
        <View style={styles.card}>
          <PressablePrefRow
            style={[styles.prefRow, styles.prefRowBorder]}
            onPress={toggleFriendLayer}
            activeOpacity={0.75}
          >
            <View style={styles.prefLeft}>
              <View style={[styles.prefIconWrap, { backgroundColor: colors.accentTint08 }]}>
                <Ionicons name="people-circle-outline" size={18} color={colors.accent} />
              </View>
              <Text style={styles.prefLabel}>Friend-of-friend layer</Text>
            </View>
            <View style={styles.prefRight}>
              <Text style={[styles.prefValue, friendLayerEnabled && styles.prefValueSet]}>
                {friendLayerEnabled ? 'Enabled' : 'Disabled'}
              </Text>
            </View>
          </PressablePrefRow>

          <View style={[styles.prefRow, styles.prefRowBorder]}>
            <View style={styles.prefLeft}>
              <View style={[styles.prefIconWrap, { backgroundColor: colors.accentTint08 }]}>
                <Ionicons name="sparkles-outline" size={18} color={colors.accent} />
              </View>
              <Text style={styles.prefLabel}>Seasonal mode</Text>
            </View>
            <View style={styles.seasonChips}>
              {['Festival', 'Travel', 'Summer'].map((modeLabel) => (
                <TouchableOpacity
                  key={modeLabel}
                  style={[styles.seasonChip, seasonMode === modeLabel && styles.seasonChipActive]}
                  onPress={() => handleSeasonMode(modeLabel)}
                >
                  <Text style={[styles.seasonChipText, seasonMode === modeLabel && styles.seasonChipTextActive]}>
                    {modeLabel}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.prefRow}>
            <View style={styles.prefLeft}>
              <View style={[styles.prefIconWrap, { backgroundColor: colors.accentTint08 }]}>
                <Ionicons name="planet-outline" size={18} color={colors.accent} />
              </View>
              <Text style={styles.prefLabel}>Personality quest</Text>
            </View>
            <View style={styles.questMeta}>
              <Text style={styles.prefValue}>Weekend: {questAnswers.weekend}</Text>
              <Text style={styles.prefValue}>Chat: {questAnswers.chat}</Text>
            </View>
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
    backgroundColor: isDark ? colors.cream : colors.creamDark,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: isDark ? colors.cream : colors.creamDark,
  },
  headerTitle: {
    fontSize: 34,
    fontFamily: FontFamily.script,
    color: colors.black,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  doneText: {
    ...Typography.bodySemibold,
    color: colors.accent,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },

  // Segmented control
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: isDark ? colors.gray200 : colors.gray100,
    borderRadius: 14,
    padding: 3,
    marginBottom: 28,
    position: 'relative',
  },
  segmentPill: {
    position: 'absolute',
    top: 3,
    left: 3,
    bottom: 3,
    borderRadius: 12,
    backgroundColor: colors.accent,
    ...getShadow('sm', isDark),
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  segmentText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },

  // Section headers
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginLeft: 4,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  lockBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },

  // Unlock banner
  unlockBanner: {
    backgroundColor: isDark ? 'rgba(255, 213, 79, 0.06)' : 'rgba(249, 168, 37, 0.05)',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 213, 79, 0.15)' : 'rgba(249, 168, 37, 0.2)',
  },
  unlockIconRow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(255, 213, 79, 0.12)' : 'rgba(249, 168, 37, 0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  unlockTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.black,
    marginBottom: 4,
  },
  unlockText: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: FontFamily.medium,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 19,
  },

  // Preference card
  card: {
    backgroundColor: isDark ? colors.surface : colors.creamDark,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: isDark ? 0.5 : 0,
    borderColor: isDark ? colors.cardBorder : 'transparent',
    ...getShadow('sm', isDark),
  },

  // Preference rows
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  prefRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.separator,
  },
  prefRowLocked: {
    opacity: 0.45,
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
  },
  prefLabelLocked: {
    color: colors.gray500,
  },
  prefRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '45%',
  },
  prefValue: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: FontFamily.medium,
    color: colors.gray500,
  },
  prefValueSet: {
    color: colors.accent,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  seasonChips: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 6,
    maxWidth: '56%',
  },
  seasonChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  seasonChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentTint08,
  },
  seasonChipText: {
    ...Typography.caption,
    color: colors.gray600,
    fontSize: 9,
  },
  seasonChipTextActive: {
    color: colors.accent,
  },
  questMeta: {
    alignItems: 'flex-end',
    maxWidth: '56%',
  },
});
