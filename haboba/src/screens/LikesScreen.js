import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily, getShadow, Layout } from '../theme';
import { GraffitiLocation, GraffitiHeart, GraffitiShield } from '../components/icons';
import { SpraySplatter } from '../components/GraffitiAccents';
import Button from '../components/Button';
import AdBanner from '../components/AdBanner';
import ProfilePromptBanner from '../components/ProfilePromptBanner';
import EmptyState from '../components/EmptyState';
import ThemedRefreshControl from '../components/ThemedRefreshControl';
import SkeletonShimmer from '../components/SkeletonShimmer';
import { mockLikes } from '../data/mockProfiles';
import { imageSource } from '../utils/imageSource';
import FilterBar from '../components/FilterBar';
import { useSubscription } from '../payments';
import { useAuth } from '../auth';
import { useCurrentUser } from '../hooks';
import * as likesService from '../api/services/likesService';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_W - 32 - CARD_GAP) / 2; // 16px padding each side
const CARD_HEIGHT = CARD_WIDTH * 1.45;

const AGE_OPTIONS = [
  { label: '18 – 20', value: '18-20' },
  { label: '21 – 25', value: '21-25' },
  { label: '26 – 30', value: '26-30' },
  { label: '31 – 35', value: '31-35' },
  { label: '36 – 40', value: '36-40' },
  { label: '41 – 50', value: '41-50' },
  { label: '50+', value: '50+' },
];

const DISTANCE_OPTIONS = [
  { label: '5 mi', value: '5' },
  { label: '10 mi', value: '10' },
  { label: '25 mi', value: '25' },
  { label: '50 mi', value: '50' },
  { label: '100 mi', value: '100' },
  { label: 'Anywhere', value: 'any' },
];

const ETHNICITY_OPTIONS = [
  { label: 'Any ethnicity', value: 'any' },
  { label: 'Dinka', value: 'Dinka' },
  { label: 'Nuer', value: 'Nuer' },
  { label: 'Bari', value: 'Bari' },
  { label: 'Shilluk', value: 'Shilluk' },
  { label: 'Azande', value: 'Azande' },
  { label: 'Mundari', value: 'Mundari' },
  { label: 'Acholi', value: 'Acholi' },
  { label: 'Lotuko', value: 'Lotuko' },
  { label: 'Toposa', value: 'Toposa' },
  { label: 'Murle', value: 'Murle' },
  { label: 'Madi', value: 'Madi' },
  { label: 'Other', value: 'Other' },
];

const HEIGHT_OPTIONS = [];
for (let feet = 4; feet <= 6; feet++) {
  const startIn = feet === 4 ? 10 : 0;
  const endIn = feet === 6 ? 8 : 11;
  for (let inches = startIn; inches <= endIn; inches++) {
    HEIGHT_OPTIONS.push({ label: `${feet}'${inches}"`, value: String(feet * 12 + inches) });
  }
}
HEIGHT_OPTIONS.push({ label: "6'9\"+", value: '81' });

const EDUCATION_OPTIONS = [
  { label: 'Any education', value: 'any' },
  { label: 'High school', value: 'High school' },
  { label: "Associate's degree", value: "Associate's degree" },
  { label: "Bachelor's degree", value: "Bachelor's degree" },
  { label: "Master's degree", value: "Master's degree" },
  { label: 'Doctorate', value: 'Doctorate' },
  { label: 'Trade school', value: 'Trade school' },
];

const CHILDREN_OPTIONS = [
  { label: "Doesn't matter", value: 'any' },
  { label: 'No children', value: 'No children' },
  { label: 'Has children', value: 'Has children' },
  { label: 'Want children', value: 'Want children' },
  { label: "Don't want children", value: "Don't want children" },
  { label: 'Open to children', value: 'Open to children' },
];

const LIKE_FILTERS = [
  { label: 'Age', hasChevron: true, icon: 'calendar-outline' },
  { label: 'Distance', hasChevron: true, icon: 'location-outline' },
  { label: 'Ethnicity', hasChevron: true, icon: 'people-outline' },
  { label: 'Height', hasChevron: true, icon: 'resize-outline' },
  { label: 'Education', hasChevron: true, icon: 'school-outline' },
  { label: 'Children', hasChevron: true, icon: 'happy-outline' },
  { label: 'Verified', hasChevron: false, icon: 'checkmark-circle-outline' },
  { label: 'Active today', hasChevron: false },
  { label: 'Nearby', hasChevron: false },
  { label: 'Super Likes', hasChevron: false },
  { label: 'Whispers', hasChevron: false },
  { label: 'New', hasChevron: false },
];

