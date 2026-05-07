// Lightweight in-app snackbar. Pin it at the bottom of any screen, hand it
// a `visible` flag + a message, and it fades in, pauses, and fades back
// out. Used by CommunityScreen to confirm "Posted" after the user
// publishes a post and lands back on the feed.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, FontFamily } from '../theme';

const FADE_IN = 220;
const HOLD = 1800;
const FADE_OUT = 260;

export default function Toast({
  visible,
  message,
  icon = 'checkmark-circle',
  onDismiss,
}) {
  const { colors, isDark } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  const onDismissRef = useRef(onDismiss);

  useEffect(() => { onDismissRef.current = onDismiss; }, [onDismiss]);

  useEffect(() => {
    if (!visible) return undefined;

    let dismissTimeout;
    Animated.timing(anim, {
      toValue: 1,
      duration: FADE_IN,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      dismissTimeout = setTimeout(() => {
        Animated.timing(anim, {
          toValue: 0,
          duration: FADE_OUT,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }).start(() => onDismissRef.current?.());
      }, HOLD);
    });

    return () => {
      if (dismissTimeout) clearTimeout(dismissTimeout);
      anim.stopAnimation();
    };
  }, [visible, anim]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          opacity: anim,
          transform: [{
            translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
          }],
        },
      ]}
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: isDark ? '#FFFFFF' : '#1A1A1A',
            borderColor: isDark ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)',
          },
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={16}
            color={isDark ? '#1A1A1A' : '#FFFFFF'}
            style={styles.icon}
          />
        ) : null}
        <Text
          style={[styles.text, { color: isDark ? '#1A1A1A' : '#FFFFFF' }]}
          numberOfLines={2}
        >
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    maxWidth: '80%',
  },
  icon: { marginRight: 8 },
  text: {
    fontSize: 14,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});
