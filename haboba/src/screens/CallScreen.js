import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { imageSource } from '../utils/imageSource';
import { useTheme, FontFamily, Colors } from '../theme';
import { SpraySplatter } from '../components/GraffitiAccents';

export default function CallScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const match = route.params?.match || {};
  const callType = route.params?.callType || 'voice';
  const [callState, setCallState] = useState('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const timerRef = useRef(null);

  useEffect(() => {
    const connectTimer = setTimeout(() => setCallState('in_call'), 1800);

    return () => {
      clearTimeout(connectTimer);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (callState !== 'in_call') return;
    timerRef.current = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleEnd = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
      {/* Pulsing ring behind avatar */}
      <View style={styles.avatarWrap}>
        <View style={[styles.pulseRing, styles.pulseRing1, { borderColor: colors.accentTint15 }]} />
        <View style={[styles.pulseRing, styles.pulseRing2, { borderColor: colors.accentTint15 }]} />
        <Image source={imageSource(match.images?.[0])} style={[styles.avatar, { borderColor: colors.accent }]} />
      </View>

      <Text style={styles.name}>{match.name || 'Unknown'}</Text>
      <Text style={styles.status}>
        {callState === 'connecting' ? 'Connecting...' : formatTime(callDuration)}
      </Text>


      {/* Ambient spray accents */}
      <View style={{ position: 'absolute', left: 10, top: 100 }} pointerEvents="none">
        <SpraySplatter size={40} color="#009739" opacity={0.06} />
      </View>
      <View style={{ position: 'absolute', right: 15, bottom: 180 }} pointerEvents="none">
        <SpraySplatter size={45} color="#CE1126" opacity={0.05} />
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlBtn, isMuted && styles.controlActive]}
          onPress={() => setIsMuted(!isMuted)}
        >
          <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={26} color="#FFFFFF" />
          <Text style={styles.controlLabel}>Mute</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.endBtn, { backgroundColor: colors.error, shadowColor: colors.error }]} onPress={handleEnd}>
          <Ionicons name="call" size={30} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, isSpeaker && styles.controlActive]}
          onPress={() => setIsSpeaker(!isSpeaker)}
        >
          <Ionicons name={isSpeaker ? 'volume-high' : 'volume-medium'} size={26} color="#FFFFFF" />
          <Text style={styles.controlLabel}>Speaker</Text>
        </TouchableOpacity>

        {callType === 'video' && (
          <TouchableOpacity
            style={[styles.controlBtn, isVideoEnabled && styles.controlActive]}
            onPress={() => setIsVideoEnabled((prev) => !prev)}
          >
            <Ionicons name={isVideoEnabled ? 'videocam' : 'videocam-off'} size={26} color="#FFFFFF" />
            <Text style={styles.controlLabel}>Video</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
  },
  avatarWrap: {
    marginTop: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: Colors.accentTint15,
  },
  pulseRing1: { width: 160, height: 160 },
  pulseRing2: { width: 200, height: 200 },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: Colors.accent,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    marginTop: 24,
  },
  status: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
    fontFamily: FontFamily.medium,
  },
  controls: {
    position: 'absolute',
    bottom: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 40,
  },
  controlBtn: {
    alignItems: 'center',
    gap: 6,
    padding: 16,
    borderRadius: 30,
  },
  controlActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  controlLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  endBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.error,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
