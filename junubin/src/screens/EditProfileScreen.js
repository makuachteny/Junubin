// EditProfileScreen — the redesign's "Edit profile" overlay
// (claude.ai/design "JuNubin Redesign"): exactly three sections —
// BACKGROUND chips, LANGUAGES chips, and the single profile-prompt
// input — closed by a Blueprint-framed gold SAVE. Photos are managed
// from the Profile tab's strength checklist, everything else identity-
// shaped (name, DOB, gender) is set once during onboarding.
//
// Profile.ethnicity is a SINGLE tribe key (same contract as
// ProfileSetupScreen), so the BACKGROUND chips behave as a radio group
// — tapping the current selection clears it. Languages are a true
// multi-select persisted as an array of the exact option strings.

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FontFamily } from '../theme';
import Blueprint from '../components/Blueprint';
import { useAuth } from '../auth';
import { useCurrentUser } from '../hooks';
import * as profileService from '../api/services/profileService';
import { ALL_TRIBE_KEYS } from '../data/tribes';
import { LANGUAGE_OPTIONS, normalizeLanguages } from '../data/languages';

// The design's one fixed prompt. Persisted as promptQuestion so the
// detail view can caption the answer.
const PROMPT_QUESTION = 'What brought you to your city?';

export default function EditProfileScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { session, updateUser } = useAuth();
  const { currentUser, refreshUser } = useCurrentUser();
  const [saving, setSaving] = useState(false);

  const [ethnicity, setEthnicity] = useState(currentUser?.ethnicity || '');
  const [languages, setLanguages] = useState(() =>
    normalizeLanguages(currentUser?.languages),
  );
  const [promptAnswer, setPromptAnswer] = useState(
    currentUser?._raw?.profile?.promptAnswer || '',
  );

  const toggleLanguage = (lang) => {
    setLanguages((prev) => (
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    ));
  };

  // Old callers (and stale deep links) may still pass focusStep — honor
  // it as a scroll target; anything unknown is simply ignored.
  const scrollRef = useRef(null);
  const offsetsRef = useRef({});
  const recordOffset = (key) => (e) => {
    offsetsRef.current[key] = e?.nativeEvent?.layout?.y ?? 0;
  };
  useEffect(() => {
    const focusStep = route?.params?.focusStep;
    if (!focusStep) return;
    const section = {
      ethnicity: 'background',
      background: 'background',
      languages: 'languages',
      prompt: 'prompt',
      promptAnswer: 'prompt',
      prompts: 'prompt',
    }[focusStep];
    if (!section) return;
    const t = setTimeout(() => {
      const y = offsetsRef.current[section];
      if (typeof y === 'number' && scrollRef.current) {
        scrollRef.current.scrollTo({ y: Math.max(0, y - 12), animated: true });
      }
    }, 150);
    return () => clearTimeout(t);
  }, [route?.params?.focusStep]);

  const handleSave = async () => {
    if (saving) return;
    if (!session) {
      navigation.goBack();
      return;
    }
    setSaving(true);
    try {
      const savedUser = await profileService.updateProfile({
        ethnicity: ethnicity || null,
        languages,
        promptQuestion: promptAnswer.trim() ? PROMPT_QUESTION : '',
        promptAnswer: promptAnswer.trim(),
      });
      if (savedUser) updateUser(savedUser);
      await refreshUser();
      setSaving(false);
      navigation.goBack();
    } catch (err) {
      setSaving(false);
      Alert.alert('Error', err.message || 'Failed to save. Please try again.');
    }
  };

  const renderChip = ({ key, label, selected, onPress, testID }) => (
    <TouchableOpacity
      key={key}
      testID={testID}
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      // Chips are 40pt tall (per the mock) — hitSlop keeps the touch
      // target at the 44pt accessibility floor.
      hitSlop={{ top: 2, bottom: 2 }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Header: back chevron + condensed title ── */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header">Edit profile</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.body}
        contentContainerStyle={styles.bodyInner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Background ── */}
        <View onLayout={recordOffset('background')}>
          <Text style={styles.sectionLabel}>BACKGROUND</Text>
          <View style={styles.chipGrid}>
            {ALL_TRIBE_KEYS.map((tribe) => renderChip({
              key: tribe,
              label: tribe,
              selected: ethnicity === tribe,
              onPress: () => setEthnicity((prev) => (prev === tribe ? '' : tribe)),
              testID: `edit-tribe-${tribe}`,
            }))}
          </View>
        </View>

        {/* ── Languages ── */}
        <View style={styles.section} onLayout={recordOffset('languages')}>
          <Text style={styles.sectionLabel}>LANGUAGES</Text>
          <View style={styles.chipGrid}>
            {LANGUAGE_OPTIONS.map((lang) => renderChip({
              key: lang,
              label: lang,
              selected: languages.includes(lang),
              onPress: () => toggleLanguage(lang),
              testID: `edit-language-${lang}`,
            }))}
          </View>
        </View>

        {/* ── Profile prompt ── */}
        <View style={styles.section} onLayout={recordOffset('prompt')}>
          <Text style={styles.sectionLabel}>
            PROFILE PROMPT
            <Text style={styles.sectionLabelHint}> — what brought you to your city?</Text>
          </Text>
          <TextInput
            style={styles.promptInput}
            testID="edit-prompt"
            value={promptAnswer}
            onChangeText={(t) => setPromptAnswer(t.slice(0, 140))}
            placeholder="e.g. Came for university, stayed for the community"
            placeholderTextColor={colors.gray400}
            maxLength={140}
            returnKeyType="done"
            accessibilityLabel="Profile prompt: what brought you to your city?"
          />
        </View>
      </ScrollView>

      {/* ── SAVE ── */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <Blueprint>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Save"
          >
            {saving ? (
              <ActivityIndicator color={colors.onGold} />
            ) : (
              <Text style={styles.saveText}>SAVE</Text>
            )}
          </TouchableOpacity>
        </Blueprint>
      </View>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingBottom: 6,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 24,
    color: colors.black,
  },

  // ── Body ──
  body: {
    flex: 1,
  },
  bodyInner: {
    paddingTop: 6,
    paddingHorizontal: 18,
    paddingBottom: 20,
  },
  section: {
    marginTop: 20,
  },
  sectionLabel: {
    fontFamily: FontFamily.semibold,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.gray500,
    marginBottom: 8,
  },
  sectionLabelHint: {
    fontFamily: FontFamily.regular,
    letterSpacing: 0,
    color: colors.gray400,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: 'transparent',
  },
  chipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentTint15,
  },
  chipText: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    color: colors.black,
  },
  chipTextSelected: {
    fontFamily: FontFamily.semibold,
    color: colors.accentDark,
  },
  promptInput: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.inputBg,
    borderRadius: 4,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: FontFamily.regular,
    color: colors.black,
  },

  // ── Footer CTA ──
  footer: {
    paddingHorizontal: 18,
  },
  saveBtn: {
    height: 52,
    backgroundColor: colors.ssGold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveText: {
    fontSize: 17,
    fontFamily: FontFamily.headingBold,
    letterSpacing: 1.4,
    color: colors.onGold,
    textTransform: 'uppercase',
  },
});
