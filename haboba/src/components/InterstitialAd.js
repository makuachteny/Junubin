// AnaJunubin — Interstitial Ad (placeholder for free tier, shown every N swipes)
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily } from '../theme';
import Button from './Button';

export default function InterstitialAd({ visible, onClose, onUpgrade, colors }) {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors?.cardBg || '#FFFFFF' }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={24} color={colors?.gray400 || '#999'} />
          </TouchableOpacity>

          <View style={[styles.adIcon, { backgroundColor: colors?.accentTint10 || 'rgba(232,97,60,0.1)' }]}>
            <Ionicons name="megaphone" size={40} color={colors?.accent || '#E8613C'} />
          </View>

          <Text style={[styles.title, { color: colors?.black }]}>Enjoying JuNubin?</Text>
          <Text style={[styles.desc, { color: colors?.gray }]}>
            Upgrade to JuNubin+ for an ad-free experience with unlimited likes and more!
          </Text>

          <Button title="Upgrade Now" variant="primary" size="lg" fullWidth onPress={onUpgrade} />
          <TouchableOpacity onPress={onClose} style={styles.skipBtn}>
            <Text style={[styles.skipText, { color: colors?.gray400 }]}>Skip Ad</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 24,
    padding: 28,
    width: '100%',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  adIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(232,97,60,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    marginBottom: 8,
  },
  desc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    maxWidth: 280,
  },
  skipBtn: { marginTop: 12, padding: 8 },
  skipText: { fontSize: 14, fontWeight: '500' },
});
