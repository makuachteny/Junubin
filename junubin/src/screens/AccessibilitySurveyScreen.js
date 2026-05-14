import React, { useMemo, useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Animated, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import { useAccessibilityPreferences } from '../accessibility';
import LogoMark from '../components/LogoMark';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../auth';
import { supabase } from '../config/supabase';

const QUESTIONS = [
  {
    key: 'highContrast',
    title: 'Higher contrast text',
    subtitle: 'Makes small and secondary text easier to read.',
    required: true,
  },
  {
    key: 'nonColorCues',
    title: 'Labels beyond color',
    subtitle: 'Adds text cues like Unread and Read in key places.',
    required: true,
  },
  {
    key: 'largerTouchTargets',
    title: 'Larger tap targets',
    subtitle: 'Expands interactive controls for easier tapping.',
    required: false,
  },
  {
    key: 'reducedMotion',
    title: 'Reduced motion',
    subtitle: 'Minimizes animation intensity and motion effects.',
    required: false,
  },
  {
    key: 'screenReaderHints',
    title: 'Extra screen reader hints',
    subtitle: 'Adds clearer spoken labels for controls and states.',
    required: false,
  },
];

export default function AccessibilitySurveyScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { saveSurveyResponses } = useAccessibilityPreferences();
  const { refreshUser } = useAuth();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [answers, setAnswers] = useState({
    highContrast: true,
    nonColorCues: true,
    largerTouchTargets: false,
    reducedMotion: false,
    screenReaderHints: true,
  });
  const [touched, setTouched] = useState({
    highContrast: true,
    nonColorCues: true,
    largerTouchTargets: false,
    reducedMotion: false,
    screenReaderHints: false,
  });
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!loading) return;
    // Fade in the loading overlay
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    // Pulse the logo
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    // Navigate after delay. Default destination is Main (the app
    // shell) — not ProfileSetup, since this screen is the *terminal*
    // step of onboarding. Falling back to ProfileSetup created a loop
    // for any user who reached here without an explicit `returnTo`:
    // ProfileSetup → Main → SurveyNudgeModal → AccessibilitySurvey →
    // (no returnTo) → ProfileSetup. Resetting the nav stack rather
    // than replacing means Back from Home can't peel us back here.
    const timer = setTimeout(() => {
      const returnTo = route?.params?.returnTo;
      if (returnTo === 'back') {
        navigation.goBack();
      } else if (returnTo === 'Main' || !returnTo) {
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      } else {
        navigation.replace(returnTo, route?.params?.returnParams);
      }
    }, 800);
    return () => { clearTimeout(timer); pulse.stop(); };
  }, [loading, fadeAnim, pulseAnim, navigation, route?.params?.returnTo, route?.params?.returnParams]);

  const setAnswer = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    setTouched((prev) => ({ ...prev, [key]: true }));
  };

  const markModeSurveyComplete = async () => {
    const storedMode = await AsyncStorage.getItem('@junubin_mode');
    const mode = route?.params?.mode || (storedMode === 'Dating' ? 'Dating' : 'Social');
    // AsyncStorage flag remains as a fast-path local cache so screens
    // that boot before the network round-trips don't flicker the
    // nudge. The source of truth is `Profile.surveyCompletedAt` —
    // server-side guards (try_record_swipe, discover) read only the DB,
    // so a missing AsyncStorage flag never lets a real action through.
    const key = mode === 'Dating' ? '@junubin_mode_survey_dating' : '@junubin_mode_survey_social';
    await AsyncStorage.setItem(key, 'true');

    // Persist to DB. Failure is non-fatal for the social-only mode (the
    // server gate doesn't apply there) but for dating it's load-bearing,
    // so we surface errors via the existing handleContinue catch.
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const { data: appUser } = await supabase
        .from('User')
        .select('id')
        .eq('auth_id', authUser.id)
        .single();
      if (!appUser?.id) return;
      // Two writes — surveyCompletedAt is a public flag (eligibility
      // signal); surveyAnswers go to ProfileSurveyAnswers which is
      // owner-read-only via RLS. Sequenced so the public flag flips
      // last; if the answers write fails we don't claim completion.
      await supabase
        .from('ProfileSurveyAnswers')
        .upsert(
          { userId: appUser.id, answers },
          { onConflict: 'userId' },
        );
      await supabase
        .from('Profile')
        .update({ surveyCompletedAt: new Date().toISOString() })
        .eq('userId', appUser.id);

      // Re-fetch the User row into AuthContext so the next dating
      // action (back on HomeScreen) sees `surveyCompletedAt` populated
      // immediately. Without this refetch, useEligibility's `gate()`
      // continues to nudge until the next auth state change or
      // refreshUser() call elsewhere.
      try { await refreshUser?.(); } catch {}
    } catch (e) {
      // Re-throw on dating mode so handleContinue can show the error.
      // Social mode is best-effort — survey is informational there.
      if (mode === 'Dating') throw e;
    }
  };

  const handleContinue = async () => {
    setLoading(true);
    try {
      // Await both saves so we don't navigate away before the user's
      // accessibility prefs are committed.
      await Promise.all([
        saveSurveyResponses(answers),
        markModeSurveyComplete(),
      ]);
    } catch {
      setLoading(false);
      Alert.alert(
        'Could not save preferences',
        'Your accessibility settings did not save. Check your connection and try again.',
      );
      return;
    }
    // The loading-overlay useEffect (above) handles navigation
    // after the spinner animation completes — don't double-fire here.
  };

  const requiredReady = QUESTIONS.filter((q) => q.required).every((q) => touched[q.key]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 18 }]}>
        <Text style={styles.kicker}>Personalize Your Experience</Text>
        <Text style={styles.title}>Accessibility Survey</Text>
        <Text style={styles.subtitle}>
          Choose what helps you most. Required questions must be answered before you continue.
        </Text>

        <View style={styles.card}>
          {QUESTIONS.map((q) => (
            <View key={q.key} style={styles.row}>
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>
                  {q.title}
                  {q.required && <Text style={styles.requiredPill}> Required</Text>}
                </Text>
                <Text style={styles.rowSubtitle}>{q.subtitle}</Text>
              </View>
              <Switch
                value={!!answers[q.key]}
                onValueChange={(v) => setAnswer(q.key, v)}
                trackColor={{ false: colors.gray300, true: colors.black }}
                thumbColor={answers[q.key] ? '#FFFFFF' : '#FFFFFF'}
              />
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, !requiredReady && styles.primaryBtnDisabled]}
          onPress={handleContinue}
          activeOpacity={0.85}
          testID="accessibility-save"
          disabled={loading || !requiredReady}
        >
          <Text style={styles.primaryBtnText}>Save Preferences</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Loading overlay */}
      {loading && (
        <Animated.View style={[styles.loadingOverlay, { opacity: fadeAnim }]}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <LogoMark size={80} light />
          </Animated.View>
          <Text style={styles.loadingText}>Setting up your experience...</Text>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" style={{ marginTop: 16 }} />
        </Animated.View>
      )}
    </View>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  content: {
    paddingHorizontal: 18,
    gap: 14,
  },
  kicker: {
    ...Typography.captionBold,
    color: colors.gray500,
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
  requiredPill: {
    ...Typography.captionBold,
    color: colors.accent,
    fontSize: 11,
  },
  primaryBtn: {
    marginTop: 8,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    ...Typography.bodySemibold,
    color: isDark ? '#1A1A1A' : '#FFFFFF',
    fontFamily: FontFamily.bold,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#111111',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    fontFamily: FontFamily.medium,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.3,
  },
});
