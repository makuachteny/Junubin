// AnaJunubin — Chat Reaction Picker (Long-press popup)
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Modal } from 'react-native';

const REACTIONS = [
  { emoji: '\u2764\uFE0F', label: 'heart' },
  { emoji: '\uD83D\uDD25', label: 'fire' },
  { emoji: '\uD83D\uDE02', label: 'laugh' },
  { emoji: '\uD83D\uDE2E', label: 'wow' },
  { emoji: '\uD83D\uDE22', label: 'sad' },
  { emoji: '\uD83D\uDC4D', label: 'thumbs-up' },
];

export default function ChatReactionPicker({ visible, onSelect, onClose, position, colors }) {
  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={[styles.picker, { top: position?.y ?? 200, left: position?.x ?? 40, backgroundColor: colors?.cardBg || '#FFFFFF' }]}>
          {REACTIONS.map((r) => (
            <TouchableOpacity
              key={r.label}
              style={styles.reactionBtn}
              onPress={() => { onSelect(r); onClose(); }}
            >
              <Text style={styles.emoji}>{r.emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  picker: {
    position: 'absolute',
    flexDirection: 'row',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    gap: 2,
  },
  reactionBtn: {
    padding: 6,
  },
  emoji: {
    fontSize: 24,
  },
});
