import React, { useState, useMemo, useReducer, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  LayoutAnimation,
  UIManager,
  Pressable,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useTheme, Typography, FontFamily, getShadow } from '../theme';
import { CULTURAL_STICKERS } from '../data/culturalStickers';
import { imageSource } from '../utils/imageSource';
import { promptToOpenSettings } from '../utils/permissionAlert';
import { GraffitiStickerIcon } from '../components/icons';
import { useAuth } from '../auth';
import { useCurrentUser } from '../hooks';
import * as profileService from '../api/services/profileService';
import CurrentlyIntoSelector from '../components/CurrentlyIntoSelector';
import DateWheelPicker, { parseToDate } from '../components/DateWheelPicker';
import SearchablePicker from '../components/SearchablePicker';
import { ALL_TRIBE_KEYS, TRIBES } from '../data/tribes';
import { GENDER_OPTIONS, toDbGender, toUiGender } from '../data/gender';
import {
  PRONOUN_OPTIONS,
  EDUCATION_OPTIONS,
  INTEREST_OPTIONS,
  PROMPT_OPTIONS,
  HERE_FOR_OPTIONS,
  LOCATION_VISIBILITY_OPTIONS,
  normalizeLocationVisibility,
} from '../data/profileOptions';
import { OPEN_TO_OPTIONS, normalizeOpenTo } from '../data/openTo';
import { LANGUAGE_OPTIONS, normalizeLanguages } from '../data/languages';
import { COUNTRY_PICKER_OPTIONS, COUNTRY_BY_CODE } from '../data/worldCountries';
import { LinearGradient } from 'expo-linear-gradient';
import { calculateCompleteness } from '../utils/profileCompleteness';
import { nextIncompleteStep } from '../utils/eligibility';

// Enable LayoutAnimation on Android — iOS has it on by default.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ETHNICITY_OPTIONS = ALL_TRIBE_KEYS;
const ETHNICITY_PICKER_OPTIONS = TRIBES.map((t) => ({
  label: t.key,
  value: t.key,
  description: t.region || t.note || undefined,
}));
// PRONOUN_OPTIONS, EDUCATION_OPTIONS, INTEREST_OPTIONS, PROMPT_OPTIONS,
// HERE_FOR_OPTIONS and LOCATION_VISIBILITY_OPTIONS come from
// src/data/profileOptions.js; OPEN_TO_OPTIONS and LANGUAGE_OPTIONS from
// their own files. All shared with ProfileSetupScreen so the two
// screens can't drift.
//
// The old local PURPOSE_OPTIONS (Dating / Socialize / Both) is gone
// along with the dating editors — sexuality, "interested in", dating
// intentions and children. accountPurpose is still persisted, but it's
// a constant ('socialize') written by onboarding, not a user choice, so
// there's nothing left for this screen to edit.
// Height picker options — 140cm to 220cm in 1cm steps, displayed with
// both metric and imperial so users can find their height either way.
const HEIGHT_PICKER_OPTIONS = (() => {
  const out = [];
  for (let cm = 140; cm <= 220; cm++) {
    const totalIn = Math.round(cm / 2.54);
    const ft = Math.floor(totalIn / 12);
    const inch = totalIn % 12;
    out.push({
      label: `${ft}'${inch}"`,
      value: cm,
      description: `${cm} cm`,
    });
  }
  return out;
})();

// PROMPT_OPTIONS now imported from src/data/profileOptions.js (shared).

const formReducer = (state, action) => {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.key]: action.value };
    default:
      return state;
  }
};

// Eligibility / deep-link step id → the field this screen scrolls to.
// The bottom block maps ids that no longer have an editor (the removed
// dating fields) onto the nearest surviving section so a stale
// focusStep scrolls somewhere sensible instead of crashing or silently
// doing nothing.
const FOCUS_STEP_ALIAS = {
  displayName:      'name',
  prompts:          'promptAnswer',
  dob:              'dob',
  gender:           'gender',
  city:             'city',
  languages:        'languages',
  profession:       'job',
  openTo:           'openTo',
  locationVisibility: 'locationVisibility',
  height:           null,
  verify:           null,
  // ── legacy / removed ids ──
  purpose:          'openTo',
  interestedIn:     'openTo',
  intention:        'openTo',
  datingIntentions: 'openTo',
  sexuality:        'openTo',
  children:         'openTo',
};

const FOCUS_STEP_OPEN_SECTION = {
  ethnicity: 'ethnicity',
  pronouns:  'pronouns',
  education: 'education',
  interests: 'interests',
};

// ── Reusable input primitives (defined in-file to keep the rewrite
//    contained). All theme-aware, all keyboard-stable.

function Chip({ label, active, onPress, icon, multi }) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 50, bounciness: 8 }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 10 }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={() => { Haptics.selectionAsync(); onPress?.(); }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          chipStyles.base,
          {
            borderColor: active ? colors.accent : colors.gray200,
            backgroundColor: active ? colors.accentSurface : colors.cardBg,
          },
          pressed && { opacity: 0.85 },
        ]}
      >
        {icon ? <Ionicons name={icon} size={14} color={active ? colors.accent : colors.gray500} style={{ marginRight: 6 }} /> : null}
        <Text style={[
          chipStyles.label,
          { color: active ? colors.accent : colors.gray600, fontFamily: active ? FontFamily.bold : FontFamily.medium },
        ]}>{label}</Text>
        {active && (
          <Ionicons name={multi ? 'checkmark' : 'checkmark-circle'} size={multi ? 14 : 16} color={colors.accent} style={{ marginLeft: 6 }} />
        )}
      </Pressable>
    </Animated.View>
  );
}

const chipStyles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  label: {
    fontSize: 14,
    letterSpacing: 0.1,
  },
});

function FloatingInput({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  multiline,
  maxLength,
  showCount,
  minLength,
  autoCapitalize,
  testID,
}) {
  const { colors, isDark } = useTheme();
  const [focused, setFocused] = useState(false);
  const hasValue = !!value;
  const float = useRef(new Animated.Value(hasValue ? 1 : 0)).current;
  const border = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(float, {
      toValue: focused || hasValue ? 1 : 0,
      duration: 160,
      useNativeDriver: false,
    }).start();
    Animated.timing(border, {
      toValue: focused ? 1 : 0,
      duration: 160,
      useNativeDriver: false,
    }).start();
  }, [focused, hasValue, float, border]);

  const labelTop = float.interpolate({ inputRange: [0, 1], outputRange: [multiline ? 16 : 18, 6] });
  const labelSize = float.interpolate({ inputRange: [0, 1], outputRange: [16, 11] });
  const labelColor = border.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.gray500, colors.accent],
  });
  const borderColor = border.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.gray200, colors.accent],
  });

  const len = (value || '').length;
  const overMin = minLength ? len >= minLength : true;
  const ratio = maxLength ? len / maxLength : 0;
  const countColor = ratio >= 1 ? colors.error : ratio >= 0.85 ? colors.warning : colors.gray400;

  // While focused, hide both the leading icon and the floating label so the
  // input claims the full row width — users typing into a 200-char bio want
  // every pixel. Icon + label re-appear on blur (label floats up if filled,
  // sits centered if empty).
  const showIcon = !!icon && !focused;
  const showLabel = !focused;

  return (
    <View style={{ marginBottom: 14 }}>
      <Animated.View style={[
        floatStyles.wrap,
        {
          backgroundColor: colors.cardBg,
          borderColor,
          minHeight: multiline ? 110 : 60,
          paddingTop: multiline ? (focused ? 14 : 26) : (focused ? 14 : 22),
        },
      ]}>
        {showIcon ? (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? colors.accent : colors.gray400}
            style={floatStyles.leadingIcon}
          />
        ) : null}
        {showLabel ? (
          <Animated.Text
            pointerEvents="none"
            style={[
              floatStyles.label,
              {
                left: icon ? 42 : 14,
                top: labelTop,
                fontSize: labelSize,
                color: labelColor,
              },
            ]}
          >
            {label}
          </Animated.Text>
        ) : null}
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={focused ? (placeholder || label) : ''}
          placeholderTextColor={colors.gray400}
          multiline={multiline}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
          style={[
            floatStyles.input,
            {
              color: colors.black,
              paddingLeft: showIcon ? 42 : 14,
              minHeight: multiline ? 70 : undefined,
              textAlignVertical: multiline ? 'top' : 'center',
            },
          ]}
        />
        {minLength && overMin && len > 0 && !focused && (
          <Ionicons
            name="checkmark-circle"
            size={16}
            color={colors.success}
            style={floatStyles.checkIcon}
          />
        )}
      </Animated.View>
      {showCount && maxLength ? (
        <Text style={[floatStyles.count, { color: countColor }]}>
          {len}/{maxLength}
        </Text>
      ) : null}
    </View>
  );
}

