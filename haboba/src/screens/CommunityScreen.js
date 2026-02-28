// DEPRECATED — Community is now a mode in HomeScreen (via ModeToggle).
// This standalone screen is no longer used in navigation.
// Kept for reference only. Safe to delete when cleaning up.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontFamily } from '../theme';

export default function CommunityScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Community has moved to the home screen.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontFamily: FontFamily.medium, fontSize: 16, color: '#8A7D70' },
});
