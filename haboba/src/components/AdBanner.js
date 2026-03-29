// AnaJunubin — Ad Banner (placeholder for free tier)
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily } from '../theme';
import { useSubscription } from '../payments';

export default function AdBanner({ style, colors }) {
  const { isSubscribed, adsEnabled } = useSubscription();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (adsEnabled) setDismissed(false);
  }, [adsEnabled]);

  // Hide ads for subscribed users
  if (isSubscribed() || dismissed || adsEnabled === false) return null;

  return (
    <View style={[styles.banner, { backgroundColor: colors.gray100, borderColor: colors.separator }, style]}>
      {/* SS flag accent stripe */}
      <View style={styles.flagStripe} pointerEvents="none">
        {['#000000', '#CE1126', '#FFFFFF', '#009739', '#0047AB'].map((c, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: c, opacity: 0.35 }} />
        ))}
      </View>
      <View style={styles.content}>
        <View style={[styles.adLabel, { backgroundColor: '#E8E8EC' }]}>
          <Text style={[styles.adLabelText, { color: colors.accent }]}>AD</Text>
        </View>
        <View style={styles.adContent}>
          <Text style={[styles.adTitle, { color: colors.black }]}>Upgrade to JuNubin+</Text>
          <Text style={[styles.adDesc, { color: colors.gray }]}>Remove ads & unlock unlimited likes</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.closeBtn} onPress={() => setDismissed(true)} accessibilityLabel="dismiss-ad">
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
  flagStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    flexDirection: 'row',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
});
