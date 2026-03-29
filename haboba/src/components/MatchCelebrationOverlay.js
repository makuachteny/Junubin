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
import { FontFamily, useTheme } from '../theme';
import { GraffitiHeart, GraffitiSparkles, GraffitiStar, GraffitiFlame, GraffitiCrown, GraffitiShield } from './icons';
import { imageSource } from '../utils/imageSource';
import { hapticHeavy } from '../utils/haptics';
import { SpraySplatter } from './GraffitiAccents';

const { width: SCREEN_W } = Dimensions.get('window');
const PHOTO_SIZE = 100;

// Outer ring (8) + inner ring (8) = 16 particles
const BURST_VECTORS = [
  // Outer ring
  { x: 0, y: -55 },
  { x: 40, y: -40 },
  { x: 55, y: 0 },
  { x: 40, y: 40 },
  { x: 0, y: 55 },
  { x: -40, y: 40 },
  { x: -55, y: 0 },
  { x: -40, y: -40 },
  // Inner ring
  { x: 20, y: -28 },
  { x: 28, y: -10 },
  { x: 28, y: 10 },
  { x: 20, y: 28 },
  { x: -20, y: 28 },
  { x: -28, y: 10 },
  { x: -28, y: -10 },
  { x: -20, y: -28 },
];

const PARTICLE_COMPONENTS = [GraffitiHeart, GraffitiSparkles, GraffitiStar, GraffitiFlame, GraffitiCrown, GraffitiShield];
// South Sudan flag colors: Red, Green, Blue, Gold Star, Black, White
const PARTICLE_COLORS = ['#CE1126', '#009739', '#0047AB', '#FCCD12', '#1A1A1A', '#FFFFFF'];

