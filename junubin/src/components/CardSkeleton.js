// AnaJunubin — Card Skeleton
// Loading placeholder matching ProfileCard layout.

import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import SkeletonShimmer from './SkeletonShimmer';
import { ms, useTheme } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W - 16;

export default function CardSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.black }]}>
      {/* Full-bleed background shimmer */}
      <SkeletonShimmer
        width={CARD_W}
        height="100%"
        borderRadius={ms(24)}
        style={StyleSheet.absoluteFill}
      />
      {/* Info overlay placeholders */}
      <View style={styles.info}>
        <SkeletonShimmer width={80} height={12} borderRadius={6} />
        <SkeletonShimmer width={180} height={28} borderRadius={10} style={{ marginTop: 8 }} />
        <SkeletonShimmer width={120} height={22} borderRadius={12} style={{ marginTop: 10 }} />
        <View style={styles.pills}>
          <SkeletonShimmer width={70} height={20} borderRadius={10} />
          <SkeletonShimmer width={90} height={20} borderRadius={10} />
          <SkeletonShimmer width={60} height={20} borderRadius={10} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: ms(24),
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  info: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 80,
  },
  pills: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
});
