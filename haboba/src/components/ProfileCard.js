// Haboba — Profile Card
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
import { imageSource } from '../data/mockProfiles';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';

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

const ProfileCard = forwardRef(({ profile, onSwipe, onExpand, onSwipeProgress, style }, ref) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState({});

  useEffect(() => {
    translateX.value = 0;
    translateY.value = 0;
    setCurrentImageIndex(0);
    setImageErrors({});
  }, [profile?.id, translateX, translateY]);

  const imageUrl = profile.images?.[currentImageIndex];
  const totalImages = profile.images?.length || 1;
  const hasImageError = imageErrors[currentImageIndex];

  const completeSwipe = useCallback((direction) => {
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
      const progress = Math.min(Math.abs(e.translationX) / SWIPE_PROGRESS_DISTANCE, 1);
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
        const velocity = Math.abs(e.velocityX);
        const remaining = Math.abs(targetX - e.translationX);
        const duration = velocity > 100
          ? Math.max(120, Math.min(350, (remaining / velocity) * 1000))
          : 280;

        translateX.value = withTiming(targetX, { duration }, (finished) => {
          if (finished) {
            runOnJS(completeSwipe)(direction);
          }
        });
        translateY.value = withTiming(e.translationY * 0.25, { duration });
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

  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .onEnd((e) => {
      'worklet';
      runOnJS(handleTap)(e.x);
    });

  const composedGesture = Gesture.Exclusive(panGesture, tapGesture);

  const cardAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const rotate = interpolate(
      translateX.value,
      [-screenWidth, 0, screenWidth],
      [-10, 0, 10],
    );
    const scale = interpolate(
      Math.abs(translateX.value),
      [0, EXIT_X],
      [1, 0.92],
      Extrapolation.CLAMP,
    );
    const exitLift = interpolate(
      Math.abs(translateX.value),
      [0, EXIT_X * 0.5, EXIT_X],
      [0, -18, -40],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value + exitLift },
        { rotate: `${rotate}deg` },
        { scale },
      ],
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

  const likeStampStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: interpolate(translateX.value, [0, 80], [0, 1], Extrapolation.CLAMP),
    };
  });

  const nopeStampStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: interpolate(translateX.value, [-80, 0], [1, 0], Extrapolation.CLAMP),
    };
  });

  const triggerSwipe = useCallback((direction) => {
    const targetX = direction === 'right' ? EXIT_X : -EXIT_X;
    translateX.value = withTiming(targetX, { duration: 300 }, (finished) => {
      if (finished) {
        runOnJS(completeSwipe)(direction);
      }
    });
    translateY.value = withTiming(0, { duration: 300 });
    if (onSwipeProgress) {
      runOnJS(onSwipeProgress)(1);
    }
  }, [completeSwipe, translateX, translateY, onSwipeProgress]);

  useImperativeHandle(ref, () => ({
    swipe: triggerSwipe,
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
          <Animated.View style={[styles.stamp, styles.stampLike, likeStampStyle]}>
            <Text style={styles.stampLikeText}>LIKE</Text>
          </Animated.View>
          <Animated.View style={[styles.stamp, styles.stampNope, nopeStampStyle]}>
            <Text style={styles.stampNopeText}>NOPE</Text>
          </Animated.View>
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
            {profile.distance != null && (
              <Text style={styles.distanceText}>{profile.distance} miles away</Text>
            )}
            <Text style={styles.name}>
              {profile.name}, {profile.age}
            </Text>
            {!!statusText && (
              <View style={styles.statusPill}>
                <Text style={styles.statusEmoji}>{'\uD83D\uDC4B'}</Text>
                <Text style={styles.statusText}>{statusText}</Text>
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
  stamp: {
    position: 'absolute',
    top: 80,
    zIndex: 5,
    borderWidth: 3,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  stampLike: {
    left: 24,
    borderColor: '#34D399',
    transform: [{ rotate: '-15deg' }],
  },
  stampLikeText: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: FontFamily.black,
    color: '#34D399',
    letterSpacing: 4,
  },
  stampNope: {
    right: 24,
    borderColor: '#EF4444',
    transform: [{ rotate: '15deg' }],
  },
  stampNopeText: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: FontFamily.black,
    color: '#EF4444',
    letterSpacing: 4,
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
  infoOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 38,
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
  statusPill: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  statusEmoji: {
    fontSize: 14,
  },
});

export default ProfileCard;
