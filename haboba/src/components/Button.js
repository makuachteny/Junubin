// AnaJunubin — Professional Button Component
// Animated press, consistent sizing, variant system

import React, { useRef, useCallback } from 'react';
import {
  Animated,
  Pressable,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useTheme, FontFamily, fontForWeight } from '../theme';

const SIZES = {
  sm: { height: 40, px: 18, fontSize: 13, fontWeight: '600', tracking: 0.3 },
  md: { height: 48, px: 24, fontSize: 15, fontWeight: '600', tracking: 0.3 },
  lg: { height: 56, px: 32, fontSize: 16, fontWeight: '700', tracking: 0.4 },
};

function getVariant(variant, colors, isDark) {
  switch (variant) {
    case 'primary':
      return {
        container: {
          backgroundColor: colors.accent,
          shadowColor: colors.accent,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
          elevation: 8,
        },
        textColor: '#FFFFFF',
      };
    case 'dark':
      return {
        container: {
          backgroundColor: '#1A1612',
          shadowColor: '#1A1612',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 6,
        },
        textColor: '#FFFFFF',
      };
    case 'outline':
      return {
        container: {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: colors.accent,
        },
        textColor: colors.accent,
      };
    case 'secondary':
      return {
        container: {
          backgroundColor: isDark
            ? 'rgba(255, 82, 82, 0.15)'
            : 'rgba(255, 82, 82, 0.08)',
        },
        textColor: colors.accent,
      };
    case 'ghost':
      return {
        container: {},
        textColor: colors.gray500,
      };
    case 'glass':
      return {
        container: {
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.12)',
        },
        textColor: '#FFFFFF',
      };
    default:
      return { container: {}, textColor: colors.black };
  }
}

export default function Button({
  title,
  subtitle,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  textStyle,
}) {
  const { colors, isDark } = useTheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const s = SIZES[size];
  const radius = s.height / 2;
  const v = getVariant(variant, colors, isDark);

  const handlePressIn = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 0.965,
        useNativeDriver: true,
        friction: 8,
        tension: 100,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0.85,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const handlePressOut = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 5,
        tension: 40,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={disabled || loading ? undefined : onPress}
      disabled={disabled || loading}
    >
      <Animated.View
        style={[
          styles.base,
          {
            paddingHorizontal: s.px,
            borderRadius: radius,
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
          subtitle ? { minHeight: s.height, paddingVertical: 12 } : { height: s.height },
          fullWidth && styles.fullWidth,
          v.container,
          disabled && styles.disabled,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={v.textColor} size="small" />
        ) : (
          <>
            {icon && <View style={styles.iconLeft}>{icon}</View>}
            <View style={subtitle ? styles.textColumn : undefined}>
              <Text
                style={[
                  {
                    fontSize: s.fontSize,
                    fontFamily: fontForWeight(s.fontWeight),
                    fontWeight: s.fontWeight,
                    letterSpacing: s.tracking,
                    color: v.textColor,
                    textAlign: 'center',
                  },
                  textStyle,
                ]}
              >
                {title}
              </Text>
              {subtitle && (
                <Text style={[styles.subtitle, { color: v.textColor }]}>
                  {subtitle}
                </Text>
              )}
            </View>
            {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.4,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    marginTop: 2,
    opacity: 0.8,
    textAlign: 'center',
  },
  textColumn: {
    alignItems: 'center',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});
