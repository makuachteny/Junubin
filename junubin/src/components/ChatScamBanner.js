// ChatScamBanner — surfaces a per-conversation safety warning when
// the detect-scam-signal Edge Function flags romance-scam patterns
// (off-platform redirects, early money asks, gift-card mentions,
// crypto solicitations, love-bombing).
//
// Render at the top of ChatScreen above the message list. The
// component owns its own dismiss state so a user can clear the
// banner once per conversation/session — re-fetching when N more
// incoming messages arrive lets us re-flag if the pattern escalates.
//
// Visual: amber / dark amber pill with a shield icon. Tappable to
// expand the list of flagged signals; long-press goes to safety FAQ.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, FontFamily } from '../theme';

const SEVERITY_COPY = {
  high:   { title: 'Possible scam patterns detected', tone: '#B45309' },
  medium: { title: 'Some patterns to be cautious about', tone: '#D97706' },
  low:    null,
};

const SIGNAL_LABEL = {
  'off-platform-whatsapp': 'WhatsApp move',
  'off-platform-telegram': 'Telegram move',
  'off-platform-email':    'Email handoff',
  'money-gift-card':       'Gift-card request',
  'money-wire':            'Wire-transfer request',
  'money-crypto':          'Crypto mention',
  'love-bombing':          'Love-bombing wording',
  'emergency-cash':        'Urgent-money story',
};

export default function ChatScamBanner({ verdict, onDismiss, onLearnMore }) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  // Only render for medium / high risk — low-risk and stub responses
  // are intentionally silent. If no verdict, render nothing.
  const sev = verdict?.risk;
  const meta = SEVERITY_COPY[sev];
  if (!verdict || !meta) return null;

  const signals = Array.isArray(verdict.signals) ? verdict.signals : [];
  const labels = signals.map((id) => SIGNAL_LABEL[id] || id);
  const styles = getStyles(colors, meta.tone);

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <TouchableOpacity
        style={styles.row}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`${meta.title}. Tap to see details.`}
      >
        <Ionicons name="shield-half" size={18} color="#FFFFFF" />
        <View style={styles.textWrap}>
          <Text style={styles.title} numberOfLines={1}>{meta.title}</Text>
          {labels.length > 0 ? (
            <Text style={styles.sub} numberOfLines={1}>
              {labels.slice(0, 2).join(' · ')}{labels.length > 2 ? ` +${labels.length - 2}` : ''}
            </Text>
          ) : null}
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(255,255,255,0.85)" />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.detail}>
          {verdict.message ? (
            <Text style={styles.message}>{verdict.message}</Text>
          ) : null}
          {labels.length > 0 ? (
            <View style={styles.chips}>
              {labels.map((label) => (
                <View key={label} style={styles.chip}>
                  <Text style={styles.chipText}>{label}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={onLearnMore}
              activeOpacity={0.75}
            >
              <Ionicons name="information-circle-outline" size={14} color="#FFFFFF" />
              <Text style={styles.actionText}>Learn the patterns</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={onDismiss}
              activeOpacity={0.75}
            >
              <Text style={styles.actionText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const getStyles = (colors, tone) =>
  StyleSheet.create({
    wrap: {
      backgroundColor: tone,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(0,0,0,0.15)',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 10,
    },
    textWrap: { flex: 1 },
    title: {
      color: '#FFFFFF',
      fontSize: 13,
      fontFamily: FontFamily.semibold,
    },
    sub: {
      color: 'rgba(255,255,255,0.85)',
      fontSize: 11,
      fontFamily: FontFamily.regular,
      marginTop: 1,
    },
    detail: {
      paddingHorizontal: 14,
      paddingBottom: 12,
      paddingTop: 2,
      gap: 8,
    },
    message: {
      color: 'rgba(255,255,255,0.95)',
      fontSize: 12,
      fontFamily: FontFamily.regular,
      lineHeight: 17,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    chip: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: 'rgba(255,255,255,0.18)',
      borderRadius: 10,
    },
    chipText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontFamily: FontFamily.medium,
    },
    actions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.18)',
    },
    actionText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontFamily: FontFamily.semibold,
    },
  });
