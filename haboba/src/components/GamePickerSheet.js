// AnaJunubin — Game Picker Bottom Sheet (follows GiftPicker pattern)
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GAME_CATALOG } from '../data/games';
import { FontFamily } from '../theme';

export default function GamePickerSheet({ visible, onSelect, onClose, colors }) {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={[styles.sheet, { backgroundColor: colors?.cardBg || colors?.white || '#FFFFFF' }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors?.black }]}>Play a Game</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={colors?.gray400} />
            </TouchableOpacity>
          </View>

          <View style={styles.grid}>
            {GAME_CATALOG.map((game) => (
              <TouchableOpacity
                key={game.type}
                style={styles.gameCard}
                onPress={() => onSelect(game)}
                activeOpacity={0.75}
              >
                <View style={[styles.accentStrip, { backgroundColor: game.color }]} />
                <Text style={styles.gameEmoji}>{game.emoji}</Text>
                <Text style={[styles.gameName, { color: colors?.black }]}>{game.name}</Text>
                <Text style={[styles.gameTagline, { color: colors?.gray400 }]}>{game.tagline}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  gameCard: {
    width: '47%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.03)',
    gap: 6,
    overflow: 'hidden',
  },
  accentStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  gameEmoji: { fontSize: 36, marginTop: 4 },
  gameName: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  gameTagline: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: FontFamily.medium,
    textAlign: 'center',
  },
});
