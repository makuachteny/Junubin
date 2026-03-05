// AnaJunubin — Profile Card
// Full-bleed image with gradient overlay, BLK-style layout.
// Uses react-native-reanimated + gesture-handler for native-thread swiping.

import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, ms, hp } from '../theme';
import { imageSource } from '../utils/imageSource';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  interpolateColor,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { hapticLight, hapticMedium } from '../utils/haptics';
import { getEthnicIdentity } from '../utils/ethnicIdentity';
import { SpraySplatter } from '../components/GraffitiAccents';

const { width: screenWidth } = Dimensions.get('window');

const SWIPE_DISTANCE_THRESHOLD = 100;
const SWIPE_VELOCITY_THRESHOLD = 500;
const EXIT_X = screenWidth * 1.5;

const SNAP_BACK_SPRING = {
  damping: 18,
  stiffness: 200,
  mass: 0.8,
  overshootClamping: false,
  restDisplacementThreshold: 0.5,
  restSpeedThreshold: 0.5,
};

// Carries the finger's velocity into exit — no speed discontinuity
const EXIT_SPRING = {
  damping: 50,
  stiffness: 400,
  mass: 0.8,
  overshootClamping: true,
  restDisplacementThreshold: 50,
  restSpeedThreshold: 50,
};

const ProfileCard = forwardRef(({ profile, onSwipe, onExpand, onSwipeProgress, onDoubleTap, style }, ref) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const thresholdCrossed = useSharedValue(0); // 0 = not crossed, 1 = crossed
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState({});

  useEffect(() => {
    translateX.value = 0;
    translateY.value = 0;
    thresholdCrossed.value = 0;
    setCurrentImageIndex(0);
    setImageErrors({});
  }, [profile?.id, translateX, translateY, thresholdCrossed]);

  const imageUrl = profile.images?.[currentImageIndex];
  const totalImages = profile.images?.length || 1;
  const hasImageError = imageErrors[currentImageIndex];

  const completeSwipe = useCallback((direction) => {
    hapticMedium();
    onSwipe && onSwipe(direction);
    if (onSwipeProgress) {
      runOnJS(onSwipeProgress)(1);
    }
  }, [onSwipe, onSwipeProgress]);

  const SWIPE_PROGRESS_DISTANCE = screenWidth * 0.6;

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-20, 20])
    .onUpdate((e) => {
      'worklet';
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.25;
      // Haptic feedback when crossing threshold
      const absX = Math.abs(e.translationX);
      if (absX > SWIPE_DISTANCE_THRESHOLD && thresholdCrossed.value === 0) {
        thresholdCrossed.value = 1;
        runOnJS(hapticLight)();
      } else if (absX < SWIPE_DISTANCE_THRESHOLD && thresholdCrossed.value === 1) {
        thresholdCrossed.value = 0;
      }
      const progress = Math.min(absX / SWIPE_PROGRESS_DISTANCE, 1);
      if (onSwipeProgress) {
        runOnJS(onSwipeProgress)(progress);
      }
    })
    .onEnd((e) => {
      'worklet';
      const distanceMet = Math.abs(e.translationX) > SWIPE_DISTANCE_THRESHOLD;
      const velocityMet = Math.abs(e.velocityX) > SWIPE_VELOCITY_THRESHOLD;

      if (distanceMet || velocityMet) {
        const direction = e.translationX > 0
          ? (e.velocityX < -SWIPE_VELOCITY_THRESHOLD ? 'left' : 'right')
          : (e.velocityX > SWIPE_VELOCITY_THRESHOLD ? 'right' : 'left');

        const targetX = direction === 'right' ? EXIT_X : -EXIT_X;

        // Spring with finger velocity — card continues at the pace of the swipe
        translateX.value = withSpring(targetX, {
          ...EXIT_SPRING,
          velocity: e.velocityX,
        }, (finished) => {
          if (finished) {
            runOnJS(completeSwipe)(direction);
          }
        });

        // Y carries finger momentum naturally then settles
        translateY.value = withSpring(0, {
          ...EXIT_SPRING,
          velocity: e.velocityY * 0.3,
        });

        // Immediately reveal background for seamless transition
        if (onSwipeProgress) {
          runOnJS(onSwipeProgress)(1);
        }
      } else {
        translateX.value = withSpring(0, SNAP_BACK_SPRING);
        translateY.value = withSpring(0, SNAP_BACK_SPRING);
        if (onSwipeProgress) {
          runOnJS(onSwipeProgress)(0);
        }
      }
    });

  const handleTap = useCallback((x) => {
    const cardWidth = screenWidth - 20;
    if (x > cardWidth * 0.6 && currentImageIndex < totalImages - 1) {
      setCurrentImageIndex((prev) => prev + 1);
    } else if (x < cardWidth * 0.4 && currentImageIndex > 0) {
      setCurrentImageIndex((prev) => prev - 1);
    } else {
      onExpand && onExpand(profile);
    }
  }, [currentImageIndex, totalImages, onExpand, profile]);

  const handleDoubleTap = useCallback((x, y) => {
    hapticMedium();
    onDoubleTap && onDoubleTap({ x, y, profile });
  }, [onDoubleTap, profile]);

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(300)
    .onEnd((e) => {
      'worklet';
      runOnJS(handleDoubleTap)(e.x, e.y);
    });

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .onEnd((e) => {
      'worklet';
      runOnJS(handleTap)(e.x);
    });

  const composedGesture = Gesture.Exclusive(doubleTapGesture, panGesture, tapGesture);

  const cardAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const rotate = interpolate(
      translateX.value,
      [-screenWidth, 0, screenWidth],
      [-12, 0, 12],
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const accentColor = Colors.accent;
  const grayColor = Colors.gray400;
  const glowStyle = useAnimatedStyle(() => {
    'worklet';
    const absX = Math.abs(translateX.value);
    const borderW = interpolate(absX, [0, 150], [0, 3.5], Extrapolation.CLAMP);
    // Gold for right, gray for left
    const isRight = translateX.value >= 0;
    const color = isRight ? accentColor : grayColor;
    return {
      borderWidth: borderW,
      borderColor: absX > 5 ? color : 'transparent',
    };
  });

  const progressBarStyle = useAnimatedStyle(() => {
    'worklet';
    const opacity = interpolate(
      Math.abs(translateX.value),
      [0, 40],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const translateYVal = interpolate(
      Math.abs(translateX.value),
      [0, 80],
      [0, 10],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      transform: [{ translateY: translateYVal }],
    };
  });

  const triggerSwipe = useCallback((direction) => {
    const targetX = direction === 'right' ? EXIT_X : -EXIT_X;
    const kickVelocity = direction === 'right' ? 1200 : -1200;
    translateX.value = withSpring(targetX, {
      ...EXIT_SPRING,
      velocity: kickVelocity,
    }, (finished) => {
      if (finished) {
        runOnJS(completeSwipe)(direction);
      }
    });
    translateY.value = withSpring(0, EXIT_SPRING);
    if (onSwipeProgress) {
      runOnJS(onSwipeProgress)(1);
    }
  }, [completeSwipe, translateX, translateY, onSwipeProgress]);

  const rewindFrom = useCallback((direction) => {
    const startX = direction === 'right' ? EXIT_X : -EXIT_X;
    translateX.value = startX;
    translateY.value = 0;
    translateX.value = withSpring(0, SNAP_BACK_SPRING);
  }, [translateX, translateY]);

  useImperativeHandle(ref, () => ({
    swipe: triggerSwipe,
    rewindFrom,
  }));

  const handleImageError = () => {
    setImageErrors((prev) => ({ ...prev, [currentImageIndex]: true }));
  };

  const getInitial = () => profile.name ? profile.name.charAt(0).toUpperCase() : '?';
  const statusText = profile.status || profile.intention || profile.lookingFor;

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        style={[
          styles.card,
          style,
          cardAnimatedStyle,
          glowStyle,
        ]}
      >
        <View style={styles.imageWrapper}>
          <View style={styles.imageFallback}>
            <Text style={styles.fallbackInitial}>{getInitial()}</Text>
          </View>
          {imageUrl && !hasImageError && (
            <Image
              source={imageSource(imageUrl)}
              style={styles.image}
              resizeMode="cover"
              onError={handleImageError}
              fadeDuration={0}
            />
          )}
          {totalImages > 1 && (
            <Animated.View style={[styles.progressBar, progressBarStyle]}>
              {Array.from({ length: totalImages }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressSegment,
                    i === currentImageIndex && styles.progressSegmentActive,
                  ]}
                />
              ))}
            </Animated.View>
          )}
          {profile.verified && (
            <View style={styles.verifiedChip}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.accent} />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0.95)']}
            locations={[0, 0.4, 1]}
            style={styles.bottomGradient}
            pointerEvents="none"
          />
         <View style={styles.infoOverlay}>
            {/* Spray splatter decoration */}
            <View style={styles.infoSplatter} pointerEvents="none">
              <SpraySplatter size={32} color="#FFFFFF" opacity={0.06} />
            </View>
            {profile.distance != null && (
              <Text style={styles.distanceText}>{profile.distance} miles away</Text>
            )}
            <Text style={styles.name}>
              {profile.name}, {profile.age}
            </Text>
            {!!profile.ethnicity && (() => {
              const eth = getEthnicIdentity(profile.ethnicity);
              return (
                <View style={[styles.ethnicBadge, { backgroundColor: eth.color }]}>
                  <Text style={styles.ethnicEmoji}>{eth.emoji}</Text>
                  <Text style={styles.ethnicLabel}>{eth.label}</Text>
                </View>
              );
            })()}
            {!!statusText && (
              <View style={styles.statusPill}>
                <Text style={styles.statusEmoji}>{'\uD83D\uDC4B'}</Text>
                <Text style={styles.statusText}>{statusText}</Text>
              </View>
            )}
            {profile.currentlyInto?.length > 0 && (
              <View style={styles.currentlyIntoRow}>
                <Text style={styles.currentlyIntoLabel}>Currently into</Text>
                <View style={styles.currentlyIntoPills}>
                  {profile.currentlyInto.map((item, idx) => (
                    <View key={idx} style={styles.currentlyIntoPill}>
                      <Text style={styles.currentlyIntoPillText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
});

ProfileCard.displayName = 'ProfileCard';

const styles = StyleSheet.create({
  card: {
    borderRadius: ms(24),
    overflow: 'hidden',
    backgroundColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 14,
  },
  imageWrapper: {
    flex: 1,
  },
  imageFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackInitial: {
    fontSize: ms(60),
    fontWeight: '900',
    fontFamily: FontFamily.black,
    color: Colors.accent,
    opacity: 0.2,
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  progressBar: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: hp(14),
    zIndex: 10,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  progressSegmentActive: {
    backgroundColor: '#FFFFFF',
  },
  verifiedChip: {
    position: 'absolute',
    top: 104,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    zIndex: 5,
  },
  verifiedText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 220,
  },
  infoSplatter: {
    position: 'absolute',
    right: -4,
    top: -10,
  },
  infoOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 80,
    zIndex: 5,
  },
  distanceText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  name: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: FontFamily.black,
  },
  ethnicBadge: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
  },
  ethnicEmoji: {
    fontSize: 13,
  },
  ethnicLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    letterSpacing: 0.3,
  },
  statusPill: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  statusEmoji: {
    fontSize: 14,
  },
  currentlyIntoRow: {
    marginTop: 8,
  },
  currentlyIntoLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  currentlyIntoPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  currentlyIntoPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.accent,
    backgroundColor: Colors.accentTint25,
  },
  currentlyIntoPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
});

export default React.memo(ProfileCard);
