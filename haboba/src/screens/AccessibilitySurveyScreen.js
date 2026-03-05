import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import { useAccessibilityPreferences } from '../accessibility';

const QUESTIONS = [
  {
    key: 'highContrast',
    title: 'Higher contrast text',
    subtitle: 'Makes small and secondary text easier to read.',
  },
  {
    key: 'nonColorCues',
    title: 'Labels beyond color',
    subtitle: 'Adds text cues like Unread and Read in key places.',
  },
  {
    key: 'largerTouchTargets',
    title: 'Larger tap targets',
    subtitle: 'Expands interactive controls for easier tapping.',
  },
  {
    key: 'reducedMotion',
    title: 'Reduced motion',
    subtitle: 'Minimizes animation intensity and motion effects.',
  },
  {
    key: 'screenReaderHints',
    title: 'Extra screen reader hints',
    subtitle: 'Adds clearer spoken labels for controls and states.',
  },
];

export default function AccessibilitySurveyScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { saveSurveyResponses } = useAccessibilityPreferences();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [answers, setAnswers] = useState({
    highContrast: true,
    nonColorCues: true,
    largerTouchTargets: false,
    reducedMotion: false,
    screenReaderHints: true,
  });

  const setAnswer = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const handleContinue = async () => {
    await saveSurveyResponses(answers);
    navigation.replace('ProfileSetup');
  };

  const handleSkip = async () => {
    await saveSurveyResponses({
      highContrast: false,
      nonColorCues: false,
      largerTouchTargets: false,
      reducedMotion: false,
      screenReaderHints: false,
    });
    navigation.replace('ProfileSetup');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 18 }]}>
        <Text style={styles.kicker}>Personalize Your Experience</Text>
        <Text style={styles.title}>Accessibility Survey</Text>
        <Text style={styles.subtitle}>
          Choose what helps you most. We only enable these improvements if you opt in.
        </Text>

        <View style={styles.card}>
          {QUESTIONS.map((q) => (
            <View key={q.key} style={styles.row}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>{q.title}</Text>
                <Text style={styles.rowSubtitle}>{q.subtitle}</Text>
              </View>
              <Switch
                value={!!answers[q.key]}
                onValueChange={(v) => setAnswer(q.key, v)}
                trackColor={{ false: colors.gray300, true: colors.accentTint25 }}
                thumbColor={answers[q.key] ? colors.accent : '#FFFFFF'}
              />
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={handleContinue} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Save Preferences</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    paddingHorizontal: 18,
    gap: 14,
  },
  kicker: {
    ...Typography.captionBold,
    color: colors.accent,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    ...Typography.h2,
    color: colors.black,
    fontFamily: FontFamily.bold,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: colors.gray600,
    lineHeight: 20,
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface || colors.white,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
    gap: 12,
  },
  rowCopy: {
    flex: 1,
  },
  rowTitle: {
    ...Typography.sectionLabel,
    color: colors.black,
    marginBottom: 2,
  },
  rowSubtitle: {
    ...Typography.caption,
    color: colors.gray500,
    lineHeight: 16,
  },
  primaryBtn: {
    marginTop: 8,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnText: {
    ...Typography.bodySemibold,
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    ...Typography.bodySmall,
    color: colors.gray500,
    textDecorationLine: 'underline',
  },
});
