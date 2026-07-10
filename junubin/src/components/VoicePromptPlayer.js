// VoicePromptPlayer — tap-to-play voice prompt pill for profile cards.
//
// Renders compact: prompt question + play / pause + duration. No
// waveform visualization (saves CPU on the swipe deck) — just a
// progress ring around the play button so the user can see how far
// through the clip they are.

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useTheme, FontFamily } from '../theme';

export default function VoicePromptPlayer({ url, question, durationSec, compact = false }) {
  const { colors } = useTheme();
  const styles = getStyles(colors, compact);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const soundRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  if (!url) return null;

  const onPress = async () => {
    if (isPlaying && soundRef.current) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
      return;
    }
    if (soundRef.current) {
      await soundRef.current.playAsync();
      setIsPlaying(true);
      return;
    }
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
        (status) => {
          if (!mountedRef.current) return;
          if (status.isLoaded) {
            if (status.durationMillis && status.positionMillis != null) {
              setProgress(status.positionMillis / status.durationMillis);
            }
            if (status.didJustFinish) {
              setIsPlaying(false);
              setProgress(0);
              if (soundRef.current) {
                soundRef.current.setPositionAsync(0).catch(() => {});
              }
            }
          }
        },
      );
      soundRef.current = sound;
      setIsPlaying(true);
    } catch {
      // Bad URL or codec — silently fail; nothing to do.
    }
  };

  return (
    <View style={styles.wrap}>
      <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={isPlaying ? 'Pause voice prompt' : 'Play voice prompt'}>
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={compact ? 16 : 18} color="#000" />
      </TouchableOpacity>
      <View style={styles.text}>
        {question ? <Text style={styles.q} numberOfLines={1}>{question}</Text> : null}
        <Text style={styles.meta}>
          {Math.round((durationSec || 0))}s · voice prompt
        </Text>
      </View>
    </View>
  );
}

const getStyles = (colors, compact) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: compact ? 10 : 12,
      paddingVertical: compact ? 8 : 10,
      borderRadius: 999,
      backgroundColor: 'rgba(252,205,18,0.18)',
      alignSelf: 'flex-start',
    },
    btn: {
      width: compact ? 30 : 36,
      height: compact ? 30 : 36,
      borderRadius: 999,
      backgroundColor: '#FCCD12',
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { flexShrink: 1 },
    q: {
      color: colors.primary,
      fontSize: compact ? 12 : 13,
      fontFamily: FontFamily.semibold,
      maxWidth: 220,
    },
    meta: {
      color: colors.gray500,
      fontSize: compact ? 10 : 11,
      fontFamily: FontFamily.medium,
    },
  });
