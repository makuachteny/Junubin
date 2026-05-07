// AnaJunubin — Chat Image Bubble
import React, { useState } from 'react';
import { View, Image, TouchableOpacity, Modal, StyleSheet, Dimensions, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { imageSource } from '../utils/imageSource';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function ChatImageBubble({ uri, isMe, time, colors }) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      <TouchableOpacity
        onPress={() => setFullscreen(true)}
        style={[styles.container, isMe ? styles.me : styles.them]}
        activeOpacity={0.85}
      >
        <Image source={imageSource(uri)} style={styles.image} resizeMode="cover" />
        <Text style={[styles.time, { color: isMe ? 'rgba(255,255,255,0.7)' : colors.gray400 }]}>{time}</Text>
      </TouchableOpacity>

      <Modal visible={fullscreen} transparent animationType="fade">
        <View style={styles.modalBg}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setFullscreen(false)}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <Image source={imageSource(uri)} style={styles.fullImage} resizeMode="contain" />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    maxWidth: '70%',
    borderRadius: 16,
    overflow: 'hidden',
    marginVertical: 3,
  },
  me: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  them: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  image: {
    width: 200,
    height: 200,
    borderRadius: 14,
  },
  time: {
    fontSize: 11,
    marginTop: 3,
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullImage: {
    width: SCREEN_W,
    height: SCREEN_H * 0.7,
  },
});
