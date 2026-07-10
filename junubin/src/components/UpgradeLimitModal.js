// UpgradeLimitModal — fires after the user spends their last daily
// like (or attempts one more past the cap). Tier-aware: free users
// see both paid tiers as upgrade options, plus users see only Junub.
// Junub users never see this modal — their tier is uncapped.
//
// Co-located visual language with SurveyNudgeModal so the deck's two
// in-flow prompts (survey gate, paywall gate) feel like one system
// rather than two unrelated alerts.

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
import { DAILY_LIKE_LIMIT_BY_TIER } from '../payments/entitlements';

// Tier → upgrade copy. Each entry describes what the user gets by
// moving up: the next-tier label, the next-tier daily ceiling, and a
// short pitch line. Junub is the ceiling — its entry only exists for
// completeness; the modal short-circuits before rendering it.
const UPGRADES_BY_TIER = {
  free: [
    {
      tier: 'plus',
      label: 'JuNubin+',
      headline: '50 likes a day',
      pitch: 'More likes, advanced filters, see who liked you.',
      icon: 'flash',
    },
    {
      tier: 'junub',
      label: 'Junub',
      headline: 'Unlimited likes',
      pitch: 'Never run out. Incognito, priority discovery, the works.',
      icon: 'diamond',
    },
  ],
  plus: [
    {
      tier: 'junub',
      label: 'Junub',
      headline: 'Unlimited likes',
      pitch: 'No daily cap. Plus everything in JuNubin+.',
      icon: 'diamond',
    },
  ],
  junub: [],
};

export default function UpgradeLimitModal({
  visible,
  tier = 'free',
  used,
  onCancel,
  onChoose,
}) {
  const { colors, isDark } = useTheme();
  const styles = makeStyles(colors, isDark);

  const upgrades = UPGRADES_BY_TIER[tier] || UPGRADES_BY_TIER.free;
  const limit = DAILY_LIKE_LIMIT_BY_TIER[tier] ?? DAILY_LIKE_LIMIT_BY_TIER.free;
  const usedDisplay = Number.isFinite(used) ? used : limit;

  // Junub users (or any unknown tier mapped to an empty upgrade set)
  // shouldn't see this modal — render nothing so the Modal mount is
  // a no-op rather than a blank sheet.
  if (upgrades.length === 0) return null;

  const titleCopy = tier === 'free'
    ? "You're out of likes for today"
    : "You've hit today's like cap";
  const subtitleCopy = tier === 'free'
    ? `Free accounts get ${limit} likes a day. You used ${usedDisplay}.`
    : `JuNubin+ gets you ${limit} a day. You used ${usedDisplay}. Move up to keep swiping.`;

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
            <Ionicons name="heart" size={20} color={colors.accent} />
          </View>

          <Text style={styles.title}>{titleCopy}</Text>
          <Text style={styles.body}>{subtitleCopy}</Text>

          {upgrades.map((u, idx) => (
            <TouchableOpacity
              key={u.tier}
              style={[styles.tierBtn, idx === 0 ? styles.tierBtnPrimary : styles.tierBtnSecondary]}
              activeOpacity={0.85}
              onPress={() => onChoose?.(u.tier)}
              accessibilityRole="button"
              accessibilityLabel={`Upgrade to ${u.label} — ${u.headline}`}
            >
              <View style={styles.tierIcon}>
                <Ionicons
                  name={u.icon}
                  size={18}
                  color={idx === 0 ? '#000' : colors.accent}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.tierLabel, idx === 0 && styles.tierLabelPrimary]}>
                  {u.label} — {u.headline}
                </Text>
                <Text style={[styles.tierPitch, idx === 0 && styles.tierPitchPrimary]}>
                  {u.pitch}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={idx === 0 ? '#000' : colors.gray500}
              />
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.dismissBtn}
            activeOpacity={0.7}
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Maybe later"
          >
            <Text style={styles.dismissBtnText}>Maybe later</Text>
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
      maxWidth: 340,
      backgroundColor: colors.cardBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.cardBorder,
      borderRadius: 18,
      padding: 18,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.5 : 0.2,
      shadowRadius: 18,
      elevation: 10,
    },
    iconWrap: {
      alignSelf: 'center',
      width: 40, height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(255,90,108,0.18)' : 'rgba(255,90,108,0.14)',
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 10,
    },
    title: {
      fontSize: 17,
      fontFamily: FontFamily.bold,
      color: colors.primary,
      textAlign: 'center',
      marginBottom: 6,
    },
    body: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.primary,
      opacity: 0.78,
      textAlign: 'center',
      marginBottom: 14,
    },
    tierBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    // Primary CTA: warm yellow, dark text — matches the SurveyNudgeModal
    // accent so the two in-flow prompts share a visual language.
    tierBtnPrimary: {
      backgroundColor: '#FCCD12',
    },
    tierBtnSecondary: {
      backgroundColor: 'transparent',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.cardBorder,
    },
    tierIcon: {
      width: 30, height: 30,
      borderRadius: 15,
      backgroundColor: isDark ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.06)',
      alignItems: 'center', justifyContent: 'center',
    },
    tierLabel: {
      fontSize: 13,
      fontFamily: FontFamily.semibold,
      color: colors.primary,
    },
    tierLabelPrimary: {
      color: '#000',
    },
    tierPitch: {
      fontSize: 11,
      lineHeight: 15,
      color: colors.primary,
      opacity: 0.7,
      marginTop: 1,
    },
    tierPitchPrimary: {
      color: '#000',
      opacity: 0.8,
    },
    dismissBtn: {
      paddingVertical: 10,
      alignItems: 'center',
      marginTop: 2,
    },
    dismissBtnText: {
      color: colors.primary,
      opacity: 0.65,
      fontSize: 12,
      fontFamily: FontFamily.medium,
    },
  });
}
