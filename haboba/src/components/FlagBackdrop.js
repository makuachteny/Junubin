import React from 'react';
import { View, StyleSheet } from 'react-native';

export default function FlagBackdrop({ dimOverlay = 0.28 }) {
  return (
    <View style={styles.root} pointerEvents="none">
      <View style={styles.base} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
  },
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
});
