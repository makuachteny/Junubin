import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily } from '../theme';
import { imageSource } from '../utils/imageSource';

const { width: SCREEN_W } = Dimensions.get('window');
const PHOTO_SIZE = 100;

const BURST_VECTORS = [
  { x: 0, y: -40 },
  { x: 30, y: -28 },
  { x: 40, y: 0 },
  { x: 30, y: 28 },
  { x: 0, y: 40 },
  { x: -30, y: 28 },
  { x: -40, y: 0 },
  { x: -30, y: -28 },
];

const MatchCelebrationOverlay = ({
  visible,
  currentUser,
  matchedUser,
  onSendMessage,
  onKeepSwiping,
}) => {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const leftPhoto = useRef(new Animated.Value(-SCREEN_W / 2)).current;
  const rightPhoto = useRef(new Animated.Value(SCREEN_W / 2)).current;
  const titleScale = useRef(new Animated.Value(0)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const burstAnims = useRef(BURST_VECTORS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (visible) {
      // Reset
      overlayOpacity.setValue(0);
      leftPhoto.setValue(-SCREEN_W / 2);
      rightPhoto.setValue(SCREEN_W / 2);
      titleScale.setValue(0);
      buttonsOpacity.setValue(0);
      burstAnims.forEach((a) => a.setValue(0));

      Animated.sequence([
        // Fade in overlay
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        // Slide photos in with spring
        Animated.parallel([
          Animated.spring(leftPhoto, {
            toValue: 0,
            tension: 60,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.spring(rightPhoto, {
            toValue: 0,
            tension: 60,
            friction: 8,
            useNativeDriver: true,
          }),
        ]),
        // Title pop + burst
        Animated.parallel([
          Animated.spring(titleScale, {
            toValue: 1,
            tension: 80,
            friction: 6,
            useNativeDriver: true,
          }),
          ...burstAnims.map((anim, i) =>
            Animated.timing(anim, {
              toValue: 1,
              duration: 800,
              delay: i * 40,
              useNativeDriver: true,
            })
          ),
        ]),
        // Show buttons
        Animated.timing(buttonsOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, overlayOpacity, leftPhoto, rightPhoto, titleScale, buttonsOpacity, burstAnims]);

  if (!visible) return null;

  const currentImg = currentUser?.images?.[0];
  const matchedImg = matchedUser?.images?.[0];

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
      {/* Heart / sparkle burst */}
      <View style={styles.burstContainer}>
        {BURST_VECTORS.map((vec, i) => {
          const anim = burstAnims[i];
          return (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[
                styles.burstParticle,
                {
                  opacity: anim.interpolate({
                    inputRange: [0, 0.15, 1],
                    outputRange: [0, 1, 0],
                  }),
                  transform: [
                    {
                      translateX: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, vec.x],
                      }),
                    },
                    {
                      translateY: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, vec.y],
                      }),
                    },
                    {
                      scale: anim.interpolate({
                        inputRange: [0, 0.5, 1],
                        outputRange: [0.4, 1.2, 0.6],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Ionicons
                name={i % 2 === 0 ? 'heart' : 'sparkles'}
                size={i % 2 === 0 ? 16 : 14}
                color={i % 2 === 0 ? '#FF5252' : '#FFD700'}
              />
            </Animated.View>
          );
        })}
      </View>

      {/* Profile photos */}
      <View style={styles.photosRow}>
        <Animated.View style={[styles.photoWrap, { transform: [{ translateX: leftPhoto }] }]}>
          <View style={styles.photoBorder}>
            {currentImg ? (
              <Image source={imageSource(currentImg)} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <Ionicons name="person" size={40} color="rgba(255,255,255,0.5)" />
              </View>
            )}
          </View>
        </Animated.View>

        <View style={styles.heartBridge}>
          <Ionicons name="heart" size={28} color="#FF5252" />
        </View>

        <Animated.View style={[styles.photoWrap, { transform: [{ translateX: rightPhoto }] }]}>
          <View style={styles.photoBorder}>
            {matchedImg ? (
              <Image source={imageSource(matchedImg)} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <Ionicons name="person" size={40} color="rgba(255,255,255,0.5)" />
              </View>
            )}
          </View>
        </Animated.View>
      </View>

      {/* Title */}
      <Animated.View style={{ transform: [{ scale: titleScale }] }}>
        <Text style={styles.title}>It's a Match!</Text>
        <Text style={styles.subtitle}>
          You and {matchedUser?.name || 'someone'} liked each other
        </Text>
      </Animated.View>

      {/* Buttons */}
      <Animated.View style={[styles.buttonsWrap, { opacity: buttonsOpacity }]}>
        <TouchableOpacity style={styles.primaryBtn} onPress={onSendMessage} activeOpacity={0.85}>
          <Ionicons name="chatbubble" size={18} color="#FFF" style={{ marginRight: 8 }} />
          <Text style={styles.primaryBtnText}>Send a Message</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.ghostBtn} onPress={onKeepSwiping} activeOpacity={0.7}>
          <Text style={styles.ghostBtnText}>Keep Swiping</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  burstContainer: {
    position: 'absolute',
    top: '38%',
    alignSelf: 'center',
    width: 1,
    height: 1,
  },
  burstParticle: {
    position: 'absolute',
  },
  photosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  photoWrap: {
    alignItems: 'center',
  },
  photoBorder: {
    width: PHOTO_SIZE + 6,
    height: PHOTO_SIZE + 6,
    borderRadius: (PHOTO_SIZE + 6) / 2,
    borderWidth: 3,
    borderColor: '#FF5252',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: PHOTO_SIZE / 2,
  },
  photoPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartBridge: {
    marginHorizontal: 16,
    marginBottom: 4,
  },
  title: {
    fontFamily: FontFamily.script,
    fontSize: 36,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 4,
  },
  buttonsWrap: {
    marginTop: 40,
    width: '100%',
    paddingHorizontal: 40,
    gap: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: '#FF5252',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: '#FFFFFF',
  },
  ghostBtn: {
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  ghostBtnText: {
    fontFamily: FontFamily.semibold,
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
});

export default MatchCelebrationOverlay;