const floatStyles = StyleSheet.create({
  wrap: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingBottom: 10,
    position: 'relative',
  },
  leadingIcon: {
    position: 'absolute',
    left: 14,
    top: 21,
  },
  label: {
    position: 'absolute',
    fontFamily: FontFamily.medium,
    letterSpacing: 0.2,
    backgroundColor: 'transparent',
  },
  input: {
    ...Typography.body,
    fontSize: 16,
    padding: 0,
    margin: 0,
  },
  count: {
    ...Typography.caption,
    textAlign: 'right',
    marginTop: 6,
    marginRight: 4,
  },
  checkIcon: {
    position: 'absolute',
    right: 12,
    top: 20,
  },
});

function LockedRow({ label, value, hint, icon }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={[lockedStyles.wrap, { backgroundColor: colors.surfaceMuted, borderColor: colors.gray200 }]}>
        {icon ? <Ionicons name={icon} size={18} color={colors.gray400} style={{ marginRight: 12 }} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={[lockedStyles.label, { color: colors.gray500 }]}>{label}</Text>
          <Text style={[lockedStyles.value, { color: colors.gray600 }]} numberOfLines={1}>{value || '—'}</Text>
        </View>
        <Ionicons name="lock-closed" size={15} color={colors.gray400} />
      </View>
      {hint ? <Text style={[lockedStyles.hint, { color: colors.gray400 }]}>{hint}</Text> : null}
    </View>
  );
}

const lockedStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  label: {
    ...Typography.caption,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  value: {
    ...Typography.body,
    fontSize: 16,
  },
  hint: {
    ...Typography.caption,
    marginTop: 6,
    marginLeft: 4,
    fontSize: 12,
  },
});

function PickerRow({ label, icon, value, displayValue, placeholder, onPress, testID, leadingAccessory }) {
  const { colors } = useTheme();
  const filled = !!value;
  return (
    <Pressable
      testID={testID}
      onPress={() => { Haptics.selectionAsync(); onPress?.(); }}
      style={({ pressed }) => [
        pickerRowStyles.wrap,
        { backgroundColor: colors.cardBg, borderColor: colors.gray200 },
        pressed && { backgroundColor: colors.surfaceMuted },
      ]}
    >
      {icon ? <Ionicons name={icon} size={18} color={filled ? colors.accent : colors.gray500} style={{ marginRight: 12 }} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={[pickerRowStyles.label, { color: colors.gray500 }]}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {leadingAccessory}
          <Text
            style={[
              pickerRowStyles.value,
              { color: filled ? colors.black : colors.gray400, fontFamily: filled ? FontFamily.semibold : FontFamily.regular },
            ]}
            numberOfLines={1}
          >
            {displayValue || (filled ? value : placeholder || 'Tap to choose')}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
    </Pressable>
  );
}

const pickerRowStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  label: {
    ...Typography.caption,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  value: {
    ...Typography.body,
    fontSize: 16,
  },
});

function SectionCard({ title, subtitle, children, onLayout, style, accent }) {
  const { colors, isDark } = useTheme();
  return (
    <View onLayout={onLayout} style={[{ marginTop: 18 }, style]}>
      {title ? (
        <View style={sectionStyles.header}>
          {accent ? <View style={[sectionStyles.accentDot, { backgroundColor: colors.accent }]} /> : null}
          <Text style={[sectionStyles.title, { color: colors.black }]}>{title}</Text>
        </View>
      ) : null}
      {subtitle ? <Text style={[sectionStyles.subtitle, { color: colors.gray500 }]}>{subtitle}</Text> : null}
      <View
        style={[
          sectionStyles.card,
          {
            backgroundColor: colors.cardBg,
            borderColor: isDark ? colors.gray300 : colors.gray200,
            ...getShadow('sm', isDark),
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  accentDot: {
    width: 4,
    height: 18,
    borderRadius: 2,
    marginRight: 8,
  },
  title: {
    ...Typography.h4,
    fontSize: 18,
    letterSpacing: -0.1,
  },
  subtitle: {
    ...Typography.caption,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 4,
    overflow: 'hidden',
  },
});

function GroupLabel({ children }) {
  const { colors } = useTheme();
  return (
    <Text style={[groupLabelStyles.label, { color: colors.gray500 }]}>{children}</Text>
  );
}

const groupLabelStyles = StyleSheet.create({
  label: {
    ...Typography.captionBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 10,
  },
});

function ChipRow({ children }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>{children}</View>;
}

// Used for the legacy "More about you" dropdown card — each row is a
// tap-to-expand chip picker. Keeps the form compact when collapsed.
function CollapsibleRow({ label, icon, summary, open, onToggle, children, isLast }) {
  const { colors } = useTheme();
  const rotate = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(rotate, { toValue: open ? 1 : 0, duration: 200, useNativeDriver: true }).start();
  }, [open, rotate]);
  const chevronRotate = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  return (
    <View>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          LayoutAnimation.configureNext(LayoutAnimation.create(220, 'easeInEaseOut', 'opacity'));
          onToggle();
        }}
        style={({ pressed }) => [
          collapseStyles.header,
          pressed && { backgroundColor: colors.surfaceMuted },
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={summary ? colors.accent : colors.gray500} style={{ marginRight: 12 }} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={[collapseStyles.label, { color: colors.black }]}>{label}</Text>
          {summary ? (
            <Text style={[collapseStyles.summary, { color: colors.gray500 }]} numberOfLines={1}>{summary}</Text>
          ) : (
            <Text style={[collapseStyles.summary, { color: colors.gray400 }]}>Tap to choose</Text>
          )}
        </View>
        <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
          <Ionicons name="chevron-down" size={18} color={colors.gray400} />
        </Animated.View>
      </Pressable>
      {open && <View style={collapseStyles.body}>{children}</View>}
      {!isLast && <View style={[collapseStyles.divider, { backgroundColor: colors.gray200 }]} />}
    </View>
  );
}

const collapseStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  label: {
    ...Typography.bodyMedium,
    fontSize: 16,
    fontFamily: FontFamily.semibold,
  },
  summary: {
    ...Typography.caption,
    marginTop: 2,
    fontSize: 13,
  },
  body: {
    paddingTop: 4,
    paddingBottom: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 30,
  },
});

