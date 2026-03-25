// AnaJunubin — Empty State
// Reusable empty state with icon circle, tribal accents, and South Sudanese graffiti flair.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, Typography, FontFamily } from '../theme';
import { GraffitiCorner } from './GraffitiAccents';

export default function EmptyState({ icon, title, subtitle, actionLabel, onAction }) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {/* Graffiti corner accents */}
      <View style={styles.cornerTL}><GraffitiCorner size={20} color={colors.accent} position="topLeft" /></View>
      <View style={styles.cornerBR}><GraffitiCorner size={20} color="#E8613C" position="bottomRight" /></View>

      <View style={[styles.iconCircle, { backgroundColor: colors.accentTint08 }]}>
        <Ionicons name={icon} size={32} color={colors.accent} />
      </View>
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
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    position: 'relative',
  },
  cornerTL: { position: 'absolute', top: 40, left: 24 },
  cornerBR: { position: 'absolute', bottom: 40, right: 24 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    ...Typography.bodySmall,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },
});