const LIKE_FILTER_OPTIONS = {
  Age: AGE_OPTIONS,
  Distance: DISTANCE_OPTIONS,
  Ethnicity: ETHNICITY_OPTIONS,
  Height: HEIGHT_OPTIONS,
  Education: EDUCATION_OPTIONS,
  Children: CHILDREN_OPTIONS,
};

const parseDistanceMiles = (distance) => {
  if (!distance) return null;
  if (typeof distance === 'number') return distance;
  const match = String(distance).match(/(\d+(\.\d+)?)/);
  return match ? Number(match[1]) : null;
};

const applyLikeFilters = (likes, toggleFilters, selections = {}) => {
  const hasToggle = toggleFilters?.length > 0;
  const hasSelection = Object.values(selections).some(Boolean);
  if (!hasToggle && !hasSelection) return likes;

  return likes.filter((like) => {
    let pass = true;

    if (selections.Age) {
      const ageVal = selections.Age;
      if (ageVal === '50+') {
        pass = pass && (like.age || 0) >= 50;
      } else {
        const parts = ageVal.split('-');
        const min = Number(parts[0]);
        const max = Number(parts[1]);
        if (!Number.isNaN(min) && !Number.isNaN(max)) {
          pass = pass && like.age >= min && like.age <= max;
        }
      }
    }

    if (selections.Distance) {
      const dVal = selections.Distance;
      if (dVal !== 'any') {
        const maxMiles = Number(dVal);
        const miles = parseDistanceMiles(like.distance);
        if (!Number.isNaN(maxMiles) && miles != null) {
          pass = pass && miles <= maxMiles;
        } else if (!Number.isNaN(maxMiles) && miles == null) {
          pass = false;
        }
      }
    }

    if (selections.Ethnicity) {
      const eth = selections.Ethnicity;
      if (eth !== 'any') {
        pass = pass && (like.ethnicity || '').toLowerCase() === eth.toLowerCase();
      }
    }

    if (selections.Height) {
      const hVal = Number(selections.Height);
      if (!Number.isNaN(hVal)) {
        const heightStr = like.height || '';
        const match = heightStr.match(/(\d+)'(\d+)/);
        if (match) {
          const totalInches = Number(match[1]) * 12 + Number(match[2]);
          if (hVal === 81) {
            pass = pass && totalInches >= 81;
          } else {
            pass = pass && totalInches >= hVal - 2 && totalInches <= hVal + 2;
          }
        } else {
          pass = false;
        }
      }
    }

    if (selections.Education) {
      const edu = selections.Education;
      if (edu !== 'any') {
        pass = pass && (like.education || '').toLowerCase() === edu.toLowerCase();
      }
    }

    if (selections.Children) {
      const ch = selections.Children;
      if (ch !== 'any') {
        pass = pass && (like.children || '').toLowerCase().includes(ch.toLowerCase());
      }
    }

    if (toggleFilters?.length) {
      toggleFilters.forEach((filter) => {
        switch (filter) {
          case 'Verified':
            pass = pass && !!like.verified;
            break;
          case 'Active today':
            if (like.activity) {
              pass = pass && like.activity === 'active';
            } else if (like.likedAt) {
              const likedAt = new Date(like.likedAt).getTime();
              const now = Date.now();
              pass = pass && (now - likedAt) <= 24 * 60 * 60 * 1000;
            } else {
              pass = false;
            }
            break;
          case 'Nearby': {
            const miles = parseDistanceMiles(like.distance);
            pass = pass && miles != null && miles <= 5;
            break;
          }
          case 'Super Likes':
            pass = pass && (like.likeType === 'super_like' || like.isSuperLike);
            break;
          case 'Whispers':
            pass = pass && !!(like.hasWhisper || like.whisperText || like.whisper);
            break;
          case 'New':
            if (like.likedAt) {
              const likedAt = new Date(like.likedAt).getTime();
              const now = Date.now();
              pass = pass && (now - likedAt) <= 24 * 60 * 60 * 1000;
            } else {
              pass = false;
            }
            break;
          default:
            break;
        }
      });
    }

    return pass;
  });
};

export default function LikesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [likes, setLikes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const styles = useMemo(() => getStyles(colors, isDark, insets), [colors, isDark, insets]);
  const { canSeeWhoLikesYou, hasTier } = useSubscription();
  const { session } = useAuth();
  const { currentUser } = useCurrentUser();
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilters, setActiveFilters] = useState([]);
  const [filterSelections, setFilterSelections] = useState({});
  const contentAnim = useRef(new Animated.Value(0)).current;
  const cardAnimsRef = useRef([]);
  const hasAnimatedCardsRef = useRef(false);

  const fetchLikes = useCallback(() => {
    if (!session) {
      setLikes(mockLikes);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    likesService.getReceivedLikes().then((apiLikes) => {
      setLikes(apiLikes.length > 0 ? apiLikes : mockLikes);
    }).catch((err) => {
      if (__DEV__) console.warn('Likes fetch failed:', err);
      setLikes(mockLikes);
    }).finally(() => setIsLoading(false));
  }, [session]);

  useEffect(() => {
    fetchLikes();
  }, [fetchLikes]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    if (!session) {
      setTimeout(() => {
        setLikes(mockLikes);
        setRefreshing(false);
      }, 800);
      return;
    }
    likesService.getReceivedLikes().then((apiLikes) => {
      setLikes(apiLikes.length > 0 ? apiLikes : mockLikes);
    }).catch(() => {
      setLikes(mockLikes);
    }).finally(() => setRefreshing(false));
  }, [session]);

  useEffect(() => {
    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [contentAnim]);

  // Reset animation when filters change
  useEffect(() => {
    hasAnimatedCardsRef.current = false;
  }, [activeFilters, filterSelections]);

  // Staggered scale+fade for grid cards
  useEffect(() => {
    if (hasAnimatedCardsRef.current || filteredLikes.length === 0) return;
    const anims = filteredLikes.map(() => new Animated.Value(0));
    cardAnimsRef.current = anims;
    hasAnimatedCardsRef.current = true;
    const staggered = anims.map((anim, i) =>
      Animated.spring(anim, {
        toValue: 1,
        tension: 68,
        friction: 10,
        delay: i * 50,
        useNativeDriver: true,
      })
    );
    Animated.stagger(0, staggered).start();
  }, [filteredLikes]);

  const handleFilterPress = useCallback((filterName) => {
    if (filterName === 'More') {
      navigation?.navigate?.('Preferences');
      return;
    }
    setActiveFilters((prev) =>
      prev.includes(filterName)
        ? prev.filter((f) => f !== filterName)
        : [...prev, filterName]
    );
  }, [navigation]);

  const handleFilterSelect = useCallback((filterName, value) => {
    setFilterSelections((prev) => {
      const next = { ...prev };
      if (value === null) {
        delete next[filterName];
      } else {
        next[filterName] = value;
      }
      return next;
    });
  }, []);

  const filteredLikes = useMemo(
    () => applyLikeFilters(likes, activeFilters, filterSelections),
    [likes, activeFilters, filterSelections]
  );

  const unlocked = canSeeWhoLikesYou();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header row */}
      <Animated.View
        style={[
          styles.headerRow,
          {
            opacity: contentAnim,
            transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.filterBtn}
          onPress={() => navigation.navigate('Settings')}
          activeOpacity={0.75}
        >
          <Ionicons name="options-outline" size={18} color={colors.black} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Likes</Text>

        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
          <Image source={imageSource(currentUser?.images?.[0])} style={styles.avatar} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView
        style={[
          styles.content,
          {
            opacity: contentAnim,
            transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          },
        ]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <ThemedRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Filter bar (scrolls with content) */}
        <FilterBar
          onFilterPress={handleFilterPress}
          onSettingsPress={() => navigation.navigate('Preferences')}
          activeFilters={activeFilters}
          filterSelections={filterSelections}
          onFilterSelect={handleFilterSelect}
          showSettingsButton={false}
          filters={LIKE_FILTERS}
          options={LIKE_FILTER_OPTIONS}
          containerStyle={{ marginTop: Layout.filterGap, marginBottom: 6, marginLeft: -12, marginRight: -12 }}
        />
        {isLoading ? (
          <View style={styles.likesGrid}>
            {Array.from({ length: 6 }).map((_, idx) => (
              <View key={`like-skel-${idx}`} style={styles.likeSkeletonCard}>
                <SkeletonShimmer width="100%" height={CARD_HEIGHT} borderRadius={16} />
              </View>
            ))}
          </View>
        ) : (
          <>
        {/* Ambient spray accents */}
        <View style={{ position: 'absolute', right: 8, top: 20 }} pointerEvents="none">
          <SpraySplatter size={35} color={colors.accent} opacity={0.06} />
        </View>
        <View style={{ position: 'absolute', left: 4, bottom: 100 }} pointerEvents="none">
          <SpraySplatter size={40} color={colors.accent} opacity={0.05} />
        </View>

        {/* Like count */}
        <Text style={styles.likesCount}>{filteredLikes.length} Like{filteredLikes.length !== 1 ? 's' : ''}</Text>

        {/* Upgrade text */}
        {unlocked ? (
          <Text style={styles.upgradeText}>
            You can see everyone who likes you!
          </Text>
        ) : (
          <Text style={styles.upgradeText}>
            Upgrade to Elite Membership to see{'\n'}people who already liked you!
          </Text>
        )}

        {/* Upsell Banner (free users) */}
        {!hasTier('plus') && (
          <ProfilePromptBanner
            message="See who liked you first with JuNubin+"
            onPress={() => navigation.navigate('Elite')}
            colors={colors}
          />
        )}

        {/* Ad Banner */}
        <AdBanner colors={colors} style={{ marginBottom: 12 }} />

        {/* Empty state */}
        {filteredLikes.length === 0 && !isLoading && (
          <EmptyState
            icon="heart"
            title={likes.length === 0 ? 'No likes yet' : 'No results'}
            subtitle={likes.length === 0 ? 'Keep swiping to get noticed!' : 'Try adjusting your filters.'}
          />
        )}

        {/* Card grid */}
        <View style={styles.likesGrid}>
          {filteredLikes.map((like, idx) => {
            const cardAnim = cardAnimsRef.current[idx];
            const cardAnimStyle = cardAnim ? {
              opacity: cardAnim,
              transform: [{
                scale: cardAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.85, 1],
                }),
              }],
            } : {};

            return (
              <Animated.View key={like.id} style={[styles.likeCard, cardAnimStyle]}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={StyleSheet.absoluteFill}
                  onPress={() => {
                    if (unlocked) {
                      navigation.navigate('ProfileDetail', { profile: like, fromLikes: true });
                    } else {
                      navigation.navigate('Elite');
                    }
                  }}
                >
                  <Image
                    source={imageSource(like.images?.[0])}
                    style={styles.likeImage}
                    blurRadius={unlocked ? 0 : 25}
                  />
                  {/* Bottom gradient overlay */}
                  <View style={styles.gradientOverlay} />

                  {/* Card info */}
                  <View style={styles.likeInfo}>
                    {/* Name + Age + Heart row */}
                    <View style={styles.nameRow}>
                      {unlocked ? (
                        <Text style={styles.likeName} numberOfLines={1}>{like.name}</Text>
                      ) : (
                        <View style={styles.blurredName} />
                      )}
                      <Text style={styles.likeAge}>{like.age}</Text>
                      <GraffitiHeart size={16} color="#FF69B4" filled />
                    </View>

                    {/* Activity row */}
                    <View style={styles.activityRow}>
                      {like.activity === 'nearby' ? (
                        <>
                          <GraffitiLocation size={13} color="#FFFFFF" filled />
                          <Text style={styles.activityText}>Nearby</Text>
                        </>
                      ) : (
                        <>
                          <View style={styles.activeDot} />
                          <Text style={styles.activityText}>Recently Active</Text>
                        </>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}

        </View>
          </>
        )}
      </Animated.ScrollView>

      {/* Fixed CTA button — stays at bottom, does not scroll */}
      {!unlocked && filteredLikes.length > 0 && (
        <View style={styles.ctaFixed}>
          <TouchableOpacity
            style={styles.ctaButton}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Elite')}
          >
            <Text style={styles.ctaText}>SEE WHO LIKES YOU</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const getStyles = (colors, isDark, insets) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: Layout.headerHeight,
    backgroundColor: colors.white,
  },
  headerTitle: {
    ...Typography.screenTitle,
    color: colors.black,
    textAlign: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.gray300,
    ...getShadow('md', isDark),
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.separator,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
    ...getShadow('md', isDark),
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  likesCount: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.accent,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  upgradeText: {
    fontSize: 16,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    color: isDark ? colors.gray400 : colors.gray700,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 23,
  },

  // ─── Card grid ───
  likesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
    position: 'relative',
  },
  likeCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.gray300,
  },
  likeSkeletonCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
  },
  likeImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
    backgroundColor: 'transparent',
    // Simulated gradient with layered opacity
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    // Use a dark overlay at the bottom
    ...StyleSheet.absoluteFillObject,
    top: undefined,
    backgroundGradient: undefined, // RN doesn't support CSS gradients
  },
  likeInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 14,
    paddingTop: 40,
    // Dark gradient effect
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },

  // ─── Name row ───
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  blurredName: {
    width: 70,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 4,
  },
  likeName: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },
  likeAge: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },

  // ─── Activity row ───
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.warning, // yellow dot for "Recently Active"
  },
  activityText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
  },

  // ─── CTA fixed at bottom ───
  ctaFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 16 + (insets?.bottom || 0),
    alignItems: 'center',
    zIndex: 10,
  },
  ctaButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 40,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
});
