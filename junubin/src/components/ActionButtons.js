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

      {/* Pass — solid white circle, dark thin X. Matches the Socialize
          mock the team signed off on (and the parallel Dating-mode
          mock): the X is rendered at 26px / 60% black so it reads
          cleanly on the white fill at any screen brightness. The
          previous 40% black was too faint on the OLED preview. */}
      <TouchableOpacity
        style={[styles.btn, styles.passBtn]}
        onPress={() => { hapticLight(); onPass?.(); }}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Pass"
      >
        <Ionicons name="close" size={26} color="rgba(0,0,0,0.6)" />
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

      {/* Like (Dating) / Say hi (Social) */}
      <TouchableOpacity
        style={[styles.btn, mode === 'Social' ? styles.connectBtn : styles.likeBtn]}
        onPress={() => { hapticLight(); onLike?.(); }}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={mode === 'Social' ? 'Say hi' : 'Like'}
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

// Sizes preserved at the original 42 / 54 / 62 — design review only
// asked for clearer backgrounds, not bigger buttons. Background
// colors are the only change: small flank buttons now render a
// medium-gray fill (was very-transparent black / white that
// disappeared into either dark or light photos depending on the
// shot). White and gold/orange center buttons unchanged.
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
    // Dark-translucent — lets the photo bleed through so the
    // button reads as "clear" rather than a solid panel painted
    // over the card. Color sequence:
    //   rgba(255,255,255,0.18) — vanished on dark photos
    //   #888888 (solid)        — read as too white / solid
    //   rgba(0,0,0,0.4) (now)  — matches the screenshot's clear
    //                            translucent look on both dark
    //                            and light photos.
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  smallBtnDisabled: {
    opacity: 0.35,
  },
  passBtn: {
    width: 54,
    height: 54,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  superLikeWrap: {
    width: 62,
    height: 62,
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
