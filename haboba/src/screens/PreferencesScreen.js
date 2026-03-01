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
import Button from '../components/Button';
import { currentUser } from '../data/mockProfiles';
import { useSubscription } from '../payments';
import { useAuth } from '../auth';
import * as profileService from '../api/services/profileService';

// ── Member preferences ──────────────────────────────────────
const MEMBER_PREFS = [
  { key: 'interestedIn', label: "I'm interested in", value: 'Women', icon: 'heart-outline' },
  { key: 'neighborhood', label: 'My neighborhood', value: 'Set your location', icon: 'location-outline' },
  { key: 'distance', label: 'Maximum distance', value: '25 miles', icon: 'navigate-outline' },
  { key: 'ageRange', label: 'Age range', value: '21 – 35', icon: 'calendar-outline' },
  { key: 'ethnicity', label: 'Ethnicity', value: 'Open to all', icon: 'flag-outline' },
  { key: 'religion', label: 'Religion', value: 'Open to all', icon: 'book-outline' },
  { key: 'relationshipType', label: 'Relationship Type', value: 'Monogamy', icon: 'people-outline' },
];

// ── Subscriber preferences ──────────────────────────────────
const SUBSCRIBER_PREFS = [
  { key: 'height', label: 'Height', icon: 'resize-outline' },
  { key: 'datingIntentions', label: 'Dating Intentions', icon: 'search-outline' },
  { key: 'children', label: 'Children', icon: 'happy-outline' },
  { key: 'familyPlans', label: 'Family Plans', icon: 'home-outline' },
  { key: 'drugs', label: 'Drugs', icon: 'medical-outline' },
  { key: 'smoking', label: 'Smoking', icon: 'flame-outline' },
  { key: 'marijuana', label: 'Marijuana', icon: 'leaf-outline' },
  { key: 'drinking', label: 'Drinking', icon: 'wine-outline' },
  { key: 'politics', label: 'Politics', icon: 'business-outline' },
  { key: 'educationLevel', label: 'Education Level', icon: 'school-outline' },
];

