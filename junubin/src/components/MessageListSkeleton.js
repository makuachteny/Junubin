// AnaJunubin — Message List Skeleton
// Loading placeholder matching conversation row layout.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import SkeletonShimmer from './SkeletonShimmer';

const ROW_COUNT = 6;

function SkeletonRow() {
  return (
    <View style={styles.row}>
      <SkeletonShimmer width={56} height={56} borderRadius={28} />
      <View style={styles.lines}>
        <SkeletonShimmer width={120} height={14} borderRadius={7} />
        <SkeletonShimmer width={180} height={12} borderRadius={6} style={{ marginTop: 8 }} />
      </View>
    </View>
  );
}

export default function MessageListSkeleton() {
  return (
    <View style={styles.container}>
      {Array.from({ length: ROW_COUNT }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  lines: {
    flex: 1,
  },
});
