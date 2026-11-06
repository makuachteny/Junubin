// JuNubin — Brand logo with three placement variants:
//   variant="mark"    →  just the JB monogram (default; use on small chrome,
//                        nav headers, refresh indicators, inline badges).
//   variant="lockup"  →  monogram + "JuNubin" wordmark stacked below
//                        (auth screens, settings, profile headers).
//   variant="full"    →  lockup + tagline beneath ("South Sudanese Community")
//                        (splash, marketing, onboarding hero).

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LogoMark from './LogoMark';
import { useTheme, FontFamily } from '../theme';

const SIZE_PRESETS = {
  small: 44,
  medium: 64,
  large: 108,
  xlarge: 160,
};

export default function BrandLogo({
  size = 'medium',
  variant = 'mark',
  light = false,
  tagline = 'South Sudanese Community',
  color,
}) {
  const { colors, isDark } = useTheme();
  const dim = typeof size === 'number' ? size : (SIZE_PRESETS[size] || SIZE_PRESETS.medium);
  const textColor = color ?? (light ? '#FFFFFF' : isDark ? '#FFFFFF' : (colors.primary || '#1F4A5C'));

  if (variant === 'mark') {
    return <LogoMark size={dim} light={light} color={color} />;
  }

  const showTagline = variant === 'full';
  const wordmarkSize = Math.max(14, Math.round(dim * 0.32));
  const taglineSize = Math.max(9, Math.round(dim * 0.13));
  const gap = Math.round(dim * 0.12);

  return (
    <View style={styles.lockup}>
      <LogoMark size={dim} light={light} color={color} />
      <Text
        style={[
          styles.wordmark,
          {
            color: textColor,
            fontSize: wordmarkSize,
            marginTop: gap,
            letterSpacing: wordmarkSize * 0.06,
            fontFamily: FontFamily?.bold,
          },
        ]}
      >
        JuNubin
      </Text>
      {showTagline ? (
        <Text
          style={[
            styles.tagline,
            {
              color: textColor,
              fontSize: taglineSize,
              marginTop: Math.round(gap * 0.4),
              letterSpacing: taglineSize * 0.28,
              opacity: 0.75,
              fontFamily: FontFamily?.medium,
            },
          ]}
        >
          {tagline.toUpperCase()}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { alignItems: 'center', justifyContent: 'center' },
  wordmark: { textAlign: 'center' },
  tagline: { textAlign: 'center' },
});
