// ChatScamBanner — surfaces a per-conversation safety warning when
// the detect-scam-signal Edge Function flags a known pressure pattern.
//
// The patterns we see in a diaspora community platform are broader
// than romance scams: money requests dressed up as family emergencies,
// fake fundraisers and "charity" collections, people impersonating a
// relative / community leader / organisation, "I'm stranded, send
// transport money" stories, and pushes to move the conversation
// off-platform where nothing can be reported. Copy below covers all of
// those without assuming the two people are dating.
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
  high: {
    title: 'This looks like a known scam pattern',
    body: 'Never send money, airtime or gift cards to someone you have not met, no matter who they say they are. Anyone who is genuinely who they claim to be will not mind waiting while you verify.',
    tone: '#B45309',
  },
  medium: {
    title: 'A few things here worth double-checking',
    body: 'Take your time. Verify who you are talking to through someone you already trust before sending money or personal details, and keep the conversation on JuNubin so it can be reported.',
    tone: '#D97706',
  },
  low: null,
};

const SIGNAL_LABEL = {
  // Moving the conversation somewhere unreportable
  'off-platform-whatsapp': 'Wants to move to WhatsApp',
  'off-platform-telegram': 'Wants to move to Telegram',
  'off-platform-email':    'Wants to move to email',
  // Money
  'money-gift-card':       'Asked for gift cards',
  'money-wire':            'Asked for a wire transfer',
  'money-crypto':          'Asked for crypto',
  'money-airtime':         'Asked for airtime or mobile money',
  'money-request':         'Asked you for money',
  'emergency-cash':        'Urgent money story',
  'stranded-story':        '"I\'m stranded" story',
  'medical-emergency':     'Family emergency story',
  // Fundraising / charity
  'fake-charity':          'Unverified charity ask',
  'fundraiser-pressure':   'Pressure to donate',
  // Identity
  'impersonation':         'May be impersonating someone',
  'identity-mismatch':     'Story does not add up',
  'credential-request':    'Asked for account details',
  // Tone
  'love-bombing':          'Moving very fast',
  'urgency-pressure':      'Rushing you to decide',
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
          {/* Server-supplied message wins when present — it can be
              specific to what was actually said. Otherwise fall back to
              the generic community-safety guidance for this severity so
              the expanded state is never just a bare chip list. */}
          <Text style={styles.message}>{verdict.message || meta.body}</Text>
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
              <Text style={styles.actionText}>How to stay safe</Text>
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
