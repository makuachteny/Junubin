// VoicePromptRecorder — 30-second voice-prompt recorder for profiles.
//
// Two phases:
//   1. record — tap-and-hold (or tap-to-toggle) the mic. Counts down
//      from 30s; auto-stops at zero. Live audio level shown as a bar.
//   2. preview — playback, accept, or re-record. On accept the caller
//      receives { uri, durationSec, question } and is responsible for
//      uploading to the `voice-prompts` storage bucket + writing the
//      Profile fields.
//
// Permission flow uses the smart ensurePermission helper — never
// double-prompts on iOS-permanent-deny; routes to Settings instead.
//
// Visual style follows the chat VoiceRecorder so the affordance is
// already familiar. Yellow ring + waveform pulse.

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useTheme, FontFamily } from '../theme';
import { ensurePermission } from '../utils/permissionAlert';

const MAX_DURATION_SEC = 30;

const QUESTIONS = [
  'Hello in my own voice',
  'A favourite memory from home',
  'How I take my Sudanese tea',
  'My ideal Saturday in one sentence',
  'Something most people get wrong about me',
  'Pronounce my name and tell me your nickname',
];

export default function VoicePromptRecorder({ existingUrl, existingQuestion, onAccept, onCancel }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const [phase, setPhase] = useState(existingUrl ? 'preview' : 'pick-question');
  const [selectedQuestion, setSelectedQuestion] = useState(existingQuestion || QUESTIONS[0]);
  const [recording, setRecording] = useState(null);
  const [recordedUri, setRecordedUri] = useState(existingUrl || null);
  const [durationSec, setDurationSec] = useState(0);
  const [playback, setPlayback] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [level, setLevel] = useState(0);
  const timerRef = useRef(null);
  const levelAnim = useRef(new Animated.Value(0)).current;

  // Clean up any in-flight recording / playback when the modal closes.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recording) {
        recording.stopAndUnloadAsync().catch(() => {});
      }
      if (playback) {
        playback.unloadAsync().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live level bar animation. Smooths between successive meter
  // readings so the bar doesn't flash.
  useEffect(() => {
    Animated.timing(levelAnim, {
      toValue: level,
      duration: 80,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [level, levelAnim]);

  const startRecording = async () => {
    const status = await ensurePermission({
      checker: Audio.getPermissionsAsync,
      requester: Audio.requestPermissionsAsync,
      deniedTitle: 'Microphone access needed',
      deniedMessage: 'Enable mic access to record a voice prompt for your profile.',
    });
    if (status !== 'granted') return;

    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          // status.metering is dBFS — -160 (silent) to 0 (clip).
          if (typeof status?.metering === 'number') {
            const m = Math.max(0, Math.min(1, (status.metering + 60) / 60));
            setLevel(m);
          }
        },
        100, // update interval ms
      );
      setRecording(rec);
      setPhase('record');
      setDurationSec(0);
      timerRef.current = setInterval(() => {
        setDurationSec((s) => {
          const next = s + 1;
          if (next >= MAX_DURATION_SEC) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch {
      // Permission granted but recording init failed — likely the
      // mic is held by another app (incoming call, voice memos).
      // Silently bail; user can retry.
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordedUri(uri);
      setRecording(null);
      setPhase('preview');
    } catch {
      setRecording(null);
      setPhase('pick-question');
    }
  };

  const togglePlayback = async () => {
    if (!recordedUri) return;
    if (isPlaying && playback) {
      await playback.pauseAsync();
      setIsPlaying(false);
      return;
    }
    if (playback) {
      await playback.playAsync();
      setIsPlaying(true);
      return;
    }
    const { sound } = await Audio.Sound.createAsync(
      { uri: recordedUri },
      { shouldPlay: true },
      (status) => {
        if (status.didJustFinish) {
          setIsPlaying(false);
        }
      },
    );
    setPlayback(sound);
    setIsPlaying(true);
  };

  const acceptAndUpload = () => {
    if (!recordedUri) return;
    onAccept?.({
      uri: recordedUri,
      durationSec,
      question: selectedQuestion,
    });
  };

  const startOver = () => {
    if (playback) {
      playback.unloadAsync().catch(() => {});
      setPlayback(null);
    }
    setRecordedUri(null);
    setDurationSec(0);
    setIsPlaying(false);
    setPhase('pick-question');
  };

  if (phase === 'pick-question') {
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Pick a voice-prompt question</Text>
        <Text style={styles.sub}>30 seconds. Your accent and energy come through more than 10 photos can.</Text>
        <View style={styles.questions}>
          {QUESTIONS.map((q) => (
            <TouchableOpacity
              key={q}
              style={[styles.qBtn, selectedQuestion === q && styles.qBtnActive]}
              onPress={() => setSelectedQuestion(q)}
              activeOpacity={0.8}
            >
              <Text style={[styles.qText, selectedQuestion === q && styles.qTextActive]}>{q}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.row}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onCancel}>
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={startRecording}>
            <Ionicons name="mic" size={18} color="#000" />
            <Text style={styles.primaryBtnText}>Record</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (phase === 'record') {
    const left = MAX_DURATION_SEC - durationSec;
    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Recording…</Text>
        <Text style={styles.sub}>{selectedQuestion}</Text>
        <View style={styles.meterTrack}>
          <Animated.View
            style={[
              styles.meterFill,
              {
                width: levelAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['4%', '100%'],
                }),
              },
            ]}
          />
        </View>
        <Text style={styles.timer}>{left}s left</Text>
        <TouchableOpacity style={styles.stopBtn} onPress={stopRecording}>
          <Ionicons name="stop" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  }

  // preview
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Preview</Text>
      <Text style={styles.sub}>{selectedQuestion}</Text>
      <TouchableOpacity style={styles.playBtn} onPress={togglePlayback}>
        <Ionicons name={isPlaying ? 'pause' : 'play'} size={28} color="#000" />
      </TouchableOpacity>
      <Text style={styles.timer}>{durationSec || '—'}s</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={startOver}>
          <Text style={styles.secondaryBtnText}>Re-record</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={acceptAndUpload}>
          <Ionicons name="checkmark" size={18} color="#000" />
          <Text style={styles.primaryBtnText}>Use this</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const getStyles = (colors) =>
  StyleSheet.create({
    wrap: {
      padding: 20,
      backgroundColor: colors.cardBg,
      borderRadius: 16,
      alignItems: 'stretch',
      gap: 10,
    },
    title: {
      fontSize: 18,
      fontFamily: FontFamily.bold,
      color: colors.primary,
      textAlign: 'center',
    },
    sub: {
      fontSize: 13,
      fontFamily: FontFamily.regular,
      color: colors.gray500,
      textAlign: 'center',
    },
    questions: { gap: 8, marginVertical: 10 },
    qBtn: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: 'transparent',
    },
    qBtnActive: {
      backgroundColor: 'rgba(252,205,18,0.12)',
      borderColor: '#FCCD12',
    },
    qText: {
      fontSize: 13,
      color: colors.primary,
      fontFamily: FontFamily.medium,
    },
    qTextActive: {
      fontFamily: FontFamily.semibold,
    },
    row: { flexDirection: 'row', gap: 10, marginTop: 8 },
    primaryBtn: {
      flex: 1,
      flexDirection: 'row',
      gap: 6,
      backgroundColor: '#FCCD12',
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: {
      color: '#000',
      fontFamily: FontFamily.semibold,
      fontSize: 14,
    },
    secondaryBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    secondaryBtnText: { color: colors.primary, fontFamily: FontFamily.semibold, fontSize: 14 },
    meterTrack: {
      height: 8,
      backgroundColor: colors.gray200,
      borderRadius: 4,
      overflow: 'hidden',
      marginTop: 16,
    },
    meterFill: { height: '100%', backgroundColor: '#FCCD12' },
    timer: {
      textAlign: 'center',
      marginTop: 8,
      fontSize: 14,
      fontFamily: FontFamily.semibold,
      color: colors.primary,
    },
    stopBtn: {
      alignSelf: 'center',
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: '#E53935',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
    },
    playBtn: {
      alignSelf: 'center',
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: '#FCCD12',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
    },
  });
