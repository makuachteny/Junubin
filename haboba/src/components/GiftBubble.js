// AnaJunubin — Gift Chat Bubble (gold gradient style)
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function GiftBubble({ gift, isMe, time, colors }) {
  return (
    <View style={[styles.container, isMe ? styles.me : styles.them]}>
      <LinearGradient
        colors={['#FFD700', '#FFA000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}
      >
        <Text style={styles.emoji}>{gift.emoji}</Text>
        <Text style={styles.giftName}>{gift.name}</Text>
        <Text style={styles.sentText}>{isMe ? 'Sent a gift!' : 'Received a gift!'}</Text>
      </LinearGradient>
      <Text style={[styles.time, { color: colors.gray400, textAlign: isMe ? 'right' : 'left' }]}>{time}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { maxWidth: '65%', marginVertical: 3 },
  me: { alignSelf: 'flex-end' },
  them: { alignSelf: 'flex-start' },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 4,
  },
  myBubble: { borderBottomRightRadius: 4 },
  theirBubble: { borderBottomLeftRadius: 4 },
  emoji: { fontSize: 40 },
  giftName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  sentText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  time: { fontSize: 11, marginTop: 3, paddingHorizontal: 4 },
});
