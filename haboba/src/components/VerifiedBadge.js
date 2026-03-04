// AnaJunubin — Verified Badge
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const STATUS_CONFIG = {
  verified: { icon: 'checkmark-circle', color: '#22C55E', label: 'Verified' },
  pending: { icon: 'time', color: '#F59E0B', label: 'Pending' },
  unverified: { icon: 'shield-outline', color: '#9CA3AF', label: 'Unverified' },
};

export default function VerifiedBadge({ status = 'unverified', size = 'sm', showLabel = false }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.unverified;
  const iconSize = size === 'lg' ? 20 : size === 'md' ? 16 : 14;

  return (
    <View style={styles.container}>
      <Ionicons name={config.icon} size={iconSize} color={config.color} />
      {showLabel && <Text style={[styles.label, { color: config.color, fontSize: size === 'lg' ? 13 : 11 }]}>{config.label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { fontWeight: '600' },
});
