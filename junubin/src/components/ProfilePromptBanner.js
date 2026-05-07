// AnaJunubin — Profile Prompt Banner (slim CTA variant)
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily } from '../theme';
import { GraffitiShield } from './icons';

export default function ProfilePromptBanner({ message, onPress, colors }) {
  return (
    <TouchableOpacity style={[styles.banner, { backgroundColor: '#F4F4F6', borderColor: '#E8E8EC' }]} onPress={onPress} activeOpacity={0.8}>
      <GraffitiShield size={18} color={colors.accent} filled />
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
