// AnaJunubin — Profile Completeness Card with circular progress
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { FontFamily } from '../theme';

export default function ProfileCompletenessCard({ score, suggestion, onPress, colors }) {
  const size = 56;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <TouchableOpacity style={[styles.card, { backgroundColor: '#F4F4F6', borderColor: '#E8E8EC' }]} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.ringWrap}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.gray300}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.accent}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <Text style={[styles.ringText, { color: colors.accent }]}>{score}%</Text>
      </View>

      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.black }]}>Complete Your Profile</Text>
        {suggestion && <Text style={[styles.suggestion, { color: colors.gray }]}>{suggestion}</Text>}
      </View>

      <Ionicons name="chevron-forward" size={20} color={colors.accent} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringText: {
    position: 'absolute',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  info: { flex: 1 },
  title: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  suggestion: {
    fontSize: 12,
    marginTop: 2,
  },
});
