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
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily, getShadow, Layout } from '../theme';
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

  const isPlus = hasTier('plus');
  const filtersLocked = !isPlus;

  useEffect(() => {
    if (!filtersLocked) return;
    if (activeFilters.length > 0) setActiveFilters([]);
    if (Object.keys(filterSelections).length > 0) setFilterSelections({});
  }, [filtersLocked, activeFilters.length, filterSelections]);

  const showFiltersLocked = useCallback(() => {
    Alert.alert('JuNubin+ Filters', 'Upgrade to JuNubin+ to unlock filters.', [
      { text: 'Upgrade', onPress: () => navigation.navigate('Elite') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [navigation]);

  const handleFilterPress = useCallback((filterName) => {
    if (filtersLocked) {
      showFiltersLocked();
      return;
    }
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
    if (filtersLocked) {
      showFiltersLocked();
      return;
    }
    setFilterSelections((prev) => {
      const next = { ...prev };
      if (value === null) {
        delete next[filterName];
      } else {
        next[filterName] = value;
      }
      return next;
    });
  }, [filtersLocked, showFiltersLocked]);

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
        <Text style={styles.headerTitle}>Likes</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="notifications-outline" size={21} color={colors.gray500} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
            <Image source={imageSource(currentUser?.images?.[0])} style={styles.avatar} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Fixed filter bar */}
      <View style={styles.filterBarWrap}>
        <FilterBar
          onFilterPress={handleFilterPress}
          onSettingsPress={() => navigation.navigate('Preferences')}
          activeFilters={activeFilters}
          filterSelections={filterSelections}
          onFilterSelect={handleFilterSelect}
          showSettingsButton={true}
          filters={LIKE_FILTERS}
          options={LIKE_FILTER_OPTIONS}
          containerStyle={{ marginTop: 2, marginBottom: 4, marginLeft: -12, marginRight: -12 }}
          disabled={filtersLocked}
          onDisabledPress={showFiltersLocked}
        />
        {filtersLocked && (
          <TouchableOpacity style={styles.filtersLockedRow} onPress={showFiltersLocked} activeOpacity={0.8}>
            <Ionicons name="lock-closed" size={14} color={colors.gray500} />
            <Text style={styles.filtersLockedText}>Filters are JuNubin+ only</Text>
          </TouchableOpacity>
        )}
      </View>

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
          <SpraySplatter size={35} color={colors.gray400} opacity={0.06} />
        </View>
        <View style={{ position: 'absolute', left: 4, bottom: 100 }} pointerEvents="none">
          <SpraySplatter size={40} color={colors.gray400} opacity={0.05} />
        </View>

        {/* Likes summary strip */}
        <View style={styles.likesSummary}>
          {/* Stacked avatars */}
          <View style={styles.avatarStack}>
            {filteredLikes.slice(0, 4).map((like, i) => (
              <Image
                key={like.id}
                source={imageSource(like.images?.[0])}
                style={[
                  styles.stackedAvatar,
                  { marginLeft: i === 0 ? 0 : -10, zIndex: 4 - i },
                ]}
                blurRadius={unlocked ? 0 : 8}
              />
            ))}
            {filteredLikes.length > 4 && (
              <View style={[styles.stackedAvatar, styles.stackedMore, { marginLeft: -10, zIndex: 0 }]}>
                <Text style={styles.stackedMoreText}>+{filteredLikes.length - 4}</Text>
              </View>
            )}
          </View>
          {/* Text */}
          <View style={styles.likesSummaryText}>
            <Text style={styles.likesSummaryTitle}>
              {filteredLikes.length} {filteredLikes.length === 1 ? 'person' : 'people'} {unlocked ? 'liked you' : 'waiting'}
            </Text>
            <Text style={styles.likesSummarySubtitle}>
              {unlocked ? 'Tap to match instantly' : 'Unlock to see them all'}
            </Text>
          </View>
          {/* CTA */}
          {!unlocked && (
            <TouchableOpacity style={styles.likesUnlockBtn} onPress={() => navigation.navigate('Elite')}>
              <Ionicons name="eye-outline" size={14} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>

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

        {/* Staggered masonry grid */}
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

            const cardH = CARD_HEIGHT;
            let likedAgo = `${Math.floor(Math.random() * 12) + 1}h ago`;
            if (like.likedAt) {
              const diff = Date.now() - new Date(like.likedAt).getTime();
              const hrs = Math.floor(diff / (1000 * 60 * 60));
              likedAgo = hrs < 1 ? 'Just now' : hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`;
            }

            return (
              <React.Fragment key={like.id}>
                {/* Inline upgrade banner after teaser cards */}
                {idx === 2 && !unlocked && (
                  <TouchableOpacity
                    style={styles.inlineBanner}
                    activeOpacity={0.85}
                    onPress={() => navigation.navigate('Elite')}
                  >
                    <LinearGradient
                      colors={[colors.accent, isDark ? '#8B0A1A' : '#A50E20']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.inlineBannerGradient}
                    >
                      <Ionicons name="eye" size={18} color="#FFFFFF" />
                      <Text style={styles.inlineBannerText}>See all {filteredLikes.length} people who like you</Text>
                      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
                    </LinearGradient>
                  </TouchableOpacity>
                )}
                <Animated.View style={[styles.likeCard, { height: cardH }, cardAnimStyle]}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={StyleSheet.absoluteFill}
                    onPress={() => {
                      if (unlocked || idx < 2) {
                        navigation.navigate('ProfileDetail', { profile: like, fromLikes: true });
                      } else {
                        navigation.navigate('Elite');
                      }
                    }}
                  >
                    <Image
                      source={imageSource(like.images?.[0])}
                      style={styles.likeImage}
                      blurRadius={unlocked || idx < 2 ? 0 : 25}
                    />

                    {/* Gradient overlay */}
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.65)', 'rgba(0,0,0,0.85)']}
                      locations={[0, 0.5, 1]}
                      style={styles.cardGradient}
                    />

                    {/* Card info */}
                    <View style={styles.likeInfo}>
                      <View style={styles.nameRow}>
                        {(unlocked || idx < 2) ? (
                          <Text style={styles.likeName} numberOfLines={1}>{like.name}</Text>
                        ) : (
                          <View style={styles.blurredName} />
                        )}
                        <Text style={styles.likeAge}>{like.age}</Text>
                      </View>

                      <View style={styles.likeTypeRow}>
                        <Ionicons
                          name={
                            (like.likeType === 'super_like' || like.isSuperLike) ? 'star' :
                            (like.hasWhisper || like.whisperText) ? 'chatbubble' :
                            'heart'
                          }
                          size={15}
                          color={
                            (like.likeType === 'super_like' || like.isSuperLike) ? '#FCCD12' :
                            (like.hasWhisper || like.whisperText) ? '#9B59B6' :
                            'rgba(255,255,255,0.5)'
                          }
                        />
                        <Text style={[
                          styles.likedAgoText,
                          (like.likeType === 'super_like' || like.isSuperLike) && { color: '#FCCD12' },
                          (like.hasWhisper || like.whisperText) && { color: '#C39BD3' },
                        ]}>
                          {(like.likeType === 'super_like' || like.isSuperLike) ? `Super Liked ${likedAgo}` :
                           (like.hasWhisper || like.whisperText) ? `Whispered ${likedAgo}` :
                           likedAgo}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              </React.Fragment>
            );
          })}

        </View>
          </>
        )}
      </Animated.ScrollView>

      {/* CTA removed — inline banner used instead */}
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
    fontSize: 32,
    fontFamily: FontFamily.black,
    fontWeight: '900',
    color: colors.black,
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.gray300,
    backgroundColor: colors.gray300,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  likesSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 8,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    borderRadius: 16,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackedAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2.5,
    borderColor: isDark ? colors.gray200 : colors.white,
  },
  stackedMore: {
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stackedMoreText: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: '#FFFFFF',
  },
  likesSummaryText: {
    flex: 1,
  },
  likesSummaryTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.black,
    marginBottom: 1,
  },
  likesSummarySubtitle: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    color: colors.gray500,
  },
  likesUnlockBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
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
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.gray300,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    ...getShadow('md', isDark),
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
  cardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  likeInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 14,
    paddingTop: 24,
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
    fontSize: 17,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  likeAge: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  likeTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  likedAgoText: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },

  // ─── Inline banner CTA ───
  inlineBanner: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: CARD_GAP,
    ...getShadow('md', isDark),
  },
  inlineBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  inlineBannerText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },
  filterBarWrap: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
    backgroundColor: colors.white,
    borderBottomWidth: 0,
  },
  filtersLockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 2,
    paddingTop: 2,
  },
  filtersLockedText: {
    ...Typography.caption,
    color: colors.gray500,
    fontSize: 12,
  },
});
