// AnaJunubin — Action Buttons
// Individual floating circles matching BLK reference
// smiley · rewind · crown · heart(orange) · send

import React, { useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useTheme, getShadow } from '../theme';

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

const ActionButtons = ({ onRewind, onPass, onLike, onSuperLike, onMessage }) => {
  const { colors, isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const burstAnims = useRef(BURST_VECTORS.map(() => new Animated.Value(0))).current;

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

  const handleSuperLikePress = () => {
    burstAnims.forEach((anim) => anim.setValue(0));
    Animated.parallel(
      burstAnims.map((anim, index) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 900,
          delay: index * 30,
          useNativeDriver: true,
        })
      )
    ).start();
    onSuperLike?.();
  };

  return (
    <View style={styles.row}>
      {/* Smiley / Pass */}
      <TouchableOpacity style={[styles.btn, styles.btnRegular]} onPress={onPass} activeOpacity={0.7}>
        <MaterialCommunityIcons name="emoticon-happy-outline" size={28} color={colors.gray600} />
      </TouchableOpacity>

      {/* Rewind */}
      <TouchableOpacity style={[styles.btn, styles.btnRegular]} onPress={onRewind} activeOpacity={0.7}>
        <MaterialCommunityIcons name="undo" size={28} color={colors.gray600} />
      </TouchableOpacity>

      {/* Sparkles / Super Like */}
      <View style={styles.superLikeWrap}>
        {BURST_VECTORS.map((vector, index) => {
          const anim = burstAnims[index];
          return (
            <Animated.View
              key={`spark-${index}`}
              pointerEvents="none"
              style={[
                styles.burstSpark,
                {
                  opacity: anim.interpolate({
                    inputRange: [0, 0.15, 1],
                    outputRange: [0, 1, 0],
                  }),
                  transform: [
                    {
                      translateX: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, vector.x],
                      }),
                    },
                    {
                      translateY: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, vector.y],
                      }),
                    },
                    {
                      scale: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.6, 1.15],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Ionicons name="sparkles" size={12} color={colors.accent} />
            </Animated.View>
          );
        })}
        <TouchableOpacity style={[styles.btn, styles.btnRegular]} onPress={handleSuperLikePress} activeOpacity={0.7}>
          <Ionicons name="sparkles" size={26} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {/* LIKE — orange filled circle */}
      <Animated.View style={[styles.likeBtnOuter, { transform: [{ scale: pulseAnim }] }]}>
        <TouchableOpacity style={styles.likeBtn} onPress={onLike} activeOpacity={0.8}>
          <Ionicons name="heart" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>

      {/* Message / Send */}
      <TouchableOpacity style={[styles.btn, styles.btnRegular]} onPress={onMessage} activeOpacity={0.7}>
        <Ionicons name="paper-plane" size={24} color={colors.gray600} />
      </TouchableOpacity>
    </View>
  );
};

const getStyles = (colors, isDark) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 12,
  },
  btn: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 999,
  },
  btnRegular: {
    width: 54,
    height: 54,
    backgroundColor: isDark ? 'rgba(26, 26, 26, 0.95)' : 'rgba(255, 255, 255, 0.95)',
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
});

export default ActionButtons;
