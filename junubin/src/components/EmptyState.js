// JuNubin — Empty State (Industry design language).
// Centered thin-stroke icon, condensed title, muted body, optional
// square action button. Quiet by design — empty states in the mock
// are plain text blocks, not decorated panels.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Typography, FontFamily } from '../theme';

export default function EmptyState({ icon, title, subtitle, actionLabel, onAction }) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {icon ? (
        <Ionicons name={icon} size={34} color={colors.gray400} style={styles.icon} />
      ) : null}
      <Text style={[styles.title, { color: colors.black }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.gray400 }]}>{subtitle}</Text>
      ) : null}

      {actionLabel && onAction ? (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.accent }]}
          onPress={onAction}
          activeOpacity={0.8}
        >
          <Text style={[styles.actionText, { color: colors.cream }]}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 44,
    paddingHorizontal: 32,
  },
  icon: {
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: FontFamily.heading,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    ...Typography.bodySmall,
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 4,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
});