// ── Social preferences ──────────────────────────────────────
const SOCIAL_PREFS = [
  { key: 'activityType', label: 'Activity type', value: 'Open to all', icon: 'sparkles-outline' },
  { key: 'hangoutSize', label: 'Group size', value: 'Any size', icon: 'people-outline' },
  { key: 'neighborhood', label: 'My neighborhood', value: 'Set your location', icon: 'location-outline' },
  { key: 'distance', label: 'Maximum distance', value: '25 miles', icon: 'navigate-outline' },
  { key: 'ageRange', label: 'Age range', value: '21 – 35', icon: 'calendar-outline' },
  { key: 'ethnicity', label: 'Ethnicity', value: 'Open to all', icon: 'flag-outline' },
  { key: 'vibe', label: 'Vibe', value: 'Open to all', icon: 'musical-notes-outline' },
];

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

  const { accessToken } = useAuth();

  const handleDone = async () => {
    const prefSource = mode === 'Social' ? socialPrefValues : memberPrefValues;
    const [minAge, maxAge] = (prefSource.ageRange || '21 – 35')
      .split('–')
      .map((n) => Number(String(n).trim()));
    const parsedDistance = Number((prefSource.distance || '25 miles').split(' ')[0]);

    if (!Number.isNaN(minAge) && !Number.isNaN(maxAge)) {
      currentUser.preferences.ageRange = [minAge, maxAge];
    }
    if (!Number.isNaN(parsedDistance)) {
      currentUser.preferences.distance = parsedDistance;
    }
    if (mode === 'Dating') {
      currentUser.preferences.lookingFor = memberPrefValues.interestedIn || currentUser.preferences.lookingFor;
    }

    // Save to API
    if (accessToken) {
      const updates = {};
      if (!Number.isNaN(minAge)) updates.minPreferredAge = minAge;
      if (!Number.isNaN(maxAge)) updates.maxPreferredAge = maxAge;
      if (!Number.isNaN(parsedDistance)) updates.maxDistanceKm = Math.round(parsedDistance * 1.6);
      if (mode === 'Dating' && memberPrefValues.interestedIn) updates.lookingForGender = memberPrefValues.interestedIn;
      profileService.updateProfile(accessToken, updates).catch(() => {});
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
          {isSocial ? 'Social Preferences' : 'Dating Preferences'}
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
          {/* Animated sliding pill */}
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
          {['Dating', 'Social'].map((seg) => (
            <TouchableOpacity
              key={seg}
              style={styles.segmentButton}
              activeOpacity={0.7}
              onPress={() => handleModeToggle(seg)}
            >
              <Animated.Text
                style={[
                  styles.segmentText,
                  {
                    color: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: seg === 'Dating'
                        ? ['#FFFFFF', colors.gray600]
                        : [colors.gray600, '#FFFFFF'],
                    }),
                  },
                ]}
              >
                {seg}
              </Animated.Text>
            </TouchableOpacity>
          ))}
        </View>

        {isSocial ? (
          <>
            {/* ── SOCIAL PREFERENCES ── */}
            <Text style={styles.sectionHeader}>Social Preferences</Text>
            <View style={styles.card}>
              {SOCIAL_PREFS.map((pref, index) => (
                <TouchableOpacity
                  key={pref.key}
                  style={[
                    styles.prefRow,
                    index < SOCIAL_PREFS.length - 1 && styles.prefRowBorder,
                  ]}
                  activeOpacity={0.6}
                  onPress={() => openSocialPref(pref)}
                >
                  <View style={styles.prefLeft}>
                    <View style={styles.prefIconWrap}>
                      <Ionicons name={pref.icon} size={18} color={colors.gray500} />
                    </View>
                    <Text style={styles.prefLabel}>{pref.label}</Text>
                  </View>
                  <View style={styles.prefRight}>
                    <Text style={styles.prefValue}>{socialPrefValues[pref.key] || pref.value}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <>
            {/* ── MEMBER PREFERENCES ── */}
            <Text style={styles.sectionHeader}>Member Preferences</Text>
            <View style={styles.card}>
              {MEMBER_PREFS.map((pref, index) => (
                <TouchableOpacity
                  key={pref.key}
                  style={[
                    styles.prefRow,
                    index < MEMBER_PREFS.length - 1 && styles.prefRowBorder,
                  ]}
                  activeOpacity={0.6}
                  onPress={() => openMemberPref(pref)}
                >
                  <View style={styles.prefLeft}>
                    <View style={styles.prefIconWrap}>
                      <Ionicons name={pref.icon} size={18} color={colors.gray500} />
                    </View>
                    <Text style={styles.prefLabel}>{pref.label}</Text>
                  </View>
                  <View style={styles.prefRight}>
                    <Text style={styles.prefValue}>{memberPrefValues[pref.key] || pref.value}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* ── SUBSCRIBER PREFERENCES ── */}
            <View style={styles.subscriberHeaderRow}>
              <Text style={styles.sectionHeader}>Subscriber Preferences</Text>
              {!isSubscriber && (
                <View style={styles.lockBadge}>
                  <Ionicons name="lock-closed" size={12} color="#FFFFFF" />
                </View>
              )}
            </View>

            {!isSubscriber && (
              <View style={styles.unlockBanner}>
                <Text style={styles.unlockText}>
                  Complete your profile to unlock advanced filters
                </Text>
                <Button
                  title="Upgrade"
                  variant="primary"
                  size="sm"
                  fullWidth={false}
                  onPress={() => navigation?.navigate?.('Elite')}
                  style={{ marginTop: 10, paddingHorizontal: 40, alignSelf: 'center' }}
                />
              </View>
            )}

            <View style={styles.card}>
              {SUBSCRIBER_PREFS.map((pref, index) => (
                <TouchableOpacity
                  key={pref.key}
                  style={[
                    styles.prefRow,
                    index < SUBSCRIBER_PREFS.length - 1 && styles.prefRowBorder,
                    !isSubscriber && styles.prefRowLocked,
                  ]}
                  activeOpacity={isSubscriber ? 0.6 : 1}
                  onPress={() => openSubscriberPref(pref)}
                >
                  <View style={styles.prefLeft}>
                    <View style={[styles.prefIconWrap, !isSubscriber && styles.prefIconLocked]}>
                      <Ionicons
                        name={pref.icon}
                        size={18}
                        color={isSubscriber ? colors.gray500 : colors.gray400}
                      />
                    </View>
                    <Text style={[styles.prefLabel, !isSubscriber && styles.prefLabelLocked]}>
                      {pref.label}
                    </Text>
                  </View>
                  <View style={styles.prefRight}>
                    {!isSubscriber ? (
                      <Ionicons name="lock-closed" size={14} color={colors.gray400} />
                    ) : (
                      <>
                        <Text style={styles.prefValue}>{subscriberPrefValues[pref.key]}</Text>
                        <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.separator,
  },
  headerTitle: {
    ...Typography.screenTitle,
    color: colors.black,
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
    backgroundColor: colors.gray100,
    borderRadius: 14,
    padding: 3,
    marginBottom: 24,
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
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.gray500,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  subscriberHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 10,
    marginLeft: 4,
  },
  lockBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Unlock banner
  unlockBanner: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.25)',
    borderStyle: 'dashed',
    ...getShadow('sm', isDark),
  },
  unlockText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: FontFamily.medium,
    color: colors.gray600,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Preference card
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    overflow: 'hidden',
    ...getShadow('sm', isDark),
  },

  // Preference rows
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  prefRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.separator,
  },
  prefRowLocked: {
    opacity: 0.55,
  },
  prefLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  prefIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  prefIconLocked: {
    backgroundColor: colors.gray200,
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
  },
  prefValue: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: FontFamily.medium,
    color: colors.gray500,
  },
});
