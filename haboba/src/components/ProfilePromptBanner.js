// AnaJunubin — Profile Prompt Banner (slim CTA variant)
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily } from '../theme';

export default function ProfilePromptBanner({ message, onPress, colors }) {
  return (
    <TouchableOpacity style={[styles.banner, { backgroundColor: colors.accentTint08, borderColor: colors.accentTint15 }]} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name="bulb" size={18} color={colors.accent} />
      <Text style={[styles.text, { color: colors.black }]}>{message}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.accent} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    fontFamily: FontFamily.medium,
  },
});
