// AnaJunubin — Ad Banner (placeholder for free tier)
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily } from '../theme';
import { useSubscription } from '../payments';

export default function AdBanner({ style, colors }) {
  const { isSubscribed } = useSubscription();

  // Hide ads for subscribed users
  if (isSubscribed()) return null;

  return (
    <View style={[styles.banner, { backgroundColor: colors.gray100, borderColor: colors.separator }, style]}>
      <View style={styles.content}>
        <View style={[styles.adLabel, { backgroundColor: colors.accentTint15 }]}>
          <Text style={[styles.adLabelText, { color: colors.accent }]}>AD</Text>
        </View>
        <View style={styles.adContent}>
          <Text style={[styles.adTitle, { color: colors.black }]}>Upgrade to JuNubin+</Text>
          <Text style={[styles.adDesc, { color: colors.gray }]}>Remove ads & unlock unlimited likes</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.closeBtn}>
        <Ionicons name="close" size={16} color={colors.gray400} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  adLabel: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adLabelText: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    letterSpacing: 0.5,
  },
  adContent: { flex: 1 },
  adTitle: { fontSize: 13, fontWeight: '600', fontFamily: FontFamily.semibold },
  adDesc: { fontSize: 11, marginTop: 1 },
  closeBtn: { padding: 4 },
});
