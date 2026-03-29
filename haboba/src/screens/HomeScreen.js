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
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, Typography, FontFamily, getShadow, getSurface, Layout } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FilterBar from '../components/FilterBar';
import ProfileCard from '../components/ProfileCard';
import ActionButtons from '../components/ActionButtons';
import MatchCelebrationOverlay from '../components/MatchCelebrationOverlay';
import HeartBurstOverlay from '../components/HeartBurstOverlay';
import CardSkeleton from '../components/CardSkeleton';
import Button from '../components/Button';
// SpotlightCard removed — spotlights now appear inline in the swipe deck
import InterstitialAd from '../components/InterstitialAd';
import { mockProfiles } from '../data/mockProfiles';
import { imageSource } from '../utils/imageSource';
import { useSubscription, hasUnlimitedLikes, canUseWhispers } from '../payments';
import { useAuth } from '../auth';
import { useCurrentUser } from '../hooks';
import * as discoverService from '../api/services/discoverService';
import { hapticHeavy } from '../utils/haptics';

import { canShowSpotlight, markSpotlightShown } from '../utils/spotlightScheduler';

const MIN_DECK_CARDS = 10;
const shuffleArray = (arr) => {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const buildDeck = (mode = 'Dating') => {
  const base = mockProfiles.filter((p) => {
    if (!p || !p.id || !p.name || !p.images?.length) return false;
    // Filter by mode: 'Both' profiles show in either mode
    if (mode === 'Dating') return p.mode === 'Dating' || p.mode === 'Both';
    if (mode === 'Social') return p.mode === 'Social' || p.mode === 'Both';
    return true;
  });
  if (base.length === 0) return [];
  const deck = base.length >= MIN_DECK_CARDS ? [...base] : (() => {
    const filled = [...base];
    let i = 0;
    while (filled.length < MIN_DECK_CARDS) {
      const source = base[i % base.length];
      filled.push({ ...source, id: `${source.id}-clone-${i}` });
      i += 1;
    }
    return filled;
  })();
  const shuffled = shuffleArray(deck);
  // Inject spotlight profiles every 5 cards
  const withSpotlights = [];
  for (let i = 0; i < shuffled.length; i++) {
    withSpotlights.push(shuffled[i]);
    if ((i + 1) % 5 === 0 && i + 1 < shuffled.length) {
      // Pick a random profile as spotlight
      const spotlightSource = base[Math.floor(Math.random() * base.length)];
      withSpotlights.push({
        ...spotlightSource,
        id: `spotlight-${spotlightSource.id}-${i}`,
        spotlight: true,
      });
    }
  }
  return withSpotlights;
};

// Social-mode filter options (replace dating-specific ones)
const SOCIAL_FILTERS = [
  { label: 'Vibe', hasChevron: true, icon: 'sparkles-outline' },
  { label: 'Distance', hasChevron: true, icon: 'location-outline' },
  { label: 'Ethnicity', hasChevron: true, icon: 'people-outline' },
  { label: 'Interests', hasChevron: true, icon: 'color-palette-outline' },
  { label: 'Verified', hasChevron: false, icon: 'checkmark-circle-outline' },
];

const SOCIAL_FILTER_OPTIONS = {
  Vibe: [
    { label: 'Friendship', value: 'Friendship' },
    { label: 'Networking', value: 'Networking' },
    { label: 'Creative collab', value: 'Creative collab' },
    { label: 'Activity partners', value: 'Activity partners' },
    { label: 'Community', value: 'Community' },
    { label: 'Mentorship', value: 'Mentorship' },
    { label: 'Any vibe', value: 'any' },
  ],
  Distance: [
    { label: '1 mile', value: '1' },
    { label: '5 miles', value: '5' },
    { label: '10 miles', value: '10' },
    { label: '25 miles', value: '25' },
    { label: '50 miles', value: '50' },
    { label: '100 miles', value: '100' },
    { label: 'Anywhere', value: 'any' },
  ],
  Ethnicity: [
    { label: 'Any ethnicity', value: 'any' },
    { label: 'Dinka', value: 'Dinka' },
    { label: 'Nuer', value: 'Nuer' },
    { label: 'Bari', value: 'Bari' },
    { label: 'Shilluk', value: 'Shilluk' },
    { label: 'Azande', value: 'Azande' },
    { label: 'Mundari', value: 'Mundari' },
    { label: 'Other', value: 'Other' },
  ],
  Interests: [
    { label: 'Any interest', value: 'any' },
    { label: 'Tech', value: 'Tech' },
    { label: 'Music', value: 'Music' },
    { label: 'Fashion', value: 'Fashion' },
    { label: 'Fitness', value: 'Fitness' },
    { label: 'Art', value: 'Art' },
    { label: 'Community', value: 'Community' },
    { label: 'Culture', value: 'Culture' },
    { label: 'Faith', value: 'Faith' },
    { label: 'Photography', value: 'Photography' },
    { label: 'Cooking', value: 'Cooking' },
  ],
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

    // Check toggle filters (Active today, New here, Verified)
    const togglePass = !hasToggle || toggleFilters.every((filter) => {
      switch (filter) {
        case 'Active today':
          return profile.distance <= 5;
        case 'New here':
          return Number(profile.id) >= 8;
        case 'Verified':
          return profile.verified === true;
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
          // Allow ±2 inch range for a natural match
          selectionPass = selectionPass && heightInInches >= hVal - 2 && heightInInches <= hVal + 2;
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

    if (selections.Distance) {
      const dVal = selections.Distance;
      if (dVal !== 'any') {
        const maxDist = Number(dVal);
        if (!Number.isNaN(maxDist)) {
          selectionPass = selectionPass && (profile.distance || 0) <= maxDist;
        }
      }
    }

    if (selections.Ethnicity) {
      const eth = selections.Ethnicity;
      if (eth !== 'any') {
        selectionPass = selectionPass && (profile.ethnicity || '').toLowerCase() === eth.toLowerCase();
      }
    }

    if (selections.Education) {
      const edu = selections.Education;
      if (edu !== 'any') {
        selectionPass = selectionPass && (profile.education || '').toLowerCase() === edu.toLowerCase();
      }
    }

    if (selections.Children) {
      const ch = selections.Children;
      if (ch !== 'any') {
        selectionPass = selectionPass && (profile.children || '').toLowerCase().includes(ch.toLowerCase());
      }
    }

    // Social-mode filters
    if (selections.Vibe) {
      const vibe = selections.Vibe;
      if (vibe !== 'any') {
        const socialInt = (profile.socialIntention || profile.intention || '').toLowerCase();
        selectionPass = selectionPass && socialInt.includes(vibe.toLowerCase());
      }
    }

    if (selections.Interests) {
      const interest = selections.Interests;
      if (interest !== 'any') {
        const profileInterests = (profile.interests || []).map((i) => i.toLowerCase());
        selectionPass = selectionPass && profileInterests.includes(interest.toLowerCase());
      }
    }

    return togglePass && selectionPass;
  });
};

const HomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { consumeSuperLike, consumeWhisper, superLikes, whispers, hasTier, tier } = useSubscription();
  const { session, user: authUser } = useAuth();
  const { currentUser } = useCurrentUser();
  const [profiles, setProfiles] = useState(() => buildDeck('Dating'));
  const [unfilteredProfiles, setUnfilteredProfiles] = useState(null); // holds API or base profiles before filtering
  const [activeFilters, setActiveFilters] = useState([]);
  const [filterSelections, setFilterSelections] = useState({});
  const styles = useMemo(() => getStyles(colors, insets, isDark), [colors, insets, isDark]);
  const [matchData, setMatchData] = useState(null);
  // Default mode from user's intention preference (Dating or Social)
  const defaultMode = currentUser?.preferences?.mode === 'Social' ? 'Social' : 'Dating';
  const [mode, setMode] = useState(defaultMode);
  const [lastSwiped, setLastSwiped] = useState(null); // { profile, direction }
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [heartBurst, setHeartBurst] = useState(null); // { x, y }
  const [showInterstitial, setShowInterstitial] = useState(false);
  const swipeCountRef = useRef(0);
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [likeStatus, setLikeStatus] = useState(null); // { used, limit, remaining }
  const [showWhisperComposer, setShowWhisperComposer] = useState(false);
  const [whisperDraft, setWhisperDraft] = useState('');
  const setModeAndPersist = useCallback((nextMode) => {
    setMode(nextMode);
    // Reset filters when switching modes — dating and social have different filter sets
    setActiveFilters([]);
    setFilterSelections({});
    // Rebuild local deck for the new mode
    const newDeck = buildDeck(nextMode);
    setUnfilteredProfiles(null);
    setProfiles(newDeck);
    AsyncStorage.setItem('@haboba_mode', nextMode).catch(() => {});
  }, []);
  // Check if spotlight should show
  useEffect(() => {
    canShowSpotlight().then((canShow) => {
      if (canShow && hasTier('junub')) {
        setShowSpotlight(true);
        markSpotlightShown();
      }
    });
  }, [hasTier]);

  // Read persisted mode on mount and when screen regains focus (picks up FAB changes)
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem('@haboba_mode').then((stored) => {
        if ((stored === 'Social' || stored === 'Dating') && stored !== mode) {
          setModeAndPersist(stored);
        }
      });
    }, [mode, setModeAndPersist])
  );

  const profileCardRef = useRef(null);
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;
  const topMotion = useRef(new Animated.Value(0)).current;
  const apiCursorRef = useRef(null);

  // Fetch profiles from API on mount and when mode changes
  useEffect(() => {
    if (!session) { setIsLoadingProfiles(false); return; }
    setIsLoadingProfiles(true);
    discoverService.getProfiles({ mode: mode.toLowerCase() }).then(({ profiles: apiProfiles, nextCursor }) => {
      // Only use profiles that have at least one image (mirrors buildDatingDeck filter)
      const withImages = apiProfiles.filter((p) => p.images && p.images.length > 0);
      if (withImages.length > 0) {
        setUnfilteredProfiles(withImages);
        setProfiles(applyFilters(withImages, activeFilters, filterSelections));
        apiCursorRef.current = nextCursor;
      }
    }).catch((err) => {
      // Keep mock data on failure
      if (__DEV__) console.warn('Profile fetch failed:', err);
    }).finally(() => setIsLoadingProfiles(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, mode]);

  // Fetch daily like status
  useEffect(() => {
    if (!session) return;
    discoverService.getDailyLikeStatus().then(setLikeStatus).catch((err) => {
      if (__DEV__) console.warn('Daily like status fetch failed:', err);
    });
  }, [session]);

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
        const baseDeck = unfilteredProfiles || buildDeck(mode);
        setProfiles(applyFilters(baseDeck, activeFilters, filterSelections));
      });
      return unsubscribe;
    }, [navigation, activeFilters, filterSelections, unfilteredProfiles, mode])
  );

  useEffect(() => {
    const baseDeck = unfilteredProfiles || buildDeck(mode);
    const filteredDeck = applyFilters(baseDeck, activeFilters, filterSelections);
    setProfiles(filteredDeck);
  }, [activeFilters, filterSelections, unfilteredProfiles, mode]);


  const handleSwipe = useCallback((direction) => {
    const currentProfiles = profilesRef.current;
    const swipedProfile = currentProfiles[0];
    if (!swipedProfile) return;

    // Check daily like limit for right-swipes (free users)
    if (direction === 'right' && likeStatus && likeStatus.remaining <= 0 && !hasUnlimitedLikes(tier || 'free')) {
      Alert.alert('Daily Limit Reached', 'You\'ve used all your likes for today.', [
        { text: 'Upgrade', onPress: () => navigation?.navigate?.('Elite') },
        { text: 'OK', style: 'cancel' },
      ]);
      return;
    }

    setLastSwiped({ profile: swipedProfile, direction });
    setProfiles((prev) => prev.slice(1));


    // Show interstitial ad every 10 swipes for free users
    swipeCountRef.current += 1;
    if (swipeCountRef.current % 10 === 0 && !hasTier('plus')) {
      setShowInterstitial(true);
    }

    // Record swipe via API (fire-and-forget)
    if (session && swipedProfile?.id) {
      const type = direction === 'right' ? 'like' : 'pass';
      discoverService.recordSwipe(swipedProfile.id, type).then((result) => {
        if (result?.match) {
          hapticHeavy();
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
    if (currentProfiles.length <= 3 && session && apiCursorRef.current) {
      discoverService.getProfiles({ cursor: apiCursorRef.current, mode: mode.toLowerCase() }).then(({ profiles: more, nextCursor }) => {
        const withImages = more.filter((p) => p.images && p.images.length > 0);
        if (withImages.length > 0) {
          setProfiles((prev) => [...prev, ...withImages]);
          apiCursorRef.current = nextCursor;
        }
      }).catch((err) => {
        if (__DEV__) console.warn('Auto-fetch more profiles failed:', err);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, likeStatus, tier, navigation, mode]);

  // In Social mode, swap in social-specific fields so the card shows the right info
  const adaptProfileForMode = useCallback((p) => {
    if (!p || mode !== 'Social') return p;
    return {
      ...p,
      bio: p.socialBio || p.bio,
      intention: p.socialIntention || p.intention,
      lookingFor: p.socialIntention || p.lookingFor,
    };
  }, [mode]);

  const currentProfile = profiles.length > 0 ? adaptProfileForMode(profiles[0]) : null;
  const hasValidProfile = !!(currentProfile && currentProfile.name && currentProfile.images?.length);

  const handleExpand = useCallback((profile) => {
    navigation?.navigate?.('ProfileDetail', { profile });
  }, [navigation]);

  const handleSuperLike = useCallback(() => {
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
  }, [superLikes, consumeSuperLike, profileCardRef, handleSwipe, navigation]);

  const handleRewind = useCallback(() => {
    if (!hasTier('plus')) {
      Alert.alert('JuNubin+ Feature', 'Rewind requires JuNubin+ or higher.', [
        { text: 'Upgrade', onPress: () => navigation?.navigate?.('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    if (!lastSwiped) return;
    // Prepend the last swiped profile back and animate rewind
    setProfiles((prev) => [lastSwiped.profile, ...prev]);
    setLastSwiped(null);
    setTimeout(() => {
      profileCardRef.current?.rewindFrom?.(lastSwiped.direction);
    }, 50);
  }, [hasTier, navigation, lastSwiped]);

  const handleMessage = useCallback(() => {
    if (!canUseWhispers(tier || 'free')) {
      Alert.alert('Premium Feature', 'Whispers are available on JuNubin+ and higher.', [
        { text: 'Upgrade', onPress: () => navigation?.navigate?.('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    if (whispers <= 0) {
      Alert.alert('No Whispers', 'You\'re out of whispers!', [
        { text: 'Upgrade', onPress: () => navigation?.navigate?.('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    setShowWhisperComposer(true);
  }, [tier, whispers, navigation]);

  const handleSendWhisper = useCallback(() => {
    const text = whisperDraft.trim();
    if (!text) {
      Alert.alert('Write a whisper', 'Please type a whisper before sending.');
      return;
    }
    if (!consumeWhisper()) {
      Alert.alert('No Whispers', 'You\'re out of whispers!');
      return;
    }
    setShowWhisperComposer(false);
    setWhisperDraft('');
    Alert.alert('Whisper Sent!', `Your whisper was sent: "${text}"`);
    if (profileCardRef.current?.swipe) {
      profileCardRef.current.swipe('right');
    } else {
      handleSwipe('right');
    }
  }, [whisperDraft, consumeWhisper, handleSwipe]);

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

  const handlePass = useCallback(() => {
    profileCardRef.current?.swipe ? profileCardRef.current.swipe('left') : handleSwipe('left');
  }, [handleSwipe]);

  const handleLike = useCallback(() => {
    profileCardRef.current?.swipe ? profileCardRef.current.swipe('right') : handleSwipe('right');
  }, [handleSwipe]);

  const handleReaction = useCallback((emoji) => {
    // Send reaction as a super-like with the emoji attached
    if (currentProfile?.id && session) {
      discoverService.recordSwipe(currentProfile.id, 'super_like').catch((err) => {
        if (__DEV__) console.warn('Reaction swipe failed:', err);
      });
    }
    if (profileCardRef.current?.swipe) {
      profileCardRef.current.swipe('right');
    } else {
      handleSwipe('right');
    }
  }, [currentProfile, session, handleSwipe]);

  const handleDoubleTap = useCallback(({ x, y, profile }) => {
    setHeartBurst({ x, y });
    // Trigger a like on double-tap
    if (profileCardRef.current?.swipe) {
      profileCardRef.current.swipe('right');
    } else {
      handleSwipe('right');
    }
  }, [handleSwipe]);

  const handleSettingsPress = useCallback(() => {
    navigation?.navigate?.('Preferences');
  }, [navigation]);

  const overlayCurrentUser = useMemo(() => ({
    name: authUser?.displayName || currentUser?.name,
    images: authUser?.photos?.map((p) => p.url) || currentUser?.images,
  }), [authUser?.displayName, authUser?.photos, currentUser?.name, currentUser?.images]);

  const handleMatchSendMessage = useCallback(() => {
    const convId = matchData?.conversationId;
    setMatchData(null);
    if (convId) {
      navigation?.navigate?.('Chat', { conversationId: convId });
    }
  }, [matchData?.conversationId, navigation]);

  const handleKeepSwiping = useCallback(() => setMatchData(null), []);

  // Prefetch images for the next few profiles so they're cached when the card mounts
  const prefetchedRef = useRef(new Set());
  useEffect(() => {
    profiles.slice(1, 4).forEach((p) => {
      const firstImg = p?.images?.[0];
      const uri = typeof firstImg === 'string' ? firstImg : firstImg?.uri;
      if (uri && uri.startsWith('http') && !prefetchedRef.current.has(uri)) {
        prefetchedRef.current.add(uri);
        ExpoImage.prefetch(uri).catch(() => {});
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProfile?.id]);

  // Next card in the stack (pre-rendered so its image is already decoded)
  const nextProfile = profiles.length > 1 ? adaptProfileForMode(profiles[1]) : null;
  const hasNextProfile = !!(nextProfile && nextProfile.name && nextProfile.images?.length);
  // Next card is always at full opacity/scale — it sits behind the current card
  // so it's only visible during swiping. No animated reveal needed.

  return (
    <View style={styles.screen}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ─── DATING AREA ─── */}
      <View style={styles.datingArea}>
        {isLoadingProfiles ? (
          <View style={styles.cardArea}>
            <View style={styles.cardLayer}>
              <CardSkeleton />
            </View>
          </View>
        ) : hasValidProfile ? (
          <>
            {/* Card with directional entry animation */}
            <View style={styles.cardArea}>
              <View style={styles.cardLayer}>
                {/* Deck peek — 2nd card behind (deepest) */}
                {profiles.length > 2 && (
                  <View style={styles.deckPeek2} pointerEvents="none">
                    <View style={styles.deckPeekCard} />
                  </View>
                )}
                {/* Deck peek — 1st card behind */}
                {hasNextProfile && (
                  <View style={styles.deckPeek1} pointerEvents="none">
                    <ProfileCard
                      profile={nextProfile}
                      style={styles.fullCard}
                    />
                  </View>
                )}
                {/* Current card — swipeable, on top */}
                <View style={styles.currentCard}>
                  <ProfileCard
                    key={currentProfile.id}
                    ref={profileCardRef}
                    profile={currentProfile}
                    onSwipe={handleSwipe}
                    onExpand={handleExpand}
                    onDoubleTap={handleDoubleTap}
                    style={styles.fullCard}
                  />
                </View>
              </View>
              {/* Heart burst on double-tap */}
              {heartBurst && (
                <HeartBurstOverlay
                  x={heartBurst.x}
                  y={heartBurst.y}
                  onComplete={() => setHeartBurst(null)}
                />
              )}
            </View>

            {/* Action buttons overlaid at bottom of card */}
            <View style={styles.actionOverlay}>
              <ActionButtons
                onRewind={handleRewind}
                onPass={handlePass}
                onLike={handleLike}
                onSuperLike={handleSuperLike}
                onMessage={handleMessage}
                onReaction={handleReaction}
              />
            </View>
          </>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyBanner}>
              <View style={styles.emptyIconRow}>
                <View style={styles.emptyCircle}>
                  <Ionicons name="people-outline" size={28} color={colors.accent} />
                </View>
              </View>
              <Text style={styles.emptyTitle}>
                {mode === 'Social' ? 'No more people' : 'No more profiles'}
              </Text>
              <Text style={styles.emptySub}>
                {mode === 'Social'
                  ? 'You\'ve seen everyone looking to socialize nearby. Check back later or adjust your filters.'
                  : 'You\'ve seen everyone nearby. Check back later or adjust your filters to see more people.'}
              </Text>
              <Button
                title="Adjust Filters"
                variant="primary"
                size="sm"
                fullWidth={false}
                onPress={() => navigation?.navigate?.('Preferences')}
                style={{ paddingHorizontal: 32 }}
              />
              {!hasTier('plus') && (
                <TouchableOpacity
                  style={styles.upgradeInline}
                  onPress={() => navigation?.navigate?.('Elite')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.upgradeInlineText}>Upgrade to see more profiles</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.gray600} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {/* ─── OVERLAY (Header + Filters) ─── */}
      <View style={styles.overlay} pointerEvents="box-none">
        {/* ─── TOP BAR — floats over card ─── */}
        <Animated.View
          style={[styles.topBar, { top: insets.top }]}
          pointerEvents="box-none"
        >
          {/* Left — Mode label */}
          <View style={styles.headerLeft}>
            <Text style={styles.headerModeLabel}>{mode}</Text>
          </View>

          {/* Right — Boost + Avatar */}
          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={() => navigation?.navigate?.('Boost')}
              activeOpacity={0.85}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.headerIconBtn}
            >
              <Ionicons name="flash" size={18} color={colors.gold} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation?.navigate?.('Profile')}
              activeOpacity={0.85}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Image source={imageSource(currentUser?.images?.[0])} style={styles.avatar} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ─── FILTER BAR — below top bar ─── */}
        <Animated.View
          style={[
            styles.filterBarWrap,
            {
            top: insets.top + Layout.headerHeight + 2,
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
            onSettingsPress={handleSettingsPress}
            activeFilters={activeFilters}
            filterSelections={filterSelections}
            onFilterSelect={handleFilterSelect}
            filters={mode === 'Social' ? SOCIAL_FILTERS : undefined}
            options={mode === 'Social' ? SOCIAL_FILTER_OPTIONS : undefined}
          />
        </Animated.View>
      </View>

      {/* ─── LIKE COUNTER — subtle indicator near bottom ─── */}
      {likeStatus && !hasUnlimitedLikes(tier || 'free') && likeStatus.remaining < likeStatus.limit && (
        <View style={styles.likeCounter}>
          <Ionicons name="heart" size={12} color={likeStatus.remaining <= 5 ? colors.accent : 'rgba(255,255,255,0.6)'} />
          <Text style={[styles.likeCounterText, likeStatus.remaining <= 5 && { color: colors.accent }]}>
            {likeStatus.remaining} likes left today
          </Text>
        </View>
      )}

      {/* ─── MATCH CELEBRATION OVERLAY ─── */}
      <MatchCelebrationOverlay
        visible={!!matchData}
        currentUser={overlayCurrentUser}
        matchedUser={matchData?.matchedUser}
        onSendMessage={handleMatchSendMessage}
        onKeepSwiping={handleKeepSwiping}
      />

      {/* ─── WHISPER COMPOSER (premium) ─── */}
      <Modal
        visible={showWhisperComposer}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowWhisperComposer(false);
          setWhisperDraft('');
        }}
      >
        <View style={styles.whisperOverlay}>
          <View style={styles.whisperCard}>
            <Text style={styles.whisperTitle}>Send Whisper</Text>
            <Text style={styles.whisperSubtitle}>Premium private intro</Text>
            <TextInput
              style={styles.whisperInput}
              value={whisperDraft}
              onChangeText={setWhisperDraft}
              placeholder="Write a quick intro..."
              placeholderTextColor={colors.gray400}
              multiline
              maxLength={160}
              autoFocus
            />
            <View style={styles.whisperFooter}>
              <Text style={styles.whisperCount}>{whispers} left</Text>
              <View style={styles.whisperActions}>
                <TouchableOpacity
                  style={styles.whisperCancel}
                  onPress={() => {
                    setShowWhisperComposer(false);
                    setWhisperDraft('');
                  }}
                >
                  <Text style={styles.whisperCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.whisperSend, !whisperDraft.trim() && styles.whisperSendDisabled]}
                  onPress={handleSendWhisper}
                  disabled={!whisperDraft.trim()}
                >
                  <Text style={styles.whisperSendText}>Send</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── INTERSTITIAL AD (free tier, every 5 swipes) ─── */}
      <InterstitialAd
        visible={showInterstitial}
        onClose={() => setShowInterstitial(false)}
        onUpgrade={() => { setShowInterstitial(false); navigation?.navigate?.('Elite'); }}
        colors={colors}
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
    paddingHorizontal: 6,
    paddingTop: insets.top + Layout.headerHeight + Layout.filterGap + 36,
    paddingBottom: 24,
    position: 'relative',
  },
  cardLayer: {
    flex: 1,
    marginHorizontal: 2,
    marginTop: 4,
  },
  // Visible deck stack
  currentCard: {
    flex: 1,
    zIndex: 3,
  },
  deckPeek1: {
    ...StyleSheet.absoluteFillObject,
    top: 8,
    left: 8,
    right: 8,
    borderRadius: 24,
    overflow: 'hidden',
    transform: [{ scale: 0.96 }],
    zIndex: 2,
    opacity: 0.7,
  },
  deckPeek2: {
    ...StyleSheet.absoluteFillObject,
    top: 16,
    left: 14,
    right: 14,
    borderRadius: 24,
    overflow: 'hidden',
    transform: [{ scale: 0.92 }],
    zIndex: 1,
    opacity: 0.4,
  },
  deckPeekCard: {
    flex: 1,
    backgroundColor: colors.gray300,
    borderRadius: 24,
  },

  // ── Overlay layer — header + filters ──
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 20,
    pointerEvents: 'box-none',
  },
  // ── Top bar — floats over card ──
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: Layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 2,
    zIndex: 20,
    backgroundColor: 'transparent',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerModeLabel: {
    fontSize: 34,
    fontFamily: FontFamily.script,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
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
    bottom: 12,
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
    ...getSurface('card', colors, isDark),
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  emptyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accentTint08,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.accentTint15,
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
  upgradeInline: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  upgradeInlineText: {
    ...Typography.bodySmallMedium,
    color: colors.gray600,
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

  whisperOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  whisperCard: {
    ...getSurface('modal', colors, isDark),
    borderRadius: 20,
    padding: 16,
  },
  whisperTitle: {
    ...Typography.h3,
    color: colors.black,
  },
  whisperSubtitle: {
    ...Typography.caption,
    color: colors.gray600,
    marginTop: 4,
    marginBottom: 12,
  },
  whisperInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.black,
    textAlignVertical: 'top',
    fontFamily: FontFamily.regular,
    fontSize: 15,
  },
  whisperFooter: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  whisperCount: {
    ...Typography.caption,
    color: colors.gray600,
  },
  whisperActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  whisperCancel: {
    borderWidth: 1,
    borderColor: colors.gray300,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  whisperCancelText: {
    ...Typography.bodySmallMedium,
    color: colors.gray600,
  },
  whisperSend: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  whisperSendDisabled: {
    opacity: 0.5,
  },
  whisperSendText: {
    ...Typography.bodySmallMedium,
    color: '#FFFFFF',
  },

});

export default HomeScreen;
