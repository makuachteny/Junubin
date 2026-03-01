import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, Typography, FontFamily, getShadow } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FilterBar from '../components/FilterBar';
import ProfileCard from '../components/ProfileCard';
import ActionButtons from '../components/ActionButtons';
import MatchCelebrationOverlay from '../components/MatchCelebrationOverlay';
import Button from '../components/Button';
import { mockProfiles, currentUser, imageSource } from '../data/mockProfiles';
import { useSubscription } from '../payments';
import { hasUnlimitedLikes } from '../payments';
import { useAuth } from '../auth';
import * as discoverService from '../api/services/discoverService';

const MIN_DATING_CARDS = 10;

const shuffleArray = (arr) => {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const buildDatingDeck = () => {
  const base = mockProfiles.filter((p) => p && p.id && p.name && p.images?.length >= 1);
  if (base.length === 0) return [];
  const deck = base.length >= MIN_DATING_CARDS ? [...base] : (() => {
    const filled = [...base];
    let i = 0;
    while (filled.length < MIN_DATING_CARDS) {
      const source = base[i % base.length];
      filled.push({ ...source, id: `${source.id}-clone-${i}` });
      i += 1;
    }
    return filled;
  })();
  return shuffleArray(deck);
};

const extractHeightInInches = (heightValue) => {
  if (!heightValue || typeof heightValue !== 'string') return 0;
  const match = heightValue.match(/(\d+)'(\d+)/);
  if (!match) return 0;
  const feet = Number(match[1]);
  const inches = Number(match[2]);
  if (Number.isNaN(feet) || Number.isNaN(inches)) return 0;
  return feet * 12 + inches;
};

// Age: range strings like "21-30" or "50+"
// Height: total inches as string, e.g. "70" for 5'10"  (last option "81" means 6'9"+)

const applyFilters = (profiles, toggleFilters, selections = {}) => {
  const hasToggle = toggleFilters?.length > 0;
  const hasSelection = Object.values(selections).some(Boolean);
  if (!hasToggle && !hasSelection) return profiles;

  return profiles.filter((profile) => {
    const heightInInches = extractHeightInInches(profile.height);
    const intention = (profile.intention || profile.lookingFor || '').toLowerCase();

    // Check toggle filters (Active today, New here)
    const togglePass = !hasToggle || toggleFilters.every((filter) => {
      switch (filter) {
        case 'Active today':
          return profile.distance <= 5;
        case 'New here':
          return Number(profile.id) >= 8;
        default:
          return true;
      }
    });

    // Check dropdown selections
    let selectionPass = true;

    if (selections.Age) {
      const ageVal = selections.Age;
      if (ageVal === '50+') {
        selectionPass = selectionPass && profile.age >= 50;
      } else {
        const parts = ageVal.split('-');
        const min = Number(parts[0]);
        const max = Number(parts[1]);
        if (!Number.isNaN(min) && !Number.isNaN(max)) {
          selectionPass = selectionPass && profile.age >= min && profile.age <= max;
        }
      }
    }

    if (selections.Height) {
      const hVal = Number(selections.Height);
      if (!Number.isNaN(hVal)) {
        // Last option (81 = 6'9"+) means that height or taller
        if (hVal === 81) {
          selectionPass = selectionPass && heightInInches >= 81;
        } else {
          selectionPass = selectionPass && heightInInches === hVal;
        }
      }
    }

    if (selections['Dating Intentions']) {
      const sel = selections['Dating Intentions'];
      if (sel === 'open') {
        selectionPass = selectionPass && true; // open to all — no filtering
      } else {
        selectionPass = selectionPass && intention.includes(sel);
      }
    }

    return togglePass && selectionPass;
  });
};

const HomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [profiles, setProfiles] = useState(() => buildDatingDeck());
  const [unfilteredProfiles, setUnfilteredProfiles] = useState(null); // holds API or base profiles before filtering
  const [activeFilters, setActiveFilters] = useState([]);
  const [filterSelections, setFilterSelections] = useState({});
  const swipeProgress = useRef(new Animated.Value(0)).current;
  const styles = useMemo(() => getStyles(colors, insets, isDark), [colors, insets, isDark]);
  const [matchData, setMatchData] = useState(null);
  const [mode, setMode] = useState('Dating');

  // Read persisted mode on mount and when screen regains focus
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('@haboba_mode').then((stored) => {
        if (stored === 'Social' || stored === 'Dating') setMode(stored);
      });
    }, [])
  );

  const [likeStatus, setLikeStatus] = useState(null); // { used, limit, remaining }
  const { consumeSuperLike, consumeWhisper, superLikes, whispers, hasTier, tier } = useSubscription();
  const { accessToken, user: authUser } = useAuth();
  const profileCardRef = useRef(null);
  const topMotion = useRef(new Animated.Value(0)).current;
  const apiCursorRef = useRef(null);
  const handleSwipeProgress = useCallback((value) => {
    const clamped = Math.min(Math.max(value, 0), 1);
    swipeProgress.setValue(clamped);
  }, [swipeProgress]);

  // Fetch profiles from API on mount and when mode changes
  useEffect(() => {
    if (!accessToken) return;
    discoverService.getProfiles(accessToken, { mode: mode.toLowerCase() }).then(({ profiles: apiProfiles, nextCursor }) => {
      // Only use profiles that have at least one image (mirrors buildDatingDeck filter)
      const withImages = apiProfiles.filter((p) => p.images && p.images.length > 0);
      if (withImages.length > 0) {
        setUnfilteredProfiles(withImages);
        setProfiles(applyFilters(withImages, activeFilters, filterSelections));
        apiCursorRef.current = nextCursor;
      }
    }).catch(() => {
      // Keep mock data on failure
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, mode]);

  // Fetch daily like status
  useEffect(() => {
    if (!accessToken) return;
    discoverService.getDailyLikeStatus(accessToken).then(setLikeStatus).catch(() => {});
  }, [accessToken]);

  useEffect(() => {
    Animated.timing(topMotion, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [topMotion]);

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener('tabPress', () => {
        const baseDeck = unfilteredProfiles || buildDatingDeck();
        setProfiles(applyFilters(baseDeck, activeFilters, filterSelections));
      });
      return unsubscribe;
    }, [navigation, activeFilters, filterSelections, unfilteredProfiles])
  );

  useEffect(() => {
    const baseDeck = unfilteredProfiles || buildDatingDeck();
    const filteredDeck = applyFilters(baseDeck, activeFilters, filterSelections);
    setProfiles(filteredDeck);
  }, [activeFilters, filterSelections, unfilteredProfiles]);

  useEffect(() => {
    swipeProgress.setValue(0);
  }, [profiles.length, swipeProgress]);

  const handleSwipe = useCallback((direction) => {
    const swipedProfile = profiles[0];

    // Check daily like limit for right-swipes (free users)
    if (direction === 'right' && likeStatus && likeStatus.remaining <= 0 && !hasUnlimitedLikes(tier || 'free')) {
      Alert.alert('Daily Limit Reached', 'You\'ve used all your likes for today.', [
        { text: 'Upgrade', onPress: () => navigation?.navigate?.('Elite') },
        { text: 'OK', style: 'cancel' },
      ]);
      return;
    }

    setProfiles((prev) => prev.slice(1));
    swipeProgress.setValue(0);

    // Record swipe via API (fire-and-forget)
    if (accessToken && swipedProfile?.id) {
      const type = direction === 'right' ? 'like' : 'pass';
      discoverService.recordSwipe(accessToken, swipedProfile.id, type).then((result) => {
        if (result?.match) {
          setMatchData({
            matchedUser: swipedProfile,
            conversationId: result.match.conversation?.id,
          });
        }
        // Update like status after a swipe
        if (direction === 'right') {
          setLikeStatus((prev) => prev ? { ...prev, used: prev.used + 1, remaining: Math.max(0, prev.remaining - 1) } : prev);
        }
      }).catch((err) => {
        // Handle 429 daily limit from backend
        if (err?.status === 429) {
          setLikeStatus((prev) => prev ? { ...prev, remaining: 0 } : { used: 25, limit: 25, remaining: 0 });
        }
      });
    }

    // Auto-fetch more when deck runs low
    if (profiles.length <= 3 && accessToken && apiCursorRef.current) {
      discoverService.getProfiles(accessToken, { cursor: apiCursorRef.current, mode: mode.toLowerCase() }).then(({ profiles: more, nextCursor }) => {
        const withImages = more.filter((p) => p.images && p.images.length > 0);
        if (withImages.length > 0) {
          setProfiles((prev) => [...prev, ...withImages]);
          apiCursorRef.current = nextCursor;
        }
      }).catch(() => {});
    }
  }, [swipeProgress, profiles, accessToken, likeStatus, tier, navigation, mode]);

  const currentProfile = profiles.length > 0 ? profiles[0] : null;
  const hasValidProfile = !!(currentProfile && currentProfile.name && currentProfile.images?.length);

  const handleExpand = (profile) => {
    navigation?.navigate?.('ProfileDetail', { profile });
  };

  const handleSuperLike = () => {
    if (superLikes <= 0) {
      Alert.alert('No Super Likes', 'You\'re out of Super Likes!', [
        { text: 'Get More', onPress: () => navigation?.navigate?.('Boost') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    consumeSuperLike();
    if (profileCardRef.current?.swipe) {
      profileCardRef.current.swipe('right');
    } else {
      handleSwipe('right');
    }
  };

  const handleRewind = () => {
    if (!hasTier('plus')) {
      Alert.alert('JuNubin+ Feature', 'Rewind requires JuNubin+ or higher.', [
        { text: 'Upgrade', onPress: () => navigation?.navigate?.('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
  };

  const handleMessage = () => {
    if (whispers <= 0) {
      Alert.alert('No Whispers', 'You\'re out of whispers!', [
        { text: 'Upgrade', onPress: () => navigation?.navigate?.('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    consumeWhisper();
    Alert.alert('Whisper Sent!', 'Your message has been delivered.');
    if (profileCardRef.current?.swipe) {
      profileCardRef.current.swipe('right');
    } else {
      handleSwipe('right');
    }
  };

  const handleFilterPress = (filterName) => {
    if (filterName === 'More') {
      navigation?.navigate?.('Preferences');
      return;
    }
    setActiveFilters((prev) =>
      prev.includes(filterName)
        ? prev.filter((f) => f !== filterName)
        : [...prev, filterName]
    );
  };

  const handleFilterSelect = (filterName, value) => {
    setFilterSelections((prev) => {
      const next = { ...prev };
      if (value === null) {
        delete next[filterName];
      } else {
        next[filterName] = value;
      }
      return next;
    });
  };

  // Next card in the stack (pre-rendered so its image is already decoded)
  const nextProfile = profiles.length > 1 ? profiles[1] : null;
  const hasNextProfile = !!(nextProfile && nextProfile.name && nextProfile.images?.length);
  const nextCardScale = swipeProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1],
    extrapolate: 'clamp',
  });
  const nextCardOpacity = swipeProgress.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0.5, 0.85, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.screen}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ─── DATING AREA ─── */}
      <View style={styles.datingArea}>
        {hasValidProfile ? (
          <>
            {/* Card with directional entry animation */}
            <View style={styles.cardArea}>
              <View style={styles.cardLayer}>
                {/* Next card — pre-rendered underneath, image already decoded */}
                {hasNextProfile && (
                  <Animated.View
                    style={[styles.nextCard, {
                      transform: [{ scale: nextCardScale }],
                      opacity: nextCardOpacity,
                    }]}
                    pointerEvents="none"
                  >
                    <ProfileCard
                      profile={nextProfile}
                      style={styles.fullCard}
                    />
                  </Animated.View>
                )}
                {/* Current card — swipeable, on top */}
                <View style={styles.fullCard}>
                  <ProfileCard
                    key={currentProfile.id}
                    ref={profileCardRef}
                    profile={currentProfile}
                    onSwipe={handleSwipe}
                    onExpand={handleExpand}
                    onSwipeProgress={handleSwipeProgress}
                    style={styles.fullCard}
                  />
                </View>
              </View>
            </View>

            {/* Action buttons overlaid at bottom of card */}
            <View style={styles.actionOverlay}>
              <ActionButtons
                onRewind={handleRewind}
                onPass={() => (profileCardRef.current?.swipe ? profileCardRef.current.swipe('left') : handleSwipe('left'))}
                onLike={() => (profileCardRef.current?.swipe ? profileCardRef.current.swipe('right') : handleSwipe('right'))}
                onSuperLike={handleSuperLike}
                onMessage={handleMessage}
              />
            </View>
          </>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyBanner}>
              <View style={styles.emptyCircle}>
                <Ionicons name="heart-outline" size={30} color={colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>No more profiles</Text>
              <Text style={styles.emptySub}>
                You've seen everyone nearby. Check back later or adjust your filters to see more people.
              </Text>
              <Button
                title="Adjust Filters"
                variant="primary"
                size="sm"
                fullWidth={false}
                onPress={() => navigation?.navigate?.('Preferences')}
                style={{ paddingHorizontal: 32 }}
              />
            </View>
          </View>
        )}
      </View>

      {/* ─── TOP BAR — floats over card ─── */}
      <Animated.View
        style={[styles.topBar, { top: insets.top }]}
        pointerEvents="box-none"
      >
        {/* Left — Crown Badge (SS flag colors, Instagram-style) — tappable → Boost */}
        <TouchableOpacity
          onPress={() => navigation?.navigate?.('Boost')}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.headerSideSlot}
        >
          <LinearGradient
            colors={['#0F47AF', '#CE1126', '#078930']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.crownBadge}
          >
            <FontAwesome5 name="crown" size={16} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Center — Brand title */}
        <Text style={styles.headerTitle}>AnaJunubin</Text>

        {/* Right — Profile avatar */}
        <TouchableOpacity
          onPress={() => navigation?.navigate?.('Profile')}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.headerSideSlot}
        >
          <Image source={imageSource(currentUser.images?.[0])} style={styles.avatar} />
        </TouchableOpacity>
      </Animated.View>

      {/* ─── FILTER BAR — below top bar ─── */}
      <Animated.View
        style={[
          styles.filterBarWrap,
          {
            top: insets.top + 56,
            opacity: topMotion,
            transform: [
              {
                translateY: topMotion.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-10, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents="box-none"
      >
        <FilterBar
          onFilterPress={handleFilterPress}
          onSettingsPress={() => navigation?.navigate?.('Preferences')}
          activeFilters={activeFilters}
          filterSelections={filterSelections}
          onFilterSelect={handleFilterSelect}
        />
      </Animated.View>

      {/* ─── LIKE COUNTER — subtle indicator near bottom ─── */}
      {likeStatus && !hasUnlimitedLikes(tier || 'free') && likeStatus.remaining < likeStatus.limit && (
        <View style={styles.likeCounter}>
          <Ionicons name="heart" size={12} color={likeStatus.remaining <= 5 ? '#FF5252' : 'rgba(255,255,255,0.6)'} />
          <Text style={[styles.likeCounterText, likeStatus.remaining <= 5 && { color: '#FF5252' }]}>
            {likeStatus.remaining} likes left today
          </Text>
        </View>
      )}

      {/* ─── MATCH CELEBRATION OVERLAY ─── */}
      <MatchCelebrationOverlay
        visible={!!matchData}
        currentUser={{ name: authUser?.displayName || currentUser.name, images: authUser?.photos?.map((p) => p.url) || currentUser.images }}
        matchedUser={matchData?.matchedUser}
        onSendMessage={() => {
          const convId = matchData?.conversationId;
          setMatchData(null);
          if (convId) {
            navigation?.navigate?.('Messages', { screen: 'Chat', params: { conversationId: convId } });
          }
        }}
        onKeepSwiping={() => setMatchData(null)}
      />
    </View>
  );
};

const getStyles = (colors, insets, isDark) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  cardArea: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: insets.top + 104,
    paddingBottom: 6,
    position: 'relative',
  },
  cardLayer: {
    flex: 1,
    marginHorizontal: 6,
    marginTop: 8,
  },
  nextCard: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    overflow: 'hidden',
  },

  // ── Top bar — floats over card ──
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 0,
    zIndex: 20,
    backgroundColor: 'transparent',
  },
  headerSideSlot: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: colors.gray300,
    ...getShadow('md', isDark),
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: FontFamily.script,
    color: colors.black,
    textAlign: 'center',
  },
  crownBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    ...getShadow('md', isDark),
  },

  // ── Filter bar ──
  filterBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 18,
    paddingHorizontal: 4,
  },

  // ── Dating area ──
  datingArea: {
    flex: 1,
  },
  fullCard: {
    flex: 1,
    width: '100%',
  },
  actionOverlay: {
    position: 'absolute',
    bottom: 18,
    left: 8,
    right: 8,
    zIndex: 15,
  },

  // ── Empty state ──
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: insets.top + 24,
    paddingBottom: 24,
  },
  emptyBanner: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
    ...getShadow('lg', isDark),
  },
  emptyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 82, 82, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.15)',
  },
  emptyTitle: {
    ...Typography.h2,
    color: colors.primary,
    marginBottom: 8,
  },
  emptySub: {
    ...Typography.bodySmall,
    fontSize: 15,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    maxWidth: 320,
  },

  // ── Like counter ──
  likeCounter: {
    position: 'absolute',
    bottom: 84,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
    zIndex: 16,
  },
  likeCounterText: {
    fontFamily: FontFamily.semibold,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
});

export default HomeScreen;
