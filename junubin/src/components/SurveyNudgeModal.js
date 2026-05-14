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

const FROM_COPY = {
  swipe_like:        "Liking works best when your profile tells people what you're looking for.",
  super_like:        "Super-likes land harder when there's a profile to land on. One quick step and you're set.",
  like_with_whisper: "Whispers are read alongside your profile — let's give the other person something to read first.",
  open_match:        "Opening matches takes about a minute of profile setup. Pick up where you left off any time.",
  call_match:        "Calls are open to people we've matched. Finish your profile so the matches start coming in.",
  video_call_match:  "Video calls are open to people we've matched. Finish your profile so the matches start coming in.",
  spotlight_self:    "Spotlight only helps if your profile is filled in — otherwise we're putting an empty card at the top of the deck.",
  default:           "Liking and matching work best when we know what you're looking for. It takes about a minute.",
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
            <Ionicons name="sparkles" size={28} color="#FCCD12" />
          </View>

          <Text style={styles.title}>Tell us a little more</Text>

          <Text style={styles.body}>{message}</Text>

          <Text style={styles.note}>
            You can still follow people and say hi without finishing this.
          </Text>

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
      maxWidth: 380,
      backgroundColor: colors.cardBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.cardBorder,
      borderRadius: 20,
      padding: 22,
      alignItems: 'stretch',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: isDark ? 0.6 : 0.2,
      shadowRadius: 24,
      elevation: 12,
    },
    iconWrap: {
      alignSelf: 'center',
      width: 56, height: 56,
      borderRadius: 28,
      backgroundColor: isDark ? 'rgba(252,205,18,0.16)' : 'rgba(252,205,18,0.18)',
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 14,
    },
    title: {
      fontSize: 20,
      fontFamily: FontFamily.bold,
      color: colors.primary,
      textAlign: 'center',
      marginBottom: 8,
    },
    body: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.primary,
      opacity: 0.9,
      textAlign: 'center',
      marginBottom: 12,
    },
    note: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.gray500,
      textAlign: 'center',
      marginBottom: 20,
    },
    primaryBtn: {
      backgroundColor: '#FCCD12',
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 8,
    },
    primaryBtnText: {
      color: '#000',
      fontSize: 15,
      fontFamily: FontFamily.semibold,
    },
    secondaryBtn: {
      paddingVertical: 12,
      alignItems: 'center',
    },
    secondaryBtnText: {
      color: colors.primary,
      opacity: 0.7,
      fontSize: 14,
      fontFamily: FontFamily.medium,
    },
  });
}
