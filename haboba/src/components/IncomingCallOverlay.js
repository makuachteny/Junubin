// AnaJunubin — Incoming Call Overlay
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { imageSource } from '../utils/imageSource';
import { FontFamily, useTheme } from '../theme';

export default function IncomingCallOverlay({ visible, caller, onAccept, onDecline }) {
  const { colors } = useTheme();
  if (!visible || !caller) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.card, { borderColor: colors.greenTint25 }]}>
          <Image source={imageSource(caller.images?.[0])} style={[styles.avatar, { borderColor: colors.accent }]} />
          <Text style={styles.name}>{caller.name}</Text>
          <Text style={styles.label}>Incoming Call</Text>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.declineBtn, { backgroundColor: colors.error }]} onPress={onDecline}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.acceptBtn, { backgroundColor: colors.success }]} onPress={onAccept}>
              <Ionicons name="call" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#000000',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '80%',
    borderWidth: 1,
    borderColor: 'rgba(168,13,30,0.2)',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#CE1126',
    marginBottom: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },
  label: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
    marginBottom: 32,
  },
  actions: {
    flexDirection: 'row',
    gap: 40,
  },
  declineBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#CE1126',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#CE1126',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
