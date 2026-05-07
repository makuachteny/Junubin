// JuNubin — Profile Completeness Card
// Animated circular progress ring + tier-based color + status copy.
// Tap to jump straight to the next missing field in EditProfile.
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { FontFamily } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function ProfileCompletenessCard({
  score = 0,
  filledCount,
  totalCount,
  suggestion,
  tier,
  onPress,
  colors,
  style,
}) {
  const size = 60;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: Math.max(0, Math.min(score, 100)) / 100,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [score, progress]);

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  // Tier-based ring color — red for low, gold for mid, green for done.
  const tierColor = tier?.color === 'green' ? colors.green
    : tier?.color === 'gold' ? colors.gold
    : colors.rose;

  const tierLabel = tier?.label || 'Complete Your Profile';
  const showCount = filledCount != null && totalCount != null;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.cardBg,
          borderColor: colors.separator,
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Profile ${score} percent complete. Tap to ${suggestion || 'continue'}.`}
    >
      {/* Ring */}
      <View style={styles.ringWrap}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.gray200}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={tierColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View style={styles.ringTextWrap}>
          <Text style={[styles.ringText, { color: tierColor }]}>{score}</Text>
          <Text style={[styles.ringPct, { color: tierColor }]}>%</Text>
        </View>
      </View>

      {/* Copy */}
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.black }]}>{tierLabel}</Text>
          {showCount && (
            <View style={[styles.countPill, { backgroundColor: colors.surfaceMuted, borderColor: colors.separator }]}>
              <Text style={[styles.countText, { color: colors.gray500 }]}>
                {filledCount}/{totalCount}
              </Text>
            </View>
          )}
        </View>
        {suggestion && (
          <Text style={[styles.suggestion, { color: colors.gray500 }]} numberOfLines={2}>
            {suggestion}
          </Text>
        )}
      </View>

      <View style={[styles.chevWrap, { backgroundColor: colors.surfaceMuted }]}>
        <Ionicons name="chevron-forward" size={18} color={colors.black} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  ringWrap: {
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringTextWrap: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  ringText: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    letterSpacing: -0.3,
  },
  ringPct: {
    fontSize: 9,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    marginLeft: 1,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    letterSpacing: -0.1,
  },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  countText: {
    fontSize: 11,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
  },
  suggestion: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
  chevWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
