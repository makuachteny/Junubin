// AnaJunubin — Voice Recorder Component (hold to record, slide to cancel)
import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

export default function VoiceRecorder({ onRecordComplete, colors }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingRef = useRef(null);
  const timerRef = useRef(null);
  const slideX = useRef(new Animated.Value(0)).current;

  const startRecording = useCallback(async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch {
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(async (cancelled = false) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setRecordingDuration(0);
    slideX.setValue(0);

    if (!recordingRef.current) return;

    try {
      await recordingRef.current.stopAndUnloadAsync();
      if (!cancelled) {
        const uri = recordingRef.current.getURI();
        const status = await recordingRef.current.getStatusAsync();
        const duration = Math.floor((status.durationMillis || 0) / 1000);
        onRecordComplete?.({ uri, duration });
      }
    } catch {}
    recordingRef.current = null;
  }, [onRecordComplete, slideX]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => startRecording(),
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          slideX.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const cancelled = gestureState.dx < -80;
        stopRecording(cancelled);
      },
    })
  ).current;

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!isRecording) {
    return (
      <View {...panResponder.panHandlers} style={styles.micWrap}>
        <Ionicons name="mic" size={24} color={colors.accent} />
      </View>
    );
  }

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[styles.recordingBar, { backgroundColor: colors.cream, transform: [{ translateX: slideX }] }]}
    >
      <View style={[styles.recordingDot, { backgroundColor: colors.error }]} />
      <Text style={[styles.recordingTime, { color: colors.black }]}>{formatTime(recordingDuration)}</Text>
      <Text style={[styles.slideHint, { color: colors.gray400 }]}>Slide to cancel</Text>
      <Ionicons name="chevron-back" size={16} color={colors.gray400} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  micWrap: { padding: 8, marginBottom: 2 },
  recordingBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#CE1126',
  },
  recordingTime: {
    fontSize: 15,
    fontWeight: '600',
  },
  slideHint: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
  },
});
