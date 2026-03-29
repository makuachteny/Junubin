// AnaJunubin — Profile Card
// Split info: name chip at top-left, floating frosted panel at bottom.
// Segmented progress bar. Directional color wash on swipe.

import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { FontFamily, ms, hp, useTheme, getSurface } from '../theme';
import { imageSource } from '../utils/imageSource';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { hapticLight, hapticMedium } from '../utils/haptics';
import { getFlag } from '../data/countries';

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

const EXIT_SPRING = {
  damping: 50,
  stiffness: 400,
  mass: 0.8,
  overshootClamping: true,
  restDisplacementThreshold: 50,
  restSpeedThreshold: 50,
};

const ProfileCard = forwardRef(({ profile, onSwipe, onExpand, onSwipeProgress, onDoubleTap, style }, ref) => {
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const thresholdCrossed = useSharedValue(0);
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

        translateX.value = withSpring(targetX, {
          ...EXIT_SPRING,
          velocity: e.velocityX,
        }, (finished) => {
          if (finished) {
            runOnJS(completeSwipe)(direction);
          }
        });

        translateY.value = withSpring(0, {
          ...EXIT_SPRING,
          velocity: e.velocityY * 0.3,
        });

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
    return {
      transform: [
        { translateX: translateX.value },
      ],
    };
  });

  // LIKE stamp opacity
  const likeStampStyle = useAnimatedStyle(() => {
    'worklet';
    const opacity = interpolate(translateX.value, [0, 80, 150], [0, 0.4, 1], Extrapolation.CLAMP);
    return { opacity: Math.max(opacity, 0) };
  });

  // NOPE stamp opacity
  const nopeStampStyle = useAnimatedStyle(() => {
    'worklet';
    const opacity = interpolate(translateX.value, [-150, -80, 0], [1, 0.4, 0], Extrapolation.CLAMP);
    return { opacity: Math.max(opacity, 0) };
  });

  // Directional color wash — green from right for like, gray from left for pass
  const likeWashStyle = useAnimatedStyle(() => {
    'worklet';
    const opacity = interpolate(translateX.value, [0, 150], [0, 0.25], Extrapolation.CLAMP);
    return { opacity: Math.max(opacity, 0) };
  });

  const passWashStyle = useAnimatedStyle(() => {
    'worklet';
    const opacity = interpolate(translateX.value, [-150, 0], [0.25, 0], Extrapolation.CLAMP);
    return { opacity: Math.max(opacity, 0) };
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

  const isSpotlight = profile.spotlight;

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        style={[
          styles.card,
          style,
          cardAnimatedStyle,
          isSpotlight && styles.spotlightCard,
        ]}
      >
        <View style={styles.imageWrapper}>
          <View style={styles.imageFallback}>
            <Text style={styles.fallbackInitial}>{getInitial()}</Text>
          </View>
          {imageUrl && !hasImageError && (
            <ExpoImage
              source={imageSource(imageUrl)}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              onError={handleImageError}
            />
          )}

          {/* LIKE / NOPE stamps */}
          <Animated.View style={[styles.likeStamp, likeStampStyle]} pointerEvents="none">
            <Text style={styles.likeStampText}>LIKE</Text>
          </Animated.View>
          <Animated.View style={[styles.nopeStamp, nopeStampStyle]} pointerEvents="none">
            <Text style={styles.nopeStampText}>NOPE</Text>
          </Animated.View>

          {/* Directional color wash overlays */}
          <Animated.View style={[styles.likeWash, likeWashStyle]} pointerEvents="none">
            <LinearGradient
              colors={['transparent', 'rgba(0, 151, 57, 0.4)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          <Animated.View style={[styles.passWash, passWashStyle]} pointerEvents="none">
            <LinearGradient
              colors={['rgba(100, 100, 100, 0.4)', 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>

          {/* Spotlight badge */}
          {isSpotlight && (
            <View style={styles.spotlightBadge}>
              <Ionicons name="star" size={12} color="#FCCD12" />
              <Text style={styles.spotlightBadgeText}>SPOTLIGHT</Text>
            </View>
          )}

          {/* Bottom gradient for text legibility */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.85)']}
            locations={[0, 0.5, 1]}
            style={styles.bottomGradient}
            pointerEvents="none"
          />

          {/* Info overlay — bottom left */}
          <View style={styles.infoOverlay}>
            <View style={styles.nameRow}>
              <Text style={styles.nameText}>
                {profile.name}, {profile.age} {getFlag(profile.country)}
              </Text>
              {profile.verified && (
                <Ionicons name="checkmark-circle" size={16} color="#FCCD12" />
              )}
            </View>
            <View style={styles.detailsRow}>
              {profile.distance != null && (
                <View style={styles.detailPill}>
                  <Ionicons name="location-sharp" size={11} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.detailText}>{profile.distance} mi</Text>
                </View>
              )}
              {!!statusText && (
                <View style={styles.detailPill}>
                  <Text style={styles.detailText}>{statusText}</Text>
                </View>
              )}
            </View>
            {profile.currentlyInto?.length > 0 && (
              <View style={styles.tagRow}>
                {profile.currentlyInto.slice(0, 3).map((item, idx) => (
                  <View key={idx} style={styles.tag}>
                    <Text style={styles.tagText}>{item}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
});

ProfileCard.displayName = 'ProfileCard';

const getStyles = (colors, isDark) => StyleSheet.create({
  card: {
    borderRadius: ms(24),
    overflow: 'hidden',
    backgroundColor: colors.gray900,
    borderWidth: 0,
  },
  imageWrapper: {
    flex: 1,
  },
  imageFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.gray900,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackInitial: {
    fontSize: ms(60),
    fontWeight: '900',
    fontFamily: FontFamily.black,
    color: colors.accent,
    opacity: 0.2,
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },

  // Directional color washes
  likeWash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  passWash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },

  // Segmented progress bar
  progressBar: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressSegmentActive: {
    backgroundColor: '#FFFFFF',
  },

  // LIKE / NOPE stamps
  likeStamp: {
    position: 'absolute',
    top: 80,
    left: 24,
    zIndex: 10,
    borderWidth: 3,
    borderColor: '#009739',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    transform: [{ rotate: '-15deg' }],
  },
  likeStampText: {
    fontSize: 32,
    fontWeight: '900',
    fontFamily: FontFamily.black,
    color: '#009739',
    letterSpacing: 2,
  },
  nopeStamp: {
    position: 'absolute',
    top: 80,
    right: 24,
    zIndex: 10,
    borderWidth: 3,
    borderColor: '#CE1126',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    transform: [{ rotate: '15deg' }],
  },
  nopeStampText: {
    fontSize: 32,
    fontWeight: '900',
    fontFamily: FontFamily.black,
    color: '#CE1126',
    letterSpacing: 2,
  },

  // Bottom gradient
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 200,
    zIndex: 3,
  },

  // Info overlay — bottom left, over gradient
  infoOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 90,
    zIndex: 5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  nameText: {
    fontSize: 28,
    fontWeight: '900',
    fontFamily: FontFamily.black,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  detailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  detailText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: FontFamily.medium,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  tagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },

  // Spotlight — gold glow border
  spotlightCard: {
    borderWidth: 2.5,
    borderColor: '#FCCD12',
    shadowColor: '#FCCD12',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  spotlightBadge: {
    position: 'absolute',
    top: hp(14) + 14,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    zIndex: 10,
  },
  spotlightBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: '#FCCD12',
    letterSpacing: 1.2,
  },
});

export default React.memo(ProfileCard);
