// AnaJunubin — Gift Picker Bottom Sheet
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GIFTS } from '../data/gifts';
import { FontFamily } from '../theme';

export default function GiftPicker({ visible, onSelect, onClose, coins = 0, colors }) {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={[styles.sheet, { backgroundColor: colors?.cardBg || '#FFFFFF' }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors?.black }]}>Send a Gift</Text>
            <View style={styles.coinBalance}>
              <Text style={styles.coinEmoji}>{'\uD83E\uDE99'}</Text>
              <Text style={[styles.coinText, { color: colors?.accent }]}>{coins}</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.giftsRow}>
            {GIFTS.map((gift) => {
              const canAfford = coins >= gift.coins;
              return (
                <TouchableOpacity
                  key={gift.id}
                  style={[styles.giftCard, !canAfford && styles.giftDisabled]}
                  onPress={() => canAfford && onSelect(gift)}
                  activeOpacity={canAfford ? 0.7 : 1}
                >
                  <Text style={styles.giftEmoji}>{gift.emoji}</Text>
                  <Text style={[styles.giftName, { color: colors?.black }]}>{gift.name}</Text>
                  <View style={[styles.priceTag, { backgroundColor: gift.color + '20' }]}>
                    <Text style={[styles.priceText, { color: gift.color }]}>{gift.coins}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.15)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  coinBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  coinEmoji: { fontSize: 18 },
  coinText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  giftsRow: {
    paddingHorizontal: 16,
    gap: 12,
  },
  giftCard: {
    width: 90,
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.03)',
    gap: 6,
  },
  giftDisabled: { opacity: 0.4 },
  giftEmoji: { fontSize: 36 },
  giftName: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  priceTag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  priceText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
});
