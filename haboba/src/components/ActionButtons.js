// AnaJunubin — Action Buttons
// smiley(toggle reactions) · rewind · crown · heart(orange) · send
// Tapping the smiley toggles affection emojis that slide out,
// replacing the other action buttons.

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Text,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, getShadow } from '../theme';
import { hapticLight } from '../utils/haptics';
import { GraffitiSmiley, GraffitiUndo, GraffitiSparkles, GraffitiHeart, GraffitiSend } from './icons';

const BURST_VECTORS = [
  { x: 0, y: -22 },
  { x: 18, y: -14 },
  { x: 22, y: 0 },
  { x: 16, y: 16 },
  { x: 0, y: 22 },
  { x: -16, y: 16 },
  { x: -22, y: 0 },
  { x: -18, y: -14 },
];

const REACTION_EMOJIS = [
  { emoji: '\u{1F60D}', label: 'heart eyes' },
  { emoji: '\u{1F970}', label: 'loving' },
  { emoji: '\u{1F618}', label: 'kiss' },
  { emoji: '\u{1F525}', label: 'fire' },
  { emoji: '\u{1F48B}', label: 'lips' },
  { emoji: '\u{1F495}', label: 'hearts' },
];

const ActionButtons = ({ onRewind, onPass, onLike, onSuperLike, onMessage, onReaction }) => {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const burstAnims = useRef(BURST_VECTORS.map(() => new Animated.Value(0))).current;

  const [reactionsOpen, setReactionsOpen] = useState(false);
  const openAnim = useRef(new Animated.Value(0)).current;
  const emojiAnims = useRef(REACTION_EMOJIS.map(() => new Animated.Value(0))).current;

  // Pulse for like button
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Animate open/close when state changes
  useEffect(() => {
    if (reactionsOpen) {
      Animated.parallel([
        Animated.spring(openAnim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 9 }),
        Animated.stagger(50,
          emojiAnims.map((a) =>
            Animated.spring(a, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 })
          )
        ),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(openAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        ...emojiAnims.map((a) =>
          Animated.timing(a, { toValue: 0, duration: 150, useNativeDriver: true })
        ),
      ]).start();
    }
  }, [reactionsOpen, openAnim, emojiAnims]);

  const toggleReactions = useCallback(() => {
    hapticLight();
    setReactionsOpen((prev) => !prev);
  }, []);

  const handleReaction = useCallback((emoji) => {
    hapticLight();
    onReaction?.(emoji);
    setReactionsOpen(false);
  }, [onReaction]);

  const handleSuperLikePress = () => {
    hapticLight();
    burstAnims.forEach((a) => a.setValue(0));
    Animated.parallel(
      burstAnims.map((a, i) =>
        Animated.timing(a, { toValue: 1, duration: 900, delay: i * 30, useNativeDriver: true })
      )
    ).start();
    onSuperLike?.();
  };

  // Main buttons fade out, emojis fade in
  const mainOpacity = openAnim.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0], extrapolate: 'clamp' });
  const emojiOpacity = openAnim.interpolate({ inputRange: [0, 0.4], outputRange: [0, 1], extrapolate: 'clamp' });

  return (
    <View style={styles.container}>
      {/* Smiley toggle — always visible at left */}
      <TouchableOpacity
        style={[styles.btn, styles.btnRegular]}
        onPress={toggleReactions}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={reactionsOpen ? 'Close reactions' : 'Open reactions'}
      >
        {reactionsOpen ? (
          <MaterialCommunityIcons name="close" size={28} color={colors.accent} />
        ) : (
          <GraffitiSmiley size={28} color={colors.gray600} />
        )}
      </TouchableOpacity>

      {/* Content area — emojis and main buttons overlap here */}
      <View style={styles.contentArea}>
        {/* Main action buttons */}
        <Animated.View
          style={[styles.mainRow, { opacity: mainOpacity }]}
          pointerEvents={reactionsOpen ? 'none' : 'auto'}
        >
          <TouchableOpacity style={[styles.btn, styles.btnRegular]} onPress={() => { hapticLight(); onRewind?.(); }} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Rewind">
            <GraffitiUndo size={28} color={colors.gray600} />
          </TouchableOpacity>

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
                  <GraffitiSparkles size={12} color={colors.accent} filled />
                </Animated.View>
              );
            })}
            <TouchableOpacity style={[styles.btn, styles.btnRegular]} onPress={handleSuperLikePress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Super like">
              <GraffitiSparkles size={26} color={colors.accent} filled />
            </TouchableOpacity>
          </View>

          <Animated.View style={[styles.likeBtnOuter, { transform: [{ scale: pulseAnim }] }]}>
            <TouchableOpacity style={styles.likeBtn} onPress={() => { hapticLight(); onLike?.(); }} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Like">
              <GraffitiHeart size={28} color="#FFFFFF" filled />
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity style={[styles.btn, styles.btnRegular]} onPress={() => { hapticLight(); onMessage?.(); }} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Send message">
            <GraffitiSend size={24} color={colors.gray600} />
          </TouchableOpacity>
        </Animated.View>

        {/* Emoji reaction row — overlaps same space */}
        <Animated.View
          style={[styles.emojiRow, { opacity: emojiOpacity }]}
          pointerEvents={reactionsOpen ? 'auto' : 'none'}
        >
          {REACTION_EMOJIS.map((item, index) => {
            const ea = emojiAnims[index];
            return (
              <Animated.View
                key={item.label}
                style={{
                  opacity: ea,
                  transform: [
                    { translateX: ea.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) },
                    { scale: ea.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 1.1, 1] }) },
                  ],
                }}
              >
                <TouchableOpacity
                  onPress={() => handleReaction(item.emoji)}
                  activeOpacity={0.6}
                  style={styles.emojiBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`React with ${item.label}`}
                >
                  <Text style={styles.emojiText}>{item.emoji}</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </Animated.View>
      </View>
    </View>
  );
};

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
  },
  contentArea: {
    flex: 1,
    height: 64,
    justifyContent: 'center',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emojiRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  btn: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 999,
  },
  btnRegular: {
    width: 54,
    height: 54,
    backgroundColor: isDark ? 'rgba(0, 0, 0, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    ...getShadow('md', isDark),
  },
  superLikeWrap: {
    width: 54,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  burstSpark: {
    position: 'absolute',
    zIndex: 3,
  },
  likeBtnOuter: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  likeBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    ...getShadow('lg', isDark, colors.accent),
  },
  emojiBtn: {
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  emojiText: {
    fontSize: 28,
  },
});

export default React.memo(ActionButtons);
