// JuNubin — Profile Card
// Static photo card: name chip + detail pills over a bottom gradient.
// Tap left/right thirds to page through photos, tap centre to expand.
//
// The swipe-deck era gave this component pan-gesture exit springs,
// LIKE/NOPE stamps, directional colour washes and a SPOTLIGHT badge.
// All of that is gone with the dating pivot — the only mount site is
// ProfileViewScreen (tap-from-map/directory), where a horizontal flick
// used to fling the card off-screen with no way to bring it back.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { FontFamily, ms, useTheme } from '../theme';
import { imageSource } from '../utils/imageSource';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { getFlag } from '../data/countries';

const { width: screenWidth } = Dimensions.get('window');

// Vertical gap from the top of the pills row to the baseline of the name.
// Pill row height ≈ 30 (13pt text + 7pt vert padding × 2) + 8 visual gap
// = 38. Locking this as a constant means the name's y-position is identical
// across every profile, regardless of whether 0, 1, or 2 pills render.
const NAME_GAP_ABOVE_PILLS = 38;

// `infoBottom` lets the caller override how far above the card's
// bottom edge the name + detail pills sit. The default (96) reserves
// clearance for a caller whose action bar overlaps the card's lower
// edge. ProfileView renders its action bar OUTSIDE the card, so it
// passes a smaller value (~22) so the info doesn't float mid-photo
// with a big empty band beneath it.
const ProfileCard = ({ profile, onExpand, style, infoBottom = 96 }) => {
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState({});

  useEffect(() => {
    setCurrentImageIndex(0);
    setImageErrors({});
  }, [profile?.id]);

  const imageUrl = profile.images?.[currentImageIndex];
  const totalImages = profile.images?.length || 1;
  const hasImageError = imageErrors[currentImageIndex];

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

  const handleImageError = () => {
    setImageErrors((prev) => ({ ...prev, [currentImageIndex]: true }));
  };

  const getInitial = () => profile.name ? profile.name.charAt(0).toUpperCase() : '?';
  // Pill fallback when `currentlyInto` is empty. `status` ("Active
  // now") wins, then the first "open to" badge — never the dating-era
  // `intention` / `lookingFor` fields.
  const statusText = profile.status || (Array.isArray(profile.openTo) ? profile.openTo[0] : null);

  return (
    <GestureDetector gesture={tapGesture}>
      <View style={[styles.card, style]}>
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

          {/* Bottom gradient for text legibility */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.85)']}
            locations={[0, 0.5, 1]}
            style={styles.bottomGradient}
            pointerEvents="none"
          />

          {/* Info overlay — bottom left:
                "<name>, <age>  <flag>"  +  gold ✓ checkmark
                [📍 <distance> mi]  [<currentlyInto[0]>]
              Two pills max, both on one row. */}
          {/* Name + pills are positioned at independent fixed offsets
              (not a single bottom-anchored stack) so the name stays
              at the same y-coord regardless of whether a profile has
              0, 1, or 2 detail pills. */}
          <View style={[styles.pillsRow, { bottom: infoBottom }]}>
            {/* Pills use a plain semi-transparent dark fill rather
                than BlurView. rgba(0,0,0,0.45) is dark enough for
                white text to pass WCAG contrast on any photo without
                obscuring the underlying image. */}
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
              <Ionicons name="checkmark-circle" size={20} color={colors.accentDark} />
            )}
          </View>
        </View>
      </View>
    </GestureDetector>
  );
};

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
    // fails to clip absolutely-positioned children (the photo, gradient)
    // against a borderRadius set only on a grand-parent — applying it
    // here too guarantees the bitmap follows the card's rounded edge
    // instead of poking out at the corners.
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
});

export default React.memo(ProfileCard);