const MatchCelebrationOverlay = ({
  visible,
  currentUser,
  matchedUser,
  onSendMessage,
  onKeepSwiping,
}) => {
  const { colors } = useTheme();
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const orbitProgress = useRef(new Animated.Value(0)).current;
  const orbitScale = useRef(new Animated.Value(1)).current;
  const orbitOpacity = useRef(new Animated.Value(1)).current;
  const leftPhoto = useRef(new Animated.Value(-SCREEN_W / 2)).current;
  const rightPhoto = useRef(new Animated.Value(SCREEN_W / 2)).current;
  const titleScale = useRef(new Animated.Value(0)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const burstAnims = useRef(BURST_VECTORS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (visible) {
      hapticHeavy();
      // Reset all
      overlayOpacity.setValue(0);
      orbitProgress.setValue(0);
      orbitScale.setValue(1);
      orbitOpacity.setValue(1);
      leftPhoto.setValue(-SCREEN_W / 2);
      rightPhoto.setValue(SCREEN_W / 2);
      titleScale.setValue(0);
      buttonsOpacity.setValue(0);
      burstAnims.forEach((a) => a.setValue(0));

      Animated.sequence([
        // Fade in overlay
        Animated.timing(overlayOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        // Orbit the 3 action icons, shrink to center
        Animated.parallel([
          Animated.timing(orbitProgress, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(orbitScale, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ]),
        // Hide orbit icons
        Animated.timing(orbitOpacity, { toValue: 0, duration: 100, useNativeDriver: true }),
        // Slide photos in + burst
        Animated.parallel([
          Animated.spring(leftPhoto, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
          Animated.spring(rightPhoto, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
        ]),
        // Title pop + burst particles
        Animated.parallel([
          Animated.spring(titleScale, { toValue: 1, tension: 80, friction: 6, useNativeDriver: true }),
          ...burstAnims.map((anim, i) =>
            Animated.timing(anim, { toValue: 1, duration: 1500, delay: i * 50, useNativeDriver: true })
          ),
        ]),
        // Show action buttons
        Animated.timing(buttonsOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, overlayOpacity, orbitProgress, orbitScale, orbitOpacity, leftPhoto, rightPhoto, titleScale, buttonsOpacity, burstAnims]);

  if (!visible) return null;

  const currentImg = currentUser?.images?.[0];
  const matchedImg = matchedUser?.images?.[0];

  return (
    <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
      {/* Orbiting action icons — Pass, Super Like, Like spinning to center */}
      <Animated.View style={[styles.orbitContainer, { opacity: orbitOpacity, transform: [{ scale: orbitScale }] }]}>
        {[
          { icon: 'close', bg: 'rgba(255,255,255,0.15)', color: '#FFFFFF', offset: 0 },
          { icon: 'star', bg: '#FCCD12', color: '#FFFFFF', offset: 1 },
          { icon: 'heart', bg: '#CE1126', color: '#FFFFFF', offset: 2 },
        ].map((btn, i) => {
          const angle = orbitProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [i * (2 * Math.PI / 3), i * (2 * Math.PI / 3) + Math.PI * 3],
          });
          const radius = orbitProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [80, 0],
          });
          return (
            <Animated.View
              key={i}
              style={[styles.orbitIcon, {
                backgroundColor: btn.bg,
                transform: [
                  { translateX: Animated.multiply(radius, Animated.multiply(angle, 0).interpolate({ inputRange: [0, 0], outputRange: [0, 0] })) },
                  { translateX: Animated.multiply(
                    radius,
                    orbitProgress.interpolate({
                      inputRange: [0, 0.25, 0.5, 0.75, 1],
                      outputRange: [
                        Math.cos(i * (2 * Math.PI / 3)),
                        Math.cos(i * (2 * Math.PI / 3) + Math.PI * 0.75),
                        Math.cos(i * (2 * Math.PI / 3) + Math.PI * 1.5),
                        Math.cos(i * (2 * Math.PI / 3) + Math.PI * 2.25),
                        0,
                      ],
                    })
                  )},
                  { translateY: Animated.multiply(
                    radius,
                    orbitProgress.interpolate({
                      inputRange: [0, 0.25, 0.5, 0.75, 1],
                      outputRange: [
                        Math.sin(i * (2 * Math.PI / 3)),
                        Math.sin(i * (2 * Math.PI / 3) + Math.PI * 0.75),
                        Math.sin(i * (2 * Math.PI / 3) + Math.PI * 1.5),
                        Math.sin(i * (2 * Math.PI / 3) + Math.PI * 2.25),
                        0,
                      ],
                    })
                  )},
                ],
              }]}
            >
              <Ionicons name={btn.icon} size={22} color={btn.color} />
            </Animated.View>
          );
        })}
      </Animated.View>

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
              {React.createElement(PARTICLE_COMPONENTS[i % PARTICLE_COMPONENTS.length], {
                size: i < 8 ? 16 : 13,
                color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
                filled: true,
              })}
            </Animated.View>
          );
        })}
      </View>

      {/* Profile photos */}
      <View style={styles.photosRow}>
        <Animated.View style={[styles.photoWrap, { transform: [{ translateX: leftPhoto }] }]}>
          <View style={[styles.photoBorder, { borderColor: colors.accent }]}>
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
          <GraffitiHeart size={28} color={colors.rose} filled />
        </View>

        <Animated.View style={[styles.photoWrap, { transform: [{ translateX: rightPhoto }] }]}>
          <View style={[styles.photoBorder, { borderColor: colors.accent }]}>
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
      <Animated.View style={[styles.titleWrap, { transform: [{ scale: titleScale }] }]}>

        <Text style={styles.title}>It's a Match!</Text>
        <Text style={styles.subtitle}>
          You and {matchedUser?.name || 'someone'} liked each other
        </Text>
        {/* Flag stripe */}
        <View style={styles.flagStripe}>
          <View style={[styles.flagBand, { backgroundColor: '#000000' }]} />
          <View style={[styles.flagBand, { backgroundColor: '#CE1126' }]} />
          <View style={[styles.flagBand, { backgroundColor: '#FFFFFF' }]} />
          <View style={[styles.flagBand, { backgroundColor: '#009739' }]} />
          <View style={[styles.flagBand, { backgroundColor: '#0047AB' }]} />
        </View>
      </Animated.View>

      {/* Spray accents */}
      <View style={styles.splatterLeft} pointerEvents="none">
        <SpraySplatter size={50} color="#009739" opacity={0.1} />
      </View>
      <View style={styles.splatterRight} pointerEvents="none">
        <SpraySplatter size={50} color="#CE1126" opacity={0.08} />
      </View>

      {/* Buttons */}
      <Animated.View style={[styles.buttonsWrap, { opacity: buttonsOpacity }]}>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={onSendMessage} activeOpacity={0.85}>
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
  orbitContainer: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    width: 1,
    height: 1,
    zIndex: 110,
  },
  orbitIcon: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -25,
    marginTop: -25,
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
    borderColor: '#CE1126',
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
  titleWrap: {
    alignItems: 'center',
  },
  title: {
    fontFamily: FontFamily.black,
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
  flagStripe: {
    flexDirection: 'row',
    height: 3,
    width: 100,
    marginTop: 12,
    borderRadius: 2,
    overflow: 'hidden',
    opacity: 0.5,
  },
  flagBand: { flex: 1, height: 3 },
  splatterLeft: { position: 'absolute', left: 20, top: '25%' },
  splatterRight: { position: 'absolute', right: 20, bottom: '25%' },
  buttonsWrap: {
    marginTop: 40,
    width: '100%',
    paddingHorizontal: 40,
    gap: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: '#CE1126',
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

export default React.memo(MatchCelebrationOverlay);
