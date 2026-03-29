// AnaJunubin — Action Buttons (3-button arc)
// Pass (X) · Super Like (gold star, elevated) · Like (green heart)
// Clean arc layout — visually distinct from BLK's 5-button row.

import React, { useRef, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, getShadow } from '../theme';
import { hapticLight } from '../utils/haptics';
import { GraffitiStar, GraffitiHeart } from './icons';

const BURST_VECTORS = [
  { x: 0, y: -24 },
  { x: 20, y: -16 },
  { x: 24, y: 0 },
  { x: 18, y: 18 },
  { x: 0, y: 24 },
  { x: -18, y: 18 },
  { x: -24, y: 0 },
  { x: -20, y: -16 },
];

const ActionButtons = ({ onPass, onLike, onSuperLike, onRewind, onMessage, onReaction }) => {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const burstAnims = useRef(BURST_VECTORS.map(() => new Animated.Value(0))).current;

  const handleSuperLikePress = useCallback(() => {
    hapticLight();
    burstAnims.forEach((a) => a.setValue(0));
    Animated.parallel(
      burstAnims.map((a, i) =>
        Animated.timing(a, { toValue: 1, duration: 900, delay: i * 30, useNativeDriver: true })
      )
    ).start();
    onSuperLike?.();
  }, [burstAnims, onSuperLike]);

  return (
    <View style={styles.container}>
      {/* Pass — left */}
      <TouchableOpacity
        style={[styles.btn, styles.passBtn]}
        onPress={() => { hapticLight(); onPass?.(); }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Pass"
      >
        <Ionicons name="close" size={30} color={colors.gray500} />
      </TouchableOpacity>

      {/* Super Like — center, elevated */}
      <View style={styles.superLikeWrap}>
        {BURST_VECTORS.map((vector, i) => {
          const a = burstAnims[i];
          return (
            <Animated.View
              key={`spark-${i}`}
              pointerEvents="none"
              style={[styles.burstSpark, {
                opacity: a.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
                transform: [
                  { translateX: a.interpolate({ inputRange: [0, 1], outputRange: [0, vector.x] }) },
                  { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, vector.y] }) },
                  { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.15] }) },
                ],
              }]}
            >
              <GraffitiStar size={10} color="#FCCD12" filled />
            </Animated.View>
          );
        })}
        <TouchableOpacity
          style={[styles.btn, styles.superLikeBtn]}
          onPress={handleSuperLikePress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Super like"
        >
          <GraffitiStar size={28} color="#FFFFFF" filled />
        </TouchableOpacity>
      </View>

      {/* Like — right, green heart */}
      <TouchableOpacity
        style={[styles.btn, styles.likeBtn]}
        onPress={() => { hapticLight(); onLike?.(); }}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Like"
      >
        <GraffitiHeart size={28} color="#FFFFFF" filled />
      </TouchableOpacity>
    </View>
  );
};

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 24,
  },
  btn: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 999,
  },
  // Pass — smaller, muted
  passBtn: {
    width: 56,
    height: 56,
    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    marginBottom: 0,
    ...getShadow('md', isDark),
  },
  // Super Like — elevated center, gold
  superLikeWrap: {
    width: 68,
    height: 68,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  superLikeBtn: {
    width: 68,
    height: 68,
    backgroundColor: '#FCCD12',
    ...getShadow('lg', isDark, '#FCCD12'),
  },
  burstSpark: {
    position: 'absolute',
    zIndex: 3,
  },
  // Like — red heart
  likeBtn: {
    width: 56,
    height: 56,
    backgroundColor: '#CE1126',
    marginBottom: 0,
    ...getShadow('lg', isDark, '#CE1126'),
  },
});

export default React.memo(ActionButtons);
