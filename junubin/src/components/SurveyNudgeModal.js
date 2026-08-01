// SurveyNudgeModal — friendly prompt shown when a user tries a dating
// action (like, super-like, whisper, etc.) before completing the
// survey. The CTA navigates to ProfileSetup at the next-incomplete step
// so users land exactly where they left off.
//
// Used everywhere: HomeScreen swipe deck, ProfileDetailScreen, ChatScreen
// call buttons, deep links, push-notification taps. Single component =
// consistent copy and behavior across all entry points.

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, FontFamily } from '../theme';

// Keys are eligibility action ids. The dating-era ids (swipe_like,
// super_like, like_with_whisper, call_match, …) are gone along with the
// features; anything unmapped falls through to `default`.
const FROM_COPY = {
  follow:          "Following works both ways — people are far more likely to follow back when there's a profile to look at.",
  message_request: "Message requests get accepted when the other person can see who you are. One quick step and you're set.",
  send_message:    "Add a little about yourself first, so the person on the other end knows who they're talking to.",
  directory:       "Fill in your city, background and languages so the right people can find you in the directory.",
  appear_on_map:   "Before you appear to anyone, finish your profile — an empty pin doesn't help anybody find their people.",
  default:         "Finding your people works best when they can see who you are. It takes about a minute.",
};

export default function SurveyNudgeModal({
  visible,
  from = 'default',
  onCancel,
  onContinue,
}) {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors, isDark);

  const message = FROM_COPY[from] || FROM_COPY.default;

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="sparkles" size={20} color={colors.accent} />
          </View>

          <Text style={styles.title}>Tell us a little more</Text>

          <Text style={styles.body}>{message}</Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.85}
            onPress={onContinue}
            accessibilityRole="button"
            accessibilityLabel="Continue my profile"
          >
            <Text style={styles.primaryBtnText}>Continue my profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.7}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Not now"
          >
            <Text style={styles.secondaryBtnText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors, isDark) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      width: '100%',
      maxWidth: 300,
      backgroundColor: colors.cardBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.cardBorder,
      borderRadius: 16,
      padding: 16,
      alignItems: 'stretch',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.5 : 0.18,
      shadowRadius: 18,
      elevation: 10,
    },
    iconWrap: {
      alignSelf: 'center',
      width: 36, height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? 'rgba(252,205,18,0.16)' : 'rgba(252,205,18,0.18)',
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 8,
    },
    title: {
      fontSize: 16,
      fontFamily: FontFamily.bold,
      color: colors.primary,
      textAlign: 'center',
      marginBottom: 6,
    },
    body: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.primary,
      opacity: 0.85,
      textAlign: 'center',
      marginBottom: 14,
    },
    primaryBtn: {
      backgroundColor: colors.accent,
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: 'center',
      marginBottom: 4,
    },
    primaryBtnText: {
      color: '#000',
      fontSize: 13,
      fontFamily: FontFamily.semibold,
    },
    secondaryBtn: {
      paddingVertical: 8,
      alignItems: 'center',
    },
    secondaryBtnText: {
      color: colors.primary,
      opacity: 0.7,
      fontSize: 12,
      fontFamily: FontFamily.medium,
    },
  });
}
