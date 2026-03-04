// AnaJunubin — Chat Audio/Voice Note Bubble
import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

export default function ChatAudioBubble({ uri, duration = 0, isMe, time, colors }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const soundRef = useRef(null);

  const formatDuration = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = async () => {
    try {
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

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded) {
            setProgress(status.positionMillis / (status.durationMillis || 1));
            if (status.didJustFinish) {
              setIsPlaying(false);
              setProgress(0);
              soundRef.current = null;
            }
          }
        }
      );
      soundRef.current = sound;
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const bgColor = isMe ? colors.accent : colors.white;
  const textColor = isMe ? '#FFFFFF' : colors.black;

  return (
    <View style={[styles.container, isMe ? styles.me : styles.them]}>
      <View style={[styles.bubble, { backgroundColor: bgColor, borderColor: isMe ? bgColor : colors.gray200 }]}>
        <TouchableOpacity onPress={handlePlayPause} style={styles.playBtn}>
          <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color={textColor} />
        </TouchableOpacity>

        <View style={styles.waveform}>
          {Array.from({ length: 20 }).map((_, i) => {
            const h = 6 + Math.sin(i * 0.8) * 8 + Math.random() * 4;
            const filled = i / 20 <= progress;
            return (
              <View
                key={i}
                style={[
                  styles.bar,
                  {
                    height: h,
                    backgroundColor: filled ? textColor : (isMe ? 'rgba(255,255,255,0.3)' : colors.gray300),
                  },
                ]}
              />
            );
          })}
        </View>

        <Text style={[styles.duration, { color: isMe ? 'rgba(255,255,255,0.7)' : colors.gray400 }]}>
          {formatDuration(duration)}
        </Text>
      </View>
      <Text style={[styles.time, { color: colors.gray400, textAlign: isMe ? 'right' : 'left' }]}>{time}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { maxWidth: '78%', marginVertical: 3 },
  me: { alignSelf: 'flex-end' },
  them: { alignSelf: 'flex-start' },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 0.5,
    gap: 8,
  },
  playBtn: { padding: 2 },
  waveform: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1.5,
    height: 24,
  },
  bar: {
    width: 2.5,
    borderRadius: 1.5,
  },
  duration: { fontSize: 11, fontWeight: '500', marginLeft: 4 },
  time: { fontSize: 11, marginTop: 3, paddingHorizontal: 4 },
});
