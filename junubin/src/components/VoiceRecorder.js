// AnaJunubin — Voice note recorder
//
// Press and hold to record (or tap the mic, then tap stop). Releases
// produce an .m4a file; cancel discards. Returns the local URI plus
// the recording duration in seconds via `onComplete`. Caller is
// responsible for uploading to Storage and creating the Message row.
//
// expo-av is already installed and used for playback in ChatAudioBubble;
// this component wires the recording side of the same lib so the loop
// closes (record → upload → bubble plays).

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Easing,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { FontFamily, useTheme } from '../theme';
import { hapticLight, hapticMedium } from '../utils/haptics';
import { promptToOpenSettings } from '../utils/permissionAlert';

const MAX_DURATION_SEC = 120; // hard ceiling so a runaway recorder doesn't eat storage

const fmt = (sec) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

export default function VoiceRecorder({ visible, onCancel, onComplete }) {
  const { colors } = useTheme();
  const recordingRef = useRef(null);
  const tickRef = useRef(null);
  const startedAtRef = useRef(0);
  const [seconds, setSeconds] = useState(0);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState(null);
  const pulse = useRef(new Animated.Value(1)).current;

  // Animated pulse on the central mic dot while recording.
  useEffect(() => {
    if (!recording) {
      pulse.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recording, pulse]);

  const cleanup = () => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
  };

  const start = async () => {
    try {
      setError(null);
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        // If the OS has marked this as permanently denied (canAskAgain
        // === false), the user will never see the system prompt again —
        // bounce them to Settings instead of just showing an inline hint.
        if (perm.canAskAgain === false) {
          promptToOpenSettings({
            title: 'Microphone access needed',
            message: 'JuNubin needs microphone access to record voice notes. Enable it in Settings.',
          });
        } else {
          setError('Microphone access is needed to record voice notes.');
        }
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      const r = new Audio.Recording();
      // High-quality preset works across iOS/Android. .m4a on iOS, .m4a on
      // Android too (the preset uses MPEG_4 / AAC across both).
      await r.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await r.startAsync();
      recordingRef.current = r;
      startedAtRef.current = Date.now();
      setSeconds(0);
      setRecording(true);
      hapticLight();
      tickRef.current = setInterval(() => {
        const elapsed = (Date.now() - startedAtRef.current) / 1000;
        setSeconds(elapsed);
        if (elapsed >= MAX_DURATION_SEC) stop();
      }, 200);
    } catch (e) {
      setError(e?.message || 'Could not start recording.');
    }
  };

  const stop = async () => {
    cleanup();
    setRecording(false);
    const r = recordingRef.current;
    recordingRef.current = null;
    if (!r) return;
    try {
      await r.stopAndUnloadAsync();
      // iOS: flip recording mode off so subsequent playback (voice notes,
      // story audio) routes through the speaker, not the earpiece.
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      }).catch(() => {});
      const uri = r.getURI();
      const status = await r.createNewLoadedSoundAsync().catch(() => null);
      const durationMs = status?.status?.durationMillis;
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      const duration = durationMs ? durationMs / 1000 : elapsed;
      hapticMedium();
      onComplete?.({ uri, duration: Math.round(duration) });
    } catch (e) {
      setError(e?.message || 'Could not save recording.');
    }
  };

  const cancel = async () => {
    cleanup();
    setRecording(false);
    const r = recordingRef.current;
    recordingRef.current = null;
    if (r) {
      try { await r.stopAndUnloadAsync(); } catch {}
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      }).catch(() => {});
    }
    onCancel?.();
  };

  // Auto-start when the modal opens so user doesn't need a second tap.
  useEffect(() => {
    if (visible && !recording && !recordingRef.current) {
      start();
    }
    if (!visible) {
      cleanup();
      const r = recordingRef.current;
      recordingRef.current = null;
      if (r) {
        try { r.stopAndUnloadAsync(); } catch {}
        Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        }).catch(() => {});
      }
      setSeconds(0);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel}>
      <Pressable style={styles.overlay} onPress={cancel}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.cardBg }]} onPress={(e) => e.stopPropagation()}>
          <Text style={[styles.title, { color: colors.black }]}>
            {recording ? 'Recording…' : error ? 'Voice note' : 'Getting ready…'}
          </Text>

          <Animated.View
            style={[
              styles.micWrap,
              {
                backgroundColor: recording ? colors.accent : colors.gray300,
                transform: [{ scale: pulse }],
              },
            ]}
          >
            <Ionicons name="mic" size={36} color="#FFFFFF" />
          </Animated.View>

          <Text style={[styles.timer, { color: colors.black }]}>{fmt(seconds)}</Text>
          <Text style={[styles.hint, { color: colors.gray500 }]}>
            {error || `Tap stop to send. Max ${MAX_DURATION_SEC / 60}:00.`}
          </Text>

          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn, { borderColor: colors.separator }]}
              onPress={cancel}
            >
              <Ionicons name="close" size={18} color={colors.black} />
              <Text style={[styles.btnText, { color: colors.black }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.sendBtn, { backgroundColor: colors.accent }]}
              onPress={stop}
              disabled={!recording}
            >
              <Ionicons name="send" size={18} color="#FFFFFF" />
              <Text style={[styles.btnText, { color: '#FFFFFF' }]}>
                {recording ? 'Send' : 'Wait…'}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 38,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    marginBottom: 18,
  },
  micWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  timer: {
    fontSize: 28,
    fontFamily: FontFamily.black,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    marginBottom: 22,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  cancelBtn: {
    borderWidth: 1,
  },
  sendBtn: {},
  btnText: {
    fontSize: 15,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
  },
});