// Live preview — shows the user roughly what others see. Not a 1:1
// render of ProfileCard (that one carries swipe gesture machinery that
// would conflict inside a Modal); instead a calmer, scrollable card
// preview optimized for "is my bio good? do my chips look right?".
function ProfilePreviewSheet({ visible, onClose, snapshot, photoUris, completion }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = Dimensions.get('window');
  const cardW = screenWidth - 32;
  const cardH = Math.min(cardW * 1.25, Dimensions.get('window').height * 0.55);

  if (!visible) return null;

  const mainPhoto = photoUris?.[0];
  const otherPhotos = (photoUris || []).slice(1, 5);
  const country = snapshot.countryCode ? COUNTRY_BY_CODE[snapshot.countryCode] : null;
  const interests = snapshot.interests || [];
  const stickers = (snapshot.stickerObjects || []).slice(0, 5);
  const currentlyInto = snapshot.currentlyInto || [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <Pressable onPress={onClose} style={{ flex: 1 }} />
        <View style={{
          backgroundColor: colors.surfaceMuted,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          height: '92%',
          paddingTop: 8,
          paddingBottom: insets.bottom,
        }}>
          {/* Drag handle */}
          <View style={{ alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: colors.gray300, marginBottom: 8 }} />
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 }}>
            <View>
              <Text style={[Typography.h4, { color: colors.black, fontSize: 18 }]}>Live preview</Text>
              <Text style={[Typography.caption, { color: colors.gray500, marginTop: 2 }]}>This is roughly what others see</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.cardBg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="close" size={20} color={colors.black} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          >
            {/* Main photo card */}
            <View style={{ width: cardW, height: cardH, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.gray200, ...getShadow('md', isDark) }}>
              {mainPhoto ? (
                <Image source={imageSource(mainPhoto)} style={{ width: '100%', height: '100%' }} />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="person" size={64} color={colors.gray400} />
                </View>
              )}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.78)']}
                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' }}
              />
              <View style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  {country?.flag ? <Text style={{ fontSize: 16, marginRight: 8 }}>{country.flag}</Text> : null}
                  <Text style={{ ...Typography.h2, color: '#FFFFFF', fontSize: 26, letterSpacing: -0.4 }} numberOfLines={1}>
                    {snapshot.name || 'Your name'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {country?.name ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}>
                      <Ionicons name="location-outline" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={{ color: '#FFFFFF', fontSize: 12, fontFamily: FontFamily.semibold }}>{country.name}</Text>
                    </View>
                  ) : null}
                  {snapshot.job ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}>
                      <Ionicons name="briefcase-outline" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={{ color: '#FFFFFF', fontSize: 12, fontFamily: FontFamily.semibold }} numberOfLines={1}>{snapshot.job}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Completion banner */}
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardBg, borderRadius: 14, padding: 12, marginTop: 14, borderWidth: 1, borderColor: colors.gray200 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentSurface, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                <Ionicons name="sparkles" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...Typography.bodyMedium, fontSize: 14, color: colors.black }}>Profile is {completion}% complete</Text>
                <Text style={{ ...Typography.caption, fontSize: 12, color: colors.gray500, marginTop: 1 }}>
                  {completion >= 80 ? 'Looking great!' : 'Add more so people can find you'}
                </Text>
              </View>
            </View>

            {/* Bio */}
            {snapshot.bio ? (
              <View style={{ marginTop: 14, backgroundColor: colors.cardBg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.gray200 }}>
                <Text style={{ ...Typography.caption, fontSize: 11, color: colors.gray500, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6, fontFamily: FontFamily.bold }}>About me</Text>
                <Text style={{ ...Typography.body, color: colors.black }}>{snapshot.bio}</Text>
              </View>
            ) : null}

            {/* Prompt */}
            {snapshot.promptQuestion && snapshot.promptAnswer ? (
              <View style={{ marginTop: 14, backgroundColor: colors.cardBg, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.gray200 }}>
                <Text style={{ ...Typography.captionBold, color: colors.accent, marginBottom: 6, fontSize: 12 }}>{snapshot.promptQuestion}</Text>
                <Text style={{ ...Typography.h4, color: colors.black, fontSize: 18, lineHeight: 24 }}>{snapshot.promptAnswer}</Text>
              </View>
            ) : null}

            {/* Quick facts row */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
              {snapshot.school ? <PreviewPill icon="school-outline" label={snapshot.school} colors={colors} /> : null}
              {snapshot.education ? <PreviewPill icon="library-outline" label={snapshot.education} colors={colors} /> : null}
              {snapshot.pronouns ? <PreviewPill icon="at-outline" label={snapshot.pronouns} colors={colors} /> : null}
              {snapshot.ethnicity ? <PreviewPill icon="people-outline" label={snapshot.ethnicity} colors={colors} /> : null}
              {snapshot.lookingFor ? <PreviewPill icon="people-outline" label={snapshot.lookingFor} colors={colors} /> : null}
            </View>

            {/* Currently into */}
            {currentlyInto.length > 0 ? (
              <View style={{ marginTop: 14 }}>
                <Text style={{ ...Typography.captionBold, color: colors.gray500, marginBottom: 8, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' }}>Currently Into</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {currentlyInto.map((item, i) => (
                    <View key={i} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.accentSurface, borderWidth: 1, borderColor: colors.accent }}>
                      <Text style={{ ...Typography.caption, color: colors.accent, fontFamily: FontFamily.bold, fontSize: 12 }}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Interests */}
            {interests.length > 0 ? (
              <View style={{ marginTop: 14 }}>
                <Text style={{ ...Typography.captionBold, color: colors.gray500, marginBottom: 8, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' }}>Interests</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {interests.map((item, i) => (
                    <View key={i} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.gray200 }}>
                      <Text style={{ ...Typography.caption, color: colors.black, fontFamily: FontFamily.semibold, fontSize: 12 }}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Stickers */}
            {stickers.length > 0 ? (
              <View style={{ marginTop: 14 }}>
                <Text style={{ ...Typography.captionBold, color: colors.gray500, marginBottom: 8, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' }}>Identity</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {stickers.map((s, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.gray200 }}>
                      {GraffitiStickerIcon.has(s.emoji) ? (
                        <GraffitiStickerIcon emoji={s.emoji} size={14} color={colors.gray700} />
                      ) : (
                        <Text style={{ fontSize: 13 }}>{s.emoji}</Text>
                      )}
                      <Text style={{ marginLeft: 6, ...Typography.caption, fontSize: 12, color: colors.black, fontFamily: FontFamily.semibold }}>{s.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Other photos thumb strip */}
            {otherPhotos.length > 0 ? (
              <View style={{ marginTop: 18 }}>
                <Text style={{ ...Typography.captionBold, color: colors.gray500, marginBottom: 8, fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' }}>More photos</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {otherPhotos.map((uri, i) => (
                    <View key={i} style={{ flex: 1, aspectRatio: 0.8, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.gray200 }}>
                      <Image source={imageSource(uri)} style={{ width: '100%', height: '100%' }} />
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function PreviewPill({ icon, label, colors }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardBg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: colors.gray200 }}>
      <Ionicons name={icon} size={13} color={colors.gray500} style={{ marginRight: 6 }} />
      <Text style={{ ...Typography.caption, fontSize: 12, color: colors.black, fontFamily: FontFamily.semibold }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────

export default function EditProfileScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { session, updateUser } = useAuth();
  const { currentUser, refreshUser } = useCurrentUser();
  const [saving, setSaving] = useState(false);

  // `mode` used to fork this screen into dating vs social variants.
  // After the community pivot there is only one variant, so the param
  // is accepted (callers still pass it) and ignored.
  const rawFocusStep = route?.params?.focusStep || null;
  const focusStep = rawFocusStep
    ? (FOCUS_STEP_ALIAS.hasOwnProperty(rawFocusStep)
        ? FOCUS_STEP_ALIAS[rawFocusStep]
        : rawFocusStep)
    : null;

  const initialForm = useMemo(() => ({
    name: currentUser.name || '',
    bio: currentUser.bio || '',
    // One text field, two columns: `profession` is the canonical column
    // after the pivot, `job` the pre-existing one that card pills and
    // the preview sheet already read. Hydrate from whichever is set.
    job: currentUser.job || currentUser?._raw?.profile?.profession || '',
    school: currentUser.school || '',
    lookingFor: currentUser?._raw?.profile?.lookingFor || 'Friendship',
    ethnicity:  currentUser?._raw?.profile?.ethnicity  || '',
    education:  currentUser?._raw?.profile?.education  || '',
    pronouns:   currentUser?._raw?.profile?.pronouns   || '',
    interests:  Array.isArray(currentUser?._raw?.profile?.interests)
                  ? currentUser._raw.profile.interests
                  : [],
    // The three pivot columns. Each normalizer collapses null (an
    // un-migrated backend) to its safe default — [] / [] / 'off' — so
    // nothing downstream has to null-check before mapping.
    openTo:     normalizeOpenTo(currentUser?._raw?.profile?.openTo),
    languages:  normalizeLanguages(currentUser?._raw?.profile?.languages),
    locationVisibility: normalizeLocationVisibility(
      currentUser?._raw?.profile?.locationVisibility
    ),
    dob:              currentUser?._raw?.dateOfBirth || '',
    gender:           toUiGender(currentUser?._raw?.gender),
    promptQuestion:   currentUser?._raw?.profile?.promptQuestion || '',
    promptAnswer:     currentUser?._raw?.profile?.promptAnswer || '',
    countryCode:      currentUser?._raw?.countryCode || '',
    // City lives on User.city (free-text). Autosaves like bio/job/school.
    city:             currentUser?._raw?.city || '',
    // Height lives on Profile.heightCm. Numeric — uses the searchable
    // height picker below; '' when unset.
    heightCm:         currentUser?._raw?.profile?.heightCm || '',
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  const [form, dispatch] = useReducer(formReducer, initialForm);
  const setField = useCallback((key, value) => dispatch({ type: 'SET_FIELD', key, value }), []);

  // Snapshot for unsaved-changes detection on non-text fields. Text fields
  // (bio, job, school) auto-save; everything else flows through the explicit
  // Save button + the floating "unsaved changes" bar below.
  const snapshotRef = useRef(initialForm);
  const initialStickersRef = useRef(null);
  const initialCurrentlyIntoRef = useRef(currentUser.currentlyInto || []);

  const TEXT_DEBOUNCE_MS = 600;
  const textSaveTimerRef = useRef(null);
  const isMountedRef = useRef(false);
  const skipFirstRef = useRef(true);
  // Track the latest text-field values + last persisted values so the
  // unmount path can flush a pending edit (debounce in flight when the
  // user navigates back). Without this, fast typing followed by a quick
  // back-tap silently loses the bio/job/school/city change AND the
  // percentage that should have ticked up never persists.
  const latestTextRef = useRef({
    bio: initialForm.bio,
    job: initialForm.job,
    school: initialForm.school,
    city: initialForm.city,
  });
  const lastSavedTextRef = useRef({
    bio: initialForm.bio,
    job: initialForm.job,
    school: initialForm.school,
    city: initialForm.city,
  });
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (textSaveTimerRef.current) {
        clearTimeout(textSaveTimerRef.current);
        textSaveTimerRef.current = null;
      }
      // Flush pending text edits on unmount — fire-and-forget. The
      // mounted-ref guard above prevents updateUser from running on a
      // dead component; the write still lands server-side so the next
      // mount (and the ProfileScreen header that reads completion)
      // reflects the latest values.
      const latest = latestTextRef.current;
      const saved = lastSavedTextRef.current;
      const dirty =
        latest.bio !== saved.bio ||
        latest.job !== saved.job ||
        latest.school !== saved.school ||
        latest.city !== saved.city;
      if (dirty && sessionRef.current) {
        profileService
          .updateProfile({
            bio: (latest.bio || '').trim(),
            // `job` and `profession` are the same input — see initialForm.
            job: (latest.job || '').trim(),
            profession: (latest.job || '').trim(),
            school: (latest.school || '').trim(),
            city: (latest.city || '').trim(),
          })
          .catch((err) => {
            if (__DEV__) console.warn('[EditProfile] unmount flush failed:', err?.message);
          });
      }
    };
  }, []);

  useEffect(() => {
    latestTextRef.current = {
      bio: form.bio,
      job: form.job,
      school: form.school,
      city: form.city,
    };
    if (skipFirstRef.current) {
      skipFirstRef.current = false;
      return;
    }
    if (!session) return;
    if (textSaveTimerRef.current) clearTimeout(textSaveTimerRef.current);
    textSaveTimerRef.current = setTimeout(() => {
      textSaveTimerRef.current = null;
      profileService
        .updateProfile({
          bio: form.bio.trim(),
          job: form.job.trim(),
          profession: form.job.trim(),
          school: form.school.trim(),
          city: form.city.trim(),
        })
        .then((user) => {
          // Record the saved values regardless of mounted state so the
          // unmount flush doesn't re-send what we just persisted.
          lastSavedTextRef.current = {
            bio: form.bio,
            job: form.job,
            school: form.school,
            city: form.city,
          };
          if (!isMountedRef.current) return;
          if (user) updateUser(user);
          // Update text-field snapshot so dirty detection doesn't flag
          // already-persisted text edits.
          snapshotRef.current = {
            ...snapshotRef.current,
            bio: form.bio,
            job: form.job,
            school: form.school,
            city: form.city,
          };
        })
        .catch((err) => {
          if (!isMountedRef.current) return;
          if (__DEV__) console.warn('[EditProfile] background save failed:', err?.message);
        });
    }, TEXT_DEBOUNCE_MS);
    return () => {
      if (textSaveTimerRef.current) {
        clearTimeout(textSaveTimerRef.current);
        textSaveTimerRef.current = null;
      }
    };
  }, [form.bio, form.job, form.school, form.city, session, updateUser]);

  const [selectedStickers, setSelectedStickers] = useState(() => {
    const saved = currentUser.stickers;
    if (Array.isArray(saved) && saved.length > 0) {
      const indices = saved
        .map((s) => CULTURAL_STICKERS.findIndex((cs) => cs === s || cs?.id === s?.id || cs?.label === s?.label))
        .filter((i) => i >= 0);
      if (indices.length > 0) {
        initialStickersRef.current = indices.slice();
        return indices;
      }
    }
    initialStickersRef.current = [0, 1];
    return [0, 1];
  });
  const [currentlyInto, setCurrentlyInto] = useState(currentUser.currentlyInto || []);
  const [uploading, setUploading] = useState(false);
  const [openSection, setOpenSection] = useState(null);
  const [ethnicityPickerOpen, setEthnicityPickerOpen] = useState(false);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [heightPickerOpen, setHeightPickerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const dobLocked = !!(currentUser?._raw?.dateOfBirth);
  const dobDisplay = useMemo(() => {
    const d = parseToDate(form.dob);
    if (!d) return '—';
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }, [form.dob]);

  // ── Profile completion percentage ────────────────────────────────
  // Uses the shared calculateCompleteness util so this header reads the
  // SAME score as the "Complete Your Profile" card on ProfileScreen.
  // We hand it a live shape derived from the current form + photos so
  // unsaved edits update the percentage in real-time.
  const completenessResult = useMemo(() => {
    const liveUser = {
      ...currentUser._raw,
      displayName: form.name || currentUser._raw?.displayName,
      dateOfBirth: form.dob || currentUser._raw?.dateOfBirth,
      countryCode: form.countryCode || currentUser._raw?.countryCode,
      city:        form.city || currentUser._raw?.city,
      photos: currentUser._raw?.photos || [],
      profile: {
        ...(currentUser._raw?.profile || {}),
        bio:                form.bio,
        job:                form.job,
        school:             form.school,
        ethnicity:          form.ethnicity,
        interests:          form.interests,
        profession:         form.job,
        openTo:             form.openTo,
        languages:          form.languages,
        currentlyInto:      currentlyInto,
        heightCm:           form.heightCm ? Number(form.heightCm) : (currentUser._raw?.profile?.heightCm || null),
      },
    };
    return calculateCompleteness(liveUser);
  }, [form, currentlyInto, currentUser._raw]);
  const completion = completenessResult.score;

  // ── Unsaved-changes detection (non-text fields only) ─────────────
  const hasUnsavedChanges = useMemo(() => {
    const snap = snapshotRef.current;
    const NON_TEXT_KEYS = [
      'lookingFor', 'ethnicity', 'education', 'pronouns',
      'dob', 'gender', 'promptQuestion', 'promptAnswer', 'countryCode',
      'heightCm', 'locationVisibility',
    ];
    for (const k of NON_TEXT_KEYS) {
      if ((form[k] || '') !== (snap[k] || '')) return true;
    }
    const ARRAY_KEYS = ['interests', 'openTo', 'languages'];
    for (const k of ARRAY_KEYS) {
      if (JSON.stringify(form[k] || []) !== JSON.stringify(snap[k] || [])) return true;
    }
    const aS = JSON.stringify(selectedStickers);
    const bS = JSON.stringify(initialStickersRef.current || []);
    if (aS !== bS) return true;
    const aC = JSON.stringify(currentlyInto);
    const bC = JSON.stringify(initialCurrentlyIntoRef.current || []);
    if (aC !== bC) return true;
    return false;
  }, [form, selectedStickers, currentlyInto]);

  // Save bar slide-in animation when there are unsaved changes
  const saveBarTranslate = useRef(new Animated.Value(120)).current;
  useEffect(() => {
    Animated.spring(saveBarTranslate, {
      toValue: hasUnsavedChanges ? 0 : 120,
      useNativeDriver: true,
      tension: 80,
      friction: 11,
    }).start();
  }, [hasUnsavedChanges, saveBarTranslate]);

  // Header divider visibility on scroll
  const handleScroll = useCallback((e) => {
    const y = e.nativeEvent.contentOffset.y;
    if (y > 8 && !scrolled) setScrolled(true);
    else if (y <= 8 && scrolled) setScrolled(false);
  }, [scrolled]);

  const scrollRef = useRef(null);
  const sectionOffsetsRef = useRef({});
  const recordOffset = useCallback((key) => (e) => {
    sectionOffsetsRef.current[key] = e?.nativeEvent?.layout?.y ?? 0;
  }, []);
  const didFocusRef = useRef(false);
  useEffect(() => {
    if (!focusStep || didFocusRef.current) return;
    const expand = FOCUS_STEP_OPEN_SECTION[focusStep];
    if (expand) setOpenSection(expand);
    const t = setTimeout(() => {
      const SECTION_BY_FIELD = {
        name: 'basic', bio: 'basic', job: 'basic', school: 'basic',
        dob: 'identity', gender: 'identity', city: 'identity',
        openTo: 'openTo', languages: 'languages',
        locationVisibility: 'locationVisibility',
        promptQuestion: 'prompt', promptAnswer: 'prompt',
        lookingFor: 'openTo',
        currentlyInto: 'currentlyInto',
        photos: 'photos',
        ethnicity: 'more', pronouns: 'more', education: 'more', interests: 'more',
      };
      const section = SECTION_BY_FIELD[focusStep] || focusStep;
      const y = sectionOffsetsRef.current[section];
      if (typeof y === 'number' && scrollRef.current) {
        scrollRef.current.scrollTo({ y: Math.max(0, y - 12), animated: true });
      }
      didFocusRef.current = true;
    }, 120);
    return () => clearTimeout(t);
  }, [focusStep]);

  const toggleInArray = useCallback((key, value) => {
    const current = Array.isArray(form[key]) ? form[key] : [];
    setField(key, current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]);
  }, [form, setField]);

  const toggleSticker = (index) => {
    setSelectedStickers((prev) => {
      if (prev.includes(index)) {
        Haptics.selectionAsync();
        return prev.filter((i) => i !== index);
      }
      if (prev.length >= 5) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert('Limit Reached', 'You can select up to 5 identity stickers.');
        return prev;
      }
      Haptics.selectionAsync();
      return [...prev, index];
    });
  };

  const handleAddPhoto = async () => {
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

    const uri = result.assets[0].uri;
    if (!session) return;
    setUploading(true);
    try {
      await profileService.uploadPhoto(uri);
      await refreshUser();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Upload Failed', err.message || 'Could not upload photo. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSetPrimary = useCallback((photoId) => {
    if (!session || !photoId) return;
    Haptics.selectionAsync();
    Alert.alert(
      'Set as main photo?',
      'This photo will be the first one people see on your profile.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set as main',
          onPress: () => {
            profileService
              .setPrimaryPhoto(photoId)
              .then(() => { refreshUser(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); })
              .catch((err) => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                Alert.alert('Could not set as main', err?.message || 'Try again in a moment.');
              });
          },
        },
      ],
    );
  }, [session, refreshUser]);

  const handleSave = async () => {
    if (!session) {
      navigation.goBack();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSaving(true);
    // Cancel any pending text autosave — the explicit Save below covers
    // those fields too, and letting both fire produces duplicate writes
    // that race on the post-save snapshot reset.
    if (textSaveTimerRef.current) {
      clearTimeout(textSaveTimerRef.current);
      textSaveTimerRef.current = null;
    }
    let savedUser = null;
    let saveError = null;
    try {
      const stickers = selectedStickers.map((i) => CULTURAL_STICKERS[i]);
      const updates = {
        displayName: form.name.trim(),
        bio: form.bio.trim(),
        job: form.job.trim(),
        profession: form.job.trim(),
        school: form.school.trim(),
        lookingFor: form.lookingFor,
        ethnicity: form.ethnicity || null,
        education: form.education || null,
        pronouns: form.pronouns || '',
        interests: form.interests,
        openTo: form.openTo,
        languages: form.languages,
        // Always written, never conditionally omitted: 'off' is a
        // meaningful value the user may be actively choosing, and a
        // spread-guard would make "turn it back off" a silent no-op.
        locationVisibility: normalizeLocationVisibility(form.locationVisibility),
        stickers,
        currentlyInto,
        ...(toDbGender(form.gender) ? { gender: toDbGender(form.gender) } : {}),
        ...(form.dob && !dobLocked ? { dateOfBirth: form.dob } : {}),
        ...(form.promptQuestion ? { promptQuestion: form.promptQuestion } : {}),
        ...(form.promptAnswer ? { promptAnswer: form.promptAnswer.trim() } : {}),
        ...(form.countryCode ? { countryCode: form.countryCode } : {}),
        ...(form.city ? { city: form.city.trim() } : {}),
        ...(form.heightCm ? { heightCm: Number(form.heightCm) } : {}),
      };

      const projectedUser = {
        ...(currentUser._raw || {}),
        displayName: updates.displayName || form.name || currentUser._raw?.displayName,
        dateOfBirth: updates.dateOfBirth || form.dob || currentUser._raw?.dateOfBirth,
        gender: updates.gender || toDbGender(form.gender) || currentUser._raw?.gender,
        countryCode: updates.countryCode || form.countryCode || currentUser._raw?.countryCode,
        photos: currentUser._raw?.photos || [],
        city: updates.city || form.city || currentUser._raw?.city,
        profile: {
          ...(currentUser._raw?.profile || {}),
          ...updates,
          accountPurpose: currentUser._raw?.profile?.accountPurpose || 'socialize',
          promptQuestion: updates.promptQuestion || form.promptQuestion || currentUser._raw?.profile?.promptQuestion,
          promptAnswer: updates.promptAnswer || form.promptAnswer || currentUser._raw?.profile?.promptAnswer,
          interests: updates.interests || form.interests || currentUser._raw?.profile?.interests,
        },
      };
      // One mode now — a profile is either complete or it isn't.
      if (nextIncompleteStep(projectedUser.profile, projectedUser) === null) {
        updates.profileComplete = true;
      }

      savedUser = await profileService.updateProfile(updates);
      updateUser(savedUser);
      await refreshUser();
      // Refresh snapshot so the save bar dismisses and the autosave
      // flush on unmount doesn't re-send what we just persisted.
      snapshotRef.current = { ...form };
      initialStickersRef.current = selectedStickers.slice();
      initialCurrentlyIntoRef.current = currentlyInto.slice();
      lastSavedTextRef.current = {
        bio: form.bio,
        job: form.job,
        school: form.school,
        city: form.city,
      };
    } catch (err) {
      saveError = err;
    }
    // Dismiss the saving overlay BEFORE surfacing the result alert so
    // the system alert doesn't fight the fade-out animation on iOS.
    setSaving(false);
    if (saveError) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', saveError.message || 'Failed to save. Please try again.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Profile Updated!', 'Your changes have been saved.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  // Country accessory — flag emoji shown big when selected
  const countryEntry = form.countryCode ? COUNTRY_BY_CODE[form.countryCode] : null;
  const countryFlag = countryEntry ? (
    <Text style={{ fontSize: 20, marginRight: 8 }}>{countryEntry.flag}</Text>
  ) : null;
  const countryDisplay = countryEntry ? countryEntry.name : null;

  // Pronouns multi-select state
  const pronounsArr = (form.pronouns || '').split(',').map((s) => s.trim()).filter(Boolean);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Frosted sticky header */}
      <BlurView
        intensity={isDark ? 40 : 60}
        tint={isDark ? 'dark' : 'light'}
        style={[styles.headerWrap, { paddingTop: insets.top + 6 }]}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={26} color={colors.black} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <Text style={styles.headerTitle}>Edit Profile</Text>
          </View>
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); setPreviewOpen(true); }}
            style={styles.previewBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
            accessibilityLabel="Preview profile"
          >
            <Text style={styles.previewBtnText}>Preview</Text>
          </TouchableOpacity>
        </View>
        {scrolled && <View style={[styles.headerDivider, { backgroundColor: colors.gray200 }]} />}
      </BlurView>

      <ScrollView
        ref={scrollRef}
        style={styles.body}
        contentContainerStyle={{ paddingTop: insets.top + 76, paddingBottom: 160 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={32}
      >
        {/* ── Photos ── */}
        <View onLayout={recordOffset('photos')}>
          <View style={sectionStyles.header}>
            <View style={[sectionStyles.accentDot, { backgroundColor: colors.accent }]} />
            <Text style={[sectionStyles.title, { color: colors.black }]}>Photos</Text>
          </View>
          <Text style={[sectionStyles.subtitle, { color: colors.gray500 }]}>
            Tap a photo to make it your main · long-press the X to remove
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photosRow}>
            {(currentUser.images || []).map((img, i) => {
              const rawPhoto = currentUser._raw?.photos?.[i];
              const isMain = i === 0;
              return (
                <View key={rawPhoto?.id ?? `slot-${i}`} style={[styles.photoCard, getShadow(isMain ? 'md' : 'sm', isDark)]}>
                  <TouchableOpacity
                    activeOpacity={isMain ? 1 : 0.85}
                    onPress={() => {
                      if (isMain || !rawPhoto?.id) return;
                      handleSetPrimary(rawPhoto.id);
                    }}
                  >
                    <Image source={imageSource(img)} style={styles.photo} />
                    {!isMain && (
                      <View style={styles.photoOverlay}>
                        <Ionicons name="star" size={14} color="#FFFFFF" />
                        <Text style={styles.photoOverlayText}>Set as main</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.photoRemove}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => {
                      if (!session || !currentUser._raw) return;
                      const photo = currentUser._raw?.photos?.[i];
                      if (!photo) return;
                      const photoCount = currentUser._raw?.photos?.length || 0;
                      if (photoCount <= 3) {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                        Alert.alert(
                          'Minimum photos required',
                          'You must keep at least 3 photos on your profile. Add a new photo before removing this one.',
                        );
                        return;
                      }
                      Alert.alert('Remove Photo', 'Delete this photo?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => {
                          profileService.deletePhoto(photo.id).then(() => {
                            refreshUser();
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          }).catch((err) => {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                            Alert.alert('Error', err.message || 'Could not delete photo.');
                          });
                        }},
                      ]);
                    }}
                  >
                    <View style={styles.photoRemoveBg}>
                      <Ionicons name="close" size={14} color="#FFFFFF" />
                    </View>
                  </TouchableOpacity>
                  {isMain && (
                    <View style={[styles.mainBadge, { backgroundColor: colors.accent }]}>
                      <Ionicons name="star" size={10} color="#FFFFFF" style={{ marginRight: 3 }} />
                      <Text style={styles.mainBadgeText}>Main</Text>
                    </View>
                  )}
                </View>
              );
            })}
            <Pressable
              onPress={handleAddPhoto}
              disabled={uploading}
              style={({ pressed }) => [
                styles.addPhotoCard,
                { backgroundColor: colors.surfaceMuted, borderColor: colors.accent },
                pressed && { backgroundColor: colors.accentSurface },
              ]}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <>
                  <View style={[styles.addPhotoIconCircle, { backgroundColor: colors.accent }]}>
                    <Ionicons name="add" size={24} color="#FFFFFF" />
                  </View>
                  <Text style={[styles.addPhotoText, { color: colors.accent }]}>Add photo</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </View>

        {/* ── Basic Info ── */}
        <SectionCard title="Basic Info" subtitle="The essentials people see first" onLayout={recordOffset('basic')}>
          <LockedRow
            label="Name"
            value={form.name}
            icon="person-outline"
            hint="Your name can't be changed."
          />
          <FloatingInput
            label="Bio"
            value={form.bio}
            onChangeText={(val) => setField('bio', val)}
            placeholder="Tell people about yourself"
            icon="sparkles-outline"
            multiline
            maxLength={200}
            showCount
            minLength={10}
          />
          {/* One input, two columns — `profession` is the canonical
              column after the pivot, `job` the pre-existing one that
              the card pills and preview sheet already read. Both are
              written from this field on save and on autosave. */}
          <FloatingInput
            label="What you do"
            value={form.job}
            onChangeText={(val) => setField('job', val)}
            placeholder="e.g. Nurse, student, driver, engineer"
            icon="briefcase-outline"
            maxLength={80}
            testID="edit-profession"
          />
          <FloatingInput
            label="School"
            value={form.school}
            onChangeText={(val) => setField('school', val)}
            placeholder="Where did you study?"
            icon="school-outline"
            maxLength={80}
          />
        </SectionCard>

        {/* ── Identity ── */}
        <SectionCard title="Identity" subtitle="Where you're from and where you are now" onLayout={recordOffset('identity')}>
          <PickerRow
            label="Country"
            icon="earth-outline"
            value={form.countryCode}
            displayValue={countryDisplay}
            leadingAccessory={countryFlag}
            placeholder="Where are you based?"
            onPress={() => setCountryPickerOpen(true)}
            testID="edit-country-row"
          />
          <FloatingInput
            label="City"
            value={form.city}
            onChangeText={(val) => setField('city', val)}
            placeholder="e.g. Juba"
            icon="location-outline"
            maxLength={60}
          />
          <PickerRow
            label="Height"
            icon="resize-outline"
            value={form.heightCm ? String(form.heightCm) : ''}
            displayValue={(() => {
              if (!form.heightCm) return null;
              const cm = Number(form.heightCm);
              const totalIn = Math.round(cm / 2.54);
              const ft = Math.floor(totalIn / 12);
              const inch = totalIn % 12;
              return `${ft}'${inch}"  ·  ${cm} cm`;
            })()}
            placeholder="Tap to choose your height"
            onPress={() => setHeightPickerOpen(true)}
            testID="edit-height-row"
          />
          {dobLocked ? (
            <LockedRow
              label="Date of birth"
              value={dobDisplay}
              icon="calendar-outline"
              hint="Locked to keep ages accurate."
            />
          ) : (
            <View style={{ marginBottom: 14 }}>
              <Text style={[lockedStyles.label, { color: colors.gray500, marginLeft: 4, marginBottom: 8 }]}>Date of birth</Text>
              <DateWheelPicker
                testID="edit-dob"
                value={form.dob}
                placeholder="Select your date of birth"
                onChange={(payload) => setField('dob', payload.iso)}
              />
              <Text style={[lockedStyles.hint, { color: colors.gray400 }]}>
                You can only set this once — it can't be changed later.
              </Text>
            </View>
          )}

          <GroupLabel>Gender</GroupLabel>
          <ChipRow>
            {GENDER_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={option}
                active={form.gender === option}
                onPress={() => setField('gender', form.gender === option ? '' : option)}
              />
            ))}
          </ChipRow>

        </SectionCard>

        {/* ── Languages ── */}
        <SectionCard
          title="Languages"
          subtitle="Which languages do you speak?"
          onLayout={recordOffset('languages')}
        >
          <ChipRow>
            {LANGUAGE_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={option}
                multi
                active={(form.languages || []).includes(option)}
                onPress={() => toggleInArray('languages', option)}
              />
            ))}
          </ChipRow>
        </SectionCard>

        {/* ── Your prompt ── */}
        <SectionCard
          title="Your prompt"
          subtitle="Pick a question, write a short answer — it'll show on your profile"
          onLayout={recordOffset('prompt')}
        >
          <GroupLabel>Question</GroupLabel>
          <ChipRow>
            {PROMPT_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={option}
                active={form.promptQuestion === option}
                onPress={() => setField('promptQuestion', form.promptQuestion === option ? '' : option)}
              />
            ))}
          </ChipRow>
          <FloatingInput
            label="Your answer"
            value={form.promptAnswer}
            onChangeText={(val) => setField('promptAnswer', val)}
            placeholder="Write a short answer (10+ characters)"
            icon="chatbubble-ellipses-outline"
            multiline
            maxLength={200}
            showCount
            minLength={10}
          />
        </SectionCard>

        {/* ── Open to ── */}
        <SectionCard
          title="Open to"
          subtitle="Pick everything that fits — this is how people find their people"
          onLayout={recordOffset('openTo')}
        >
          <ChipRow>
            {OPEN_TO_OPTIONS.map((option) => (
              <Chip
                key={option.key}
                label={option.label}
                icon={option.icon}
                multi
                active={(form.openTo || []).includes(option.key)}
                onPress={() => toggleInArray('openTo', option.key)}
              />
            ))}
          </ChipRow>

          <GroupLabel>Here for</GroupLabel>
          <ChipRow>
            {HERE_FOR_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={option}
                active={form.lookingFor === option}
                onPress={() => setField('lookingFor', option)}
              />
            ))}
          </ChipRow>
        </SectionCard>

        {/* ── Location privacy ──
            Mirrors the final onboarding step. In-app visibility only —
            this control never triggers an OS location prompt, and
            nothing here imports expo-location. */}
        <SectionCard
          title="Location privacy"
          subtitle="You're in control. Location sharing is off unless you turn it on."
          onLayout={recordOffset('locationVisibility')}
        >
          <View style={styles.privacyNote}>
            <Ionicons name="lock-closed" size={16} color={colors.accent} style={{ marginTop: 2 }} />
            <Text style={styles.privacyNoteText}>
              Location is <Text style={styles.privacyNoteStrong}>off by default</Text> and you can
              change it any time. We never show your exact address, never sell your
              location, and never use it for ad targeting.
            </Text>
          </View>
          {LOCATION_VISIBILITY_OPTIONS.map((option) => {
            const isActive = normalizeLocationVisibility(form.locationVisibility) === option.key;
            return (
              <Pressable
                key={option.key}
                testID={`edit-location-visibility-${option.key}`}
                onPress={() => {
                  Haptics.selectionAsync();
                  setField('locationVisibility', option.key);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: isActive }}
                accessibilityLabel={`${option.label}. ${option.description}`}
                style={({ pressed }) => [
                  styles.visibilityOption,
                  {
                    borderColor: isActive ? colors.accent : colors.gray200,
                    backgroundColor: isActive ? colors.accentSurface : colors.cardBg,
                  },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Ionicons
                  name={option.icon}
                  size={18}
                  color={isActive ? colors.accent : colors.gray500}
                  style={{ marginRight: 12 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[
                    styles.visibilityOptionLabel,
                    { color: isActive ? colors.accent : colors.black },
                  ]}>
                    {option.label}{option.key === 'off' ? '  ·  Default' : ''}
                  </Text>
                  <Text style={[styles.visibilityOptionDesc, { color: colors.gray500 }]}>
                    {option.description}
                  </Text>
                </View>
                <Ionicons
                  name={isActive ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={isActive ? colors.accent : colors.gray300}
                />
              </Pressable>
            );
          })}
        </SectionCard>

        {/* ── Currently Into ── */}
        <SectionCard
          title="Currently Into"
          subtitle="What are you vibing with right now?"
          onLayout={recordOffset('currentlyInto')}
        >
          <CurrentlyIntoSelector value={currentlyInto} onChange={setCurrentlyInto} />
        </SectionCard>

        {/* ── More about you (collapsible group) ── */}
        <SectionCard title="More about you" onLayout={recordOffset('more')}>
          <CollapsibleRow
            label="Ethnicity"
            icon="people-outline"
            summary={form.ethnicity}
            open={false}
            onToggle={() => { setEthnicityPickerOpen(true); }}
          >
            {null}
          </CollapsibleRow>

          <CollapsibleRow
            label="Pronouns"
            icon="at-outline"
            summary={form.pronouns}
            open={openSection === 'pronouns'}
            onToggle={() => setOpenSection(openSection === 'pronouns' ? null : 'pronouns')}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PRONOUN_OPTIONS.map((option) => {
                const isOn = pronounsArr.includes(option);
                return (
                  <Chip
                    key={option}
                    label={option}
                    active={isOn}
                    multi
                    onPress={() => {
                      const next = isOn
                        ? pronounsArr.filter((p) => p !== option)
                        : (pronounsArr.length >= 4 ? pronounsArr : [...pronounsArr, option]);
                      setField('pronouns', next.join(', '));
                    }}
                  />
                );
              })}
            </View>
          </CollapsibleRow>

          <CollapsibleRow
            label="Education"
            icon="library-outline"
            summary={form.education}
            open={openSection === 'education'}
            onToggle={() => setOpenSection(openSection === 'education' ? null : 'education')}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {EDUCATION_OPTIONS.map((option) => (
                <Chip
                  key={option}
                  label={option}
                  active={form.education === option}
                  onPress={() => setField('education', form.education === option ? '' : option)}
                />
              ))}
            </View>
          </CollapsibleRow>

          <CollapsibleRow
            label="Interests"
            icon="heart-outline"
            summary={
              form.interests.length === 0
                ? ''
                : form.interests.length === 1
                  ? form.interests[0]
                  : `${form.interests.length} selected`
            }
            open={openSection === 'interests'}
            onToggle={() => setOpenSection(openSection === 'interests' ? null : 'interests')}
            isLast
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {INTEREST_OPTIONS.map((option) => {
                const isOn = form.interests.includes(option);
                return (
                  <Chip
                    key={option}
                    label={option}
                    active={isOn}
                    multi
                    onPress={() => {
                      const next = isOn ? form.interests.filter((i) => i !== option) : [...form.interests, option];
                      setField('interests', next);
                    }}
                  />
                );
              })}
            </View>
          </CollapsibleRow>
        </SectionCard>

        {/* ── Identity Stickers ── */}
        <SectionCard title="Identity Stickers" subtitle="Select up to 5 that represent you">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {CULTURAL_STICKERS.map((sticker, index) => {
              const isSelected = selectedStickers.includes(index);
              return (
                <Pressable
                  key={index}
                  onPress={() => toggleSticker(index)}
                  style={({ pressed }) => [
                    styles.stickerChip,
                    {
                      borderColor: isSelected ? colors.accent : colors.gray200,
                      backgroundColor: isSelected ? colors.accentSurface : colors.cardBg,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  {GraffitiStickerIcon.has(sticker.emoji) ? (
                    <GraffitiStickerIcon emoji={sticker.emoji} size={20} color={isSelected ? colors.accent : colors.gray500} />
                  ) : (
                    <Text style={styles.stickerEmoji}>{sticker.emoji}</Text>
                  )}
                  <Text style={[
                    styles.stickerLabel,
                    { color: isSelected ? colors.accent : colors.gray600, fontFamily: isSelected ? FontFamily.bold : FontFamily.medium },
                  ]}>
                    {sticker.label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={15} color={colors.accent} style={{ marginLeft: 4 }} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </SectionCard>
      </ScrollView>

      {/* Floating save bar — slides up when there are unsaved changes */}
      <Animated.View
        pointerEvents={hasUnsavedChanges ? 'auto' : 'none'}
        style={[
          styles.saveBar,
          {
            paddingBottom: insets.bottom + 12,
            transform: [{ translateY: saveBarTranslate }],
            backgroundColor: colors.cardBg,
            borderTopColor: colors.gray200,
            ...getShadow('lg', isDark),
          },
        ]}
      >
        <View style={styles.saveBarInner}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.saveBarTitle, { color: colors.black }]}>Unsaved changes</Text>
            <Text style={[styles.saveBarSub, { color: colors.gray500 }]}>Tap save to publish your updates</Text>
          </View>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
            style={[styles.savePill, { backgroundColor: colors.accent }, saving && { opacity: 0.7 }]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark" size={18} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.savePillText}>Save</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>

      <SearchablePicker
        visible={ethnicityPickerOpen}
        onClose={() => setEthnicityPickerOpen(false)}
        title="Ethnicity"
        searchPlaceholder="Search tribes…"
        options={ETHNICITY_PICKER_OPTIONS}
        selectedValue={form.ethnicity}
        onSelect={(value) => setField('ethnicity', value)}
      />
      <SearchablePicker
        visible={countryPickerOpen}
        onClose={() => setCountryPickerOpen(false)}
        title="Choose your country"
        searchPlaceholder="Search countries…"
        options={COUNTRY_PICKER_OPTIONS}
        selectedValue={form.countryCode}
        onSelect={(value) => setField('countryCode', value)}
      />
      <SearchablePicker
        visible={heightPickerOpen}
        onClose={() => setHeightPickerOpen(false)}
        title="Your height"
        searchPlaceholder="Search (e.g. 5'8 or 173)…"
        options={HEIGHT_PICKER_OPTIONS}
        selectedValue={form.heightCm ? Number(form.heightCm) : null}
        onSelect={(value) => setField('heightCm', value)}
      />
      <ProfilePreviewSheet
        visible={previewOpen}
        onClose={() => setPreviewOpen(false)}
        snapshot={{
          ...form,
          stickerObjects: selectedStickers.map((i) => CULTURAL_STICKERS[i]).filter(Boolean),
          currentlyInto,
        }}
        photoUris={currentUser.images || []}
        completion={completion}
      />

      {/* Full-screen saving overlay — covers the form while the save
          request is in flight so users see a clear "we're working on it"
          state instead of an unchanged screen with only a tiny pill
          spinner. Modal blocks taps so the form can't be edited or
          re-submitted while the write is pending. */}
      <Modal
        visible={saving}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => { /* save is in flight — ignore hardware back */ }}
      >
        <View style={styles.savingOverlay}>
          <View style={[styles.savingCard, { backgroundColor: colors.cardBg }]}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.savingTitle, { color: colors.black }]}>Saving changes…</Text>
            <Text style={[styles.savingSub, { color: colors.gray500 }]}>Updating your profile</Text>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },

  // ─── Location privacy ───
  // Mirrors the same block in ProfileSetupScreen so the consent copy
  // reads identically in onboarding and in Settings.
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    marginBottom: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  privacyNoteText: {
    ...Typography.caption,
    color: colors.gray600,
    lineHeight: 18,
    flex: 1,
  },
  privacyNoteStrong: {
    color: colors.black,
    fontFamily: FontFamily.bold,
  },
  visibilityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    // 14pt vertical padding around a two-line block clears the 44pt
    // minimum touch target from ACCESSIBILITY_QA_MATRIX.md.
    paddingVertical: 14,
    minHeight: 44,
    marginBottom: 10,
  },
  visibilityOptionLabel: {
    ...Typography.bodyMedium,
    fontSize: 15,
    fontFamily: FontFamily.semibold,
    marginBottom: 2,
  },
  visibilityOptionDesc: {
    ...Typography.caption,
    fontSize: 12,
    lineHeight: 17,
  },
  headerWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBtn: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBtnText: {
    fontSize: 16,
    color: colors.accent,
    fontFamily: FontFamily.regular,
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  headerTitle: {
    ...Typography.h4,
    fontSize: 17,
    color: colors.black,
  },
  headerDivider: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
  },

  // Photos
  photosRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  photoCard: {
    width: 108,
    height: 148,
    borderRadius: 16,
    marginRight: 10,
    overflow: 'hidden',
    backgroundColor: colors.gray200,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  photoOverlayText: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  photoRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  photoRemoveBg: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  mainBadgeText: {
    ...Typography.caption,
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: 10,
    letterSpacing: 0.4,
  },
  addPhotoCard: {
    width: 108,
    height: 148,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addPhotoIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: {
    ...Typography.caption,
    fontFamily: FontFamily.bold,
    fontSize: 13,
  },

  // Stickers (slightly bigger touch target)
  stickerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  stickerEmoji: {
    fontSize: 16,
  },
  stickerLabel: {
    ...Typography.bodySmallMedium,
    fontSize: 14,
  },

  // Floating save bar
  saveBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 14,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  saveBarTitle: {
    ...Typography.bodyMedium,
    fontSize: 15,
    fontFamily: FontFamily.bold,
  },
  saveBarSub: {
    ...Typography.caption,
    fontSize: 12,
    marginTop: 2,
  },
  savePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    minWidth: 110,
  },
  savePillText: {
    ...Typography.label,
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    fontSize: 15,
  },
  savingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  savingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 24,
    borderRadius: 18,
    minWidth: 220,
  },
  savingTitle: {
    ...Typography.bodyMedium,
    fontSize: 15,
    fontFamily: FontFamily.bold,
    marginTop: 14,
  },
  savingSub: {
    ...Typography.caption,
    fontSize: 12,
    marginTop: 4,
  },
});
