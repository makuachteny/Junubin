// AnaJunubin — Action Buttons (5-button row)
// Rewind · Pass · Super Like · Like · Whisper
// Small flanking buttons, prominent center trio.

import React, { useRef, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { hapticLight } from '../utils/haptics';
import { GraffitiStar, GraffitiHeart } from './icons';

const BURST_VECTORS = [
  { x: 0, y: -20 },
  { x: 16, y: -12 },
  { x: 20, y: 0 },
  { x: 14, y: 14 },
  { x: 0, y: 20 },
  { x: -14, y: 14 },
  { x: -20, y: 0 },
  { x: -16, y: -12 },
];

const ActionButtons = ({ onPass, onLike, onSuperLike, onRewind, onMessage, hasRewind = false, mode = 'Dating' }) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const burstAnims = useRef(BURST_VECTORS.map(() => new Animated.Value(0))).current;

  const handleSuperLikePress = useCallback(() => {
    hapticLight();
    burstAnims.forEach((a) => a.setValue(0));
    Animated.parallel(
      burstAnims.map((a, i) =>
        Animated.timing(a, { toValue: 1, duration: 800, delay: i * 25, useNativeDriver: true })
      )
    ).start();
    onSuperLike?.();
  }, [burstAnims, onSuperLike]);

  return (
    <View style={styles.container}>
      {/* Rewind — small left flank */}
      <TouchableOpacity
        style={[styles.smallBtn, !hasRewind && styles.smallBtnDisabled]}
        onPress={() => { hapticLight(); onRewind?.(); }}
        activeOpacity={hasRewind ? 0.75 : 1}
        disabled={!hasRewind}
        accessibilityRole="button"
        accessibilityLabel="Undo last swipe"
      >
        <Ionicons name="arrow-undo" size={18} color={hasRewind ? '#F0A030' : 'rgba(255,255,255,0.35)'} />
      </TouchableOpacity>

      {/* Pass */}
      <TouchableOpacity
        style={[styles.btn, styles.passBtn]}
        onPress={() => { hapticLight(); onPass?.(); }}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Pass"
      >
        <Ionicons name="close" size={26} color="rgba(0,0,0,0.4)" />
      </TouchableOpacity>

      {/* Super Like */}
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
                  { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.1] }) },
                ],
              }]}
            >
              <GraffitiStar size={8} color="#FCCD12" filled />
            </Animated.View>
          );
        })}
        <TouchableOpacity
          style={[styles.btn, styles.superLikeBtn]}
          onPress={handleSuperLikePress}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel="Super like"
        >
          <GraffitiStar size={23} color="#FFFFFF" filled />
        </TouchableOpacity>
      </View>

      {/* Like / Connect */}
      <TouchableOpacity
        style={[styles.btn, mode === 'Social' ? styles.connectBtn : styles.likeBtn]}
        onPress={() => { hapticLight(); onLike?.(); }}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={mode === 'Social' ? 'Follow' : 'Like'}
      >
        {mode === 'Social' ? (
          <Ionicons name="hand-left" size={23} color="#FFFFFF" />
        ) : (
          <GraffitiHeart size={23} color="#FFFFFF" filled />
        )}
      </TouchableOpacity>

      {/* Whisper/Message — small right flank */}
      <TouchableOpacity
        style={styles.smallBtn}
        onPress={() => { hapticLight(); onMessage?.(); }}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Send a message"
      >
        <Ionicons name="chatbubble" size={17} color="#9B59B6" />
      </TouchableOpacity>
    </View>
  );
};

const getStyles = (colors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 13,
    paddingBottom: 0,
  },
  btn: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 999,
  },
  smallBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  smallBtnDisabled: {
    opacity: 0.35,
  },
  passBtn: {
    width: 54,
    height: 54,
    backgroundColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  superLikeWrap: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  superLikeBtn: {
    width: 62,
    height: 62,
    backgroundColor: colors.gold,
    shadowColor: '#D4A800',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  burstSpark: {
    position: 'absolute',
    zIndex: 3,
  },
  likeBtn: {
    width: 54,
    height: 54,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  connectBtn: {
    width: 54,
    height: 54,
    backgroundColor: '#F0A030',
    shadowColor: '#F0A030',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
});

export default React.memo(ActionButtons);
