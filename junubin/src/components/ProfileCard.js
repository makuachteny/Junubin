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
import { BlurView } from 'expo-blur';
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

// Vertical gap from the top of the pills row to the baseline of the name.
// Pill row height ≈ 30 (13pt text + 7pt vert padding × 2) + 8 visual gap
// = 38. Locking this as a constant means the name's y-position is identical
// across every profile, regardless of whether 0, 1, or 2 pills render.
const NAME_GAP_ABOVE_PILLS = 38;

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

// `infoBottom` lets the caller override how far above the card's
// bottom edge the name + detail pills sit. The default (96) reserves
// clearance for HomeScreen's floating action button row, which sits
// over the card's lower edge. ProfileView (tap-from-map) renders its
// action bar OUTSIDE the card, so it passes a smaller value (~22) so
// the info doesn't float mid-photo with a big empty band beneath it.
const ProfileCard = forwardRef(({ profile, onSwipe, onExpand, onSwipeProgress, onDoubleTap, style, infoBottom = 96 }, ref) => {
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

          {/* Info overlay — bottom left, mirroring the Socialize screen
              mock the team signed off on:
                "<name>, <age>  <flag>"  +  gold ✓ checkmark
                [📍 <distance> mi]  [<currentlyInto[0]>]
              Two pills max, both on one row. The previous version
              showed three rows (name, distance+statusText, separate
              tags) which crowded the lower-third of the photo and
              didn't match the design. Status text (e.g. "Active
              now") is intentionally dropped here — recency is
              already conveyed by the OnlinePulseDot indicator on
              the card edge. */}
          {/* Name + pills are positioned at independent fixed offsets
              (not a single bottom-anchored stack) so the name stays
              at the same y-coord regardless of whether a profile has
              0, 1, or 2 detail pills. Earlier this was one View
              anchored at `bottom: infoBottom` — its intrinsic height
              shrank by ~36px when pills were absent, which made the
              name visibly jump between profiles during a swipe. */}
          <View style={[styles.pillsRow, { bottom: infoBottom }]}>
            {/* Pills use a plain semi-transparent dark fill rather
                than BlurView. The heavy blur read as a solid dark
                panel on real devices and didn't match the lighter,
                cleaner look in the design screenshot. rgba(0,0,0,0.45)
                is dark enough for white text to pass WCAG contrast
                on any photo without obscuring the underlying image. */}
            {profile.distance != null && (
              <View style={styles.detailPill}>
                <Ionicons name="location-sharp" size={13} color="rgba(255,255,255,0.9)" />
                <Text style={styles.detailText} numberOfLines={1}>{profile.distance} mi</Text>
              </View>
            )}
            {profile.currentlyInto?.length > 0 ? (
              <View style={styles.detailPill}>
                <Text style={styles.detailText} numberOfLines={1}>{profile.currentlyInto[0]}</Text>
              </View>
            ) : !!statusText && (
              // Fall back to status text only when there's no
              // currentlyInto signal — keeps the pill row useful
              // for profiles that haven't filled the prompt yet.
              <View style={styles.detailPill}>
                <Text style={styles.detailText} numberOfLines={1}>{statusText}</Text>
              </View>
            )}
          </View>
          <View style={[styles.nameRow, { bottom: infoBottom + NAME_GAP_ABOVE_PILLS }]}>
            <Text style={styles.nameText} numberOfLines={1}>
              {profile.name}, {profile.age} {getFlag(profile.country)}
            </Text>
            {profile.verified && (
              <Ionicons name="checkmark-circle" size={20} color="#FCCD12" />
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
    borderRadius: ms(22),
    overflow: 'hidden',
    backgroundColor: colors.gray300,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: isDark ? 0.55 : 0.25,
    shadowRadius: 32,
    elevation: 18,
  },
  imageWrapper: {
    flex: 1,
    // Match the card's rounding + clip at THIS level too. iOS occasionally
    // fails to clip absolutely-positioned children (the photo, gradient,
    // wash overlays) against a borderRadius set only on a grand-parent —
    // applying it here too guarantees the bitmap follows the card's
    // rounded edge instead of poking out at the corners.
    overflow: 'hidden',
    borderRadius: ms(22),
  },
  imageFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.gray300,
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
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    gap: 5,
    zIndex: 10,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  progressSegmentActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
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
    height: 260,
    zIndex: 3,
  },

  // Name row and pills row are positioned independently — each as
  // its own absolutely-positioned block anchored to the card bottom.
  // Caller-controlled `infoBottom` (default 96) sets the pills row's
  // bottom; the name row sits at `infoBottom + NAME_GAP_ABOVE_PILLS`
  // so the name's y-coord is identical across every profile,
  // regardless of how many pills (0/1/2) actually render.
  nameRow: {
    position: 'absolute',
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 5,
  },
  nameText: {
    fontSize: 30,
    fontWeight: '900',
    fontFamily: FontFamily.black,
    color: '#FFFFFF',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  pillsRow: {
    position: 'absolute',
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 5,
  },
  detailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    // Slightly roomier padding so the pills match the screenshot
    // proportions. The BlurView ancestor used to pad the children
    // tighter; without the blur we need a touch more horizontal
    // breathing room around the text.
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    overflow: 'hidden',
    // rgba(0,0,0,0.45) reads as a clean dark-translucent pill on
    // any photo — light enough not to look like a solid panel,
    // dark enough for the white text to stay legible.
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  detailText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontFamily: FontFamily.medium,
  },
  // tagRow / tag / tagText were the separate "currentlyInto" pill
  // row that lived below detailsRow before the screenshot-match
  // pass. Removed when the design collapsed to two inline pills.
  // Styles kept commented out so a future revert is one diff away.
  // tagRow / tag / tagText (deprecated)
  tagText: {
    // Retained so any external caller importing this style name from
    // a snapshot test doesn't break. Will fold into detailText next
    // refactor.
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
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
    fontSize: 11,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: '#FCCD12',
    letterSpacing: 1.2,
  },
});

export default React.memo(ProfileCard);
