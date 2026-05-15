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
import { useTheme, Typography, FontFamily, getSurface, Layout } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import FilterBar, { DEFAULT_FILTERS } from '../components/FilterBar';
import ProfileCard from '../components/ProfileCard';
import ActionButtons from '../components/ActionButtons';
import MatchCelebrationOverlay from '../components/MatchCelebrationOverlay';
import HeartBurstOverlay from '../components/HeartBurstOverlay';
import CardSkeleton from '../components/CardSkeleton';
import Button from '../components/Button';
// SpotlightCard removed — spotlights now appear inline in the swipe deck
import { mockProfiles } from '../data/__dev__/mockProfiles';
import { DEMO_DATA_ENABLED } from '../config/demoData';
import { POPULAR_TRIBE_KEYS } from '../data/tribes';
import { imageSource } from '../utils/imageSource';
import { useSubscription, hasUnlimitedLikes, canUseWhispers, ALL_FEATURES_FREE, SHOW_PAYMENTS_UI } from '../payments';
import { useAuth } from '../auth';
import { useCurrentUser, useEligibility } from '../hooks';
import * as discoverService from '../api/services/discoverService';
import * as profileService from '../api/services/profileService';
import { hapticHeavy } from '../utils/haptics';
import { enqueueAction, processQueue } from '../utils/offlineQueue';
import { useNetworkStatus } from '../utils/useNetworkStatus';
import PeopleMap from '../components/PeopleMap';
import {
  promptForPushPermission,
  getNotificationPermissionStatus,
} from '../utils/notifications';

import { canShowSpotlight, markSpotlightShown } from '../utils/spotlightScheduler';

// Storage key — bump if we ever want to re-ask everyone (e.g. switching
// providers, big onboarding redesign).
const FIRST_MATCH_NOTIFY_PROMPT_KEY = '@junubin/first_match_notify_prompt_v1';

const MIN_DECK_CARDS = 10;
const shuffleArray = (arr) => {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Build the demo deck for the given mode. Same filter rule the
// server-side discover function uses (`Both` profiles surface in
// either mode). Pads to MIN_DECK_CARDS by cloning entries so a fresh
// install doesn't run out of cards after three swipes.
const buildDeck = (mode = 'Dating') => {
  const base = mockProfiles.filter((p) => {
    if (!p || !p.id || !p.name || !p.photos?.length) return false;
    if (mode === 'Dating') return p.mode === 'Dating' || p.mode === 'Both';
    if (mode === 'Social') return p.mode === 'Social' || p.mode === 'Both';
    return true;
  }).map((p) => ({ ...p, images: p.photos }));
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
  // Inject spotlight profiles every 5 cards.
  const withSpotlights = [];
  for (let i = 0; i < shuffled.length; i++) {
    withSpotlights.push(shuffled[i]);
    if ((i + 1) % 5 === 0 && i + 1 < shuffled.length) {
      const src = base[Math.floor(Math.random() * base.length)];
      withSpotlights.push({ ...src, images: src.photos, id: `spotlight-${src.id}-${i}`, spotlight: true });
    }
  }
  return withSpotlights;
};

// Swipe-deck fallback while the discover API replies or returns []. In
// demo mode (TestFlight + local dev), seed with the demo roster so
// the deck isn't empty before real users come online. Once enough
// real users sign up, flip DEMO_DATA_ENABLED off in src/config/demoData.js.
const getFallbackDeck = (mode = 'Dating') =>
  DEMO_DATA_ENABLED ? buildDeck(mode) : [];

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
  // Pull from the central tribe registry so this list stays in sync with
  // the rest of the app (profile picker, FilterBar, dating-mode filter).
  // POPULAR_TRIBE_KEYS already includes "Other"; the full 64-tribe list
  // (ALL_TRIBE_KEYS) is too many chips for a filter row.
  Ethnicity: [
    { label: 'Any ethnicity', value: 'any' },
    ...POPULAR_TRIBE_KEYS.map((key) => ({ label: key, value: key })),
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
        case 'Active today': {
          // Real activity check: profiles with `lastActiveAt` within 24h, or
          // mock profiles that carry an `activity === 'active'` flag.
          if (profile.activity === 'active') return true;
          if (profile.lastActiveAt) {
            const hoursAgo = (Date.now() - new Date(profile.lastActiveAt).getTime()) / 3.6e6;
            return hoursAgo <= 24;
          }
          return false;
        }
        case 'New here': {
          // Real "new" check: created in the last 7 days. Falls back to a
          // truthy `isNew` flag for mock profiles.
          if (profile.isNew === true) return true;
          if (profile.createdAt) {
            const daysAgo = (Date.now() - new Date(profile.createdAt).getTime()) / 8.64e7;
            return daysAgo <= 7;
          }
          return false;
        }
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

const HomeScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { consumeSuperLike, consumeWhisper, superLikes, whispers, hasTier, tier } = useSubscription();
  const { session, user: authUser, refreshUser } = useAuth();
  const { currentUser } = useCurrentUser();
  // Single eligibility gate for swipe-deck dating actions. Reasons that
  // bubble back: 'survey_required' shows the SurveyNudgeModal; 'banned'
  // / 'restricted' show alerts; tier_required falls through to the
  // existing paywall paths in handleSuperLike / handleSendWhisper.
  const { gate, nudge: surveyNudge } = useEligibility();
  const [profiles, setProfiles] = useState(() => getFallbackDeck('Dating'));
  const [unfilteredProfiles, setUnfilteredProfiles] = useState(null); // holds API or base profiles before filtering
  const [activeFilters, setActiveFilters] = useState([]);
  const [filterSelections, setFilterSelections] = useState({});
  // Track whether persisted filter state has been hydrated from AsyncStorage.
  // We gate the persistence write effect on this so the hydration round-trip
  // can't be clobbered by an initial empty-default save before the read lands.
  const filtersHydratedRef = useRef(false);
  const styles = useMemo(() => getStyles(colors, insets, isDark), [colors, insets, isDark]);
  const [matchData, setMatchData] = useState(null);
  // Default mode — Socialize first. Real survey-driven mode lands later
  // via the effect below once `useCurrentUser` resolves the API profile.
  const defaultMode = currentUser?.preferences?.mode === 'Dating' ? 'Dating' : 'Social';
  const [mode, setMode] = useState(defaultMode);
  // 'deck' = the swipe-card stack (default Connect view).
  // 'map'  = PeopleMap overlay. State is local, not persisted —
  // every cold start brings the user back to the deck since the
  // deck is the canonical surface and the map is a side trip.
  const [viewMode, setViewMode] = useState('deck');
  // Track whether the user has manually toggled mode this session. If they
  // have, we stop overwriting their choice when `currentUser.preferences.mode`
  // updates async — they pulled the lever, respect it.
  const userToggledModeRef = useRef(false);
  const [lastSwiped, setLastSwiped] = useState(null); // { profile, direction }
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(true);
  const [heartBurst, setHeartBurst] = useState(null); // { x, y }
  const swipeCountRef = useRef(0);
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [likeStatus, setLikeStatus] = useState(null); // { used, limit, remaining }
  const [showWhisperComposer, setShowWhisperComposer] = useState(false);
  const [whisperDraft, setWhisperDraft] = useState('');
  const setModeAndPersist = useCallback((nextMode) => {
    userToggledModeRef.current = true;
    setMode(nextMode);
    // Reset filters when switching modes — dating and social have different filter sets
    setActiveFilters([]);
    setFilterSelections({});
    // Reset deck for the new mode. The mode-aware getProfiles effect
    // will re-fetch immediately and populate; until then the loading
    // skeleton (or empty state) renders.
    setUnfilteredProfiles(null);
    setProfiles(getFallbackDeck(nextMode));
    // Local fast-path cache — survives cold starts before the network
    // round-trip lands.
    AsyncStorage.setItem('@junubin_mode', nextMode).catch(() => {});
    // Server source-of-truth — Profile.appMode syncs the toggle across
    // all devices the user signs in on (00016 migration). Falls back
    // silently if the migration hasn't been applied yet.
    if (session) {
      const dbValue = nextMode === 'Dating' ? 'dating' : 'social';
      profileService
        .updateProfile({ appMode: dbValue })
        // Propagate the toggle to other tabs (MessagesScreen reads
        // currentUser.preferences.mode) by refreshing the User row in
        // AuthContext. Without this, flipping the toggle here only
        // affects HomeScreen's local state until the next cold start
        // or background→foreground refresh, and the inbox sort lags.
        .then(() => { try { refreshUser?.(); } catch {} })
        .catch(() => {});
    }
  }, [session, refreshUser]);

  // When the real profile lands (post-ProfileSetup), `currentUser.preferences.mode`
  // updates from the mock fallback to the survey-derived value. The local `mode`
  // state was initialized once from the mock — sync it to the real value here,
  // unless the user has already manually toggled this session.
  useEffect(() => {
    const apiMode = currentUser?.preferences?.mode;
    if (!apiMode || userToggledModeRef.current) return;
    if (apiMode !== mode) {
      setMode(apiMode);
      setActiveFilters([]);
      setFilterSelections({});
      setUnfilteredProfiles(null);
      setProfiles(getFallbackDeck(apiMode));
    }
  }, [currentUser?.preferences?.mode, mode]);
  // Check if spotlight should show
  useEffect(() => {
    canShowSpotlight().then((canShow) => {
      if (canShow && hasTier('junub')) {
        setShowSpotlight(true);
        markSpotlightShown();
      }
    }).catch(() => {});
  }, [hasTier]);

  // Hydrate persisted filter selections on mount so the user's last
  // chips/selections survive a cold start. Falls through to the default
  // empty state on missing key, parse error, or shape mismatch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('@junubin_home_filters');
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed.activeFilters)) {
              setActiveFilters(parsed.activeFilters);
            }
            if (parsed.filterSelections && typeof parsed.filterSelections === 'object') {
              setFilterSelections(parsed.filterSelections);
            }
          }
        }
      } catch {
        // Fall through to default state on hydration error.
      } finally {
        if (!cancelled) filtersHydratedRef.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist filter selections, debounced so a flurry of taps coalesces
  // into a single write. Gated on `filtersHydratedRef` so the initial
  // empty-default render can't overwrite the hydration round-trip.
  useEffect(() => {
    if (!filtersHydratedRef.current) return;
    const handle = setTimeout(() => {
      AsyncStorage.setItem(
        '@junubin_home_filters',
        JSON.stringify({ activeFilters, filterSelections }),
      ).catch(() => {});
    }, 500);
    return () => clearTimeout(handle);
  }, [activeFilters, filterSelections]);

  // Mode toggle is now in the header — no need to poll AsyncStorage

  const profileCardRef = useRef(null);
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;
  const topMotion = useRef(new Animated.Value(0)).current;
  const apiCursorRef = useRef(null);

  // Advance deck when returning from ProfileDetail after a reaction
  useEffect(() => {
    const swipeAction = route.params?.swipeAction;
    const swipedId = route.params?.swipedProfileId;
    if (swipeAction && swipedId) {
      // Remove the swiped profile from the deck
      setProfiles((prev) => prev.filter((p) => p.id !== swipedId));
      setLastSwiped({ profile: profilesRef.current.find((p) => p.id === swipedId) || {}, direction: swipeAction });
      // Clear the params so it doesn't re-trigger
      navigation.setParams({ swipeAction: undefined, swipedProfileId: undefined });
    }
  }, [route.params?.swipeAction, route.params?.swipedProfileId, navigation]);

  // Fetch profiles from API on mount and when mode changes. The user's
  // survey-derived preferences are passed through so the algorithm can
  // pre-filter on gender / age before profiles even reach the device —
  // earlier the call only sent `mode`, which meant a dating user looking
  // for women could be served men until they manually set a filter.
  useEffect(() => {
    if (!session) { setIsLoadingProfiles(false); return; }
    setIsLoadingProfiles(true);

    const prefs = currentUser?.preferences || {};
    // 'Men' → 'man', 'Women' → 'woman', anything else → no gender filter
    // (matches User.gender enum values: man / woman / non_binary / other).
    const genderMap = { Men: 'man', Women: 'woman', Man: 'man', Woman: 'woman' };
    const targetGender = mode === 'Dating' ? genderMap[prefs.lookingFor] : undefined;
    const [minAge, maxAge] = Array.isArray(prefs.ageRange) ? prefs.ageRange : [];

    discoverService.getProfiles({
      mode: mode.toLowerCase(),
      ...(targetGender ? { gender: targetGender } : {}),
      ...(minAge ? { minAge } : {}),
      ...(maxAge ? { maxAge } : {}),
    }).then(({ profiles: apiProfiles, nextCursor }) => {
      // Only use profiles that have at least one image (mirrors buildDatingDeck filter)
      const withImages = apiProfiles.filter((p) => p.images && p.images.length > 0);
      if (withImages.length > 0) {
        setUnfilteredProfiles(withImages);
        setProfiles(applyFilters(withImages, activeFilters, filterSelections));
        apiCursorRef.current = nextCursor;
      }
    }).catch((err) => {
      // On failure we leave whatever's already in `profiles`. In dev that's
      // the seeded mock deck; in prod it's [] and the empty state renders.
      // We don't surface a toast here because the loading effect re-runs
      // on focus and on mode change — most users won't even notice.
      if (__DEV__) console.warn('Profile fetch failed:', err);
    }).finally(() => setIsLoadingProfiles(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, mode, currentUser?.preferences?.lookingFor, currentUser?.preferences?.ageRange]);

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

  // Re-fetch the discover deck on focus when the user has likely
  // changed their relationships with others (block, unmatch, follow).
  // The discover Edge Function honors all of those server-side, so a
  // simple refetch is enough — we don't need to track per-action
  // signals on the client.
  //
  // Skipped on the very first focus because the deck is already being
  // loaded by the mount effect; re-running it would be a duplicate
  // network call. Subsequent focuses (returning from Chat, Profile,
  // Settings, etc.) trigger a refresh.
  const initialFocusRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (initialFocusRef.current) {
        initialFocusRef.current = false;
        return undefined;
      }
      if (!session) return undefined;
      const prefs = currentUser?.preferences || {};
      const genderMap = { Men: 'man', Women: 'woman', Man: 'man', Woman: 'woman' };
      const targetGender = mode === 'Dating' ? genderMap[prefs.lookingFor] : undefined;
      const [minAge, maxAge] = Array.isArray(prefs.ageRange) ? prefs.ageRange : [];
      discoverService.getProfiles({
        mode: mode.toLowerCase(),
        ...(targetGender ? { gender: targetGender } : {}),
        ...(minAge ? { minAge } : {}),
        ...(maxAge ? { maxAge } : {}),
      }).then(({ profiles: apiProfiles, nextCursor }) => {
        const withImages = (apiProfiles || []).filter((p) => p.images && p.images.length > 0);
        if (withImages.length === 0) return;
        setUnfilteredProfiles(withImages);
        setProfiles(applyFilters(withImages, activeFilters, filterSelections));
        apiCursorRef.current = nextCursor;
      }).catch(() => {});
      return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session, mode, currentUser?.preferences?.lookingFor, currentUser?.preferences?.ageRange?.[0], currentUser?.preferences?.ageRange?.[1]]),
  );

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener('tabPress', () => {
        const baseDeck = unfilteredProfiles || getFallbackDeck(mode);
        setProfiles(applyFilters(baseDeck, activeFilters, filterSelections));
      });
      return unsubscribe;
    }, [navigation, activeFilters, filterSelections, unfilteredProfiles, mode])
  );

  // Drain queued offline swipes when the network comes back. Each
  // queued swipe was enqueued in the catch-block above; replaying it
  // hits the same recordSwipe path. The dedupe set inside the queue
  // (00030-aligned actionIdentity) makes this safe to call on every
  // reconnect even if multiple screens trigger it.
  const { isConnected } = useNetworkStatus();
  useEffect(() => {
    if (!isConnected || !session) return;
    processQueue(async (action) => {
      if (action.kind !== 'swipe') return;
      // The server-side swipe endpoint is idempotent on
      // (fromUserId, toUserId) — re-issuing the same swipe just
      // refreshes the existing row. So we don't need to dedupe
      // against the user's swipe history here.
      await discoverService.recordSwipe(action.toUserId, action.type, { mode: action.mode });
    }).catch(() => {});
  }, [isConnected, session]);

  useEffect(() => {
    const baseDeck = unfilteredProfiles || getFallbackDeck(mode);
    const filteredDeck = applyFilters(baseDeck, activeFilters, filterSelections);
    setProfiles(filteredDeck);
  }, [activeFilters, filterSelections, unfilteredProfiles, mode]);


  const handleSwipe = useCallback((direction) => {
    const currentProfiles = profilesRef.current;
    const swipedProfile = currentProfiles[0];
    if (!swipedProfile) return;

    // Survey / moderation gate — only applies to right-swipes (likes).
    // Left-swipes (passes) are unrestricted so users can browse without
    // committing. Server-side try_record_swipe duplicates this check
    // for the like path so a tampered client can't slip through.
    if (direction === 'right' && !gate('swipe_like')) return;

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

    swipeCountRef.current += 1;

    // Record swipe via API (fire-and-forget). Pass the current mode so
    // the swipe/match rows record provenance and MessagesScreen can
    // sort current-mode conversations to the top.
    //
    // On network failure (offline, transient 5xx), queue the swipe so
    // it replays on reconnect. Without this, swipes made offline used
    // to vanish silently — the OfflineBanner showed but the user's
    // intent was lost. Daily-limit 429s are NOT queued; they're a real
    // server-side rejection.
    if (session && swipedProfile?.id) {
      const type = direction === 'right' ? 'like' : 'pass';
      const swipeMode = mode === 'Social' ? 'social' : 'dating';
      discoverService.recordSwipe(swipedProfile.id, type, { mode: swipeMode }).then((result) => {
        if (result?.match) {
          hapticHeavy();
          setMatchData({
            matchedUser: swipedProfile,
            conversationId: result.match.conversation?.id,
          });
        }
        // Reconcile with server-authoritative dailyStatus, not a
        // local optimistic decrement. Avoids the drift the audit
        // flagged: local "remaining" could fall out of sync with the
        // server count under concurrent swipes.
        if (result?.dailyStatus) {
          setLikeStatus(result.dailyStatus);
        } else if (direction === 'right') {
          setLikeStatus((prev) => prev ? { ...prev, used: prev.used + 1, remaining: Math.max(0, prev.remaining - 1) } : prev);
        }
      }).catch((err) => {
        const status = err?.status || err?.statusCode;
        if (status === 429) {
          setLikeStatus((prev) => prev ? { ...prev, remaining: 0 } : { used: 25, limit: 25, remaining: 0 });
          return;
        }
        // Transient errors (no network, 5xx, fetch aborts) → queue
        // for replay. The offline queue dedupes on (toUserId, type)
        // so re-tries don't pile up.
        const transient = !status || (status >= 500 && status < 600) || /network|fetch|timeout/i.test(err?.message || '');
        if (transient) {
          enqueueAction({
            kind: 'swipe',
            toUserId: swipedProfile.id,
            type,
            mode: swipeMode,
            enqueuedAt: Date.now(),
          }).catch(() => {});
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
    // Survey/moderation gate first — never let a paywall mask a
    // missing-profile problem. gate() shows the SurveyNudgeModal /
    // banned alert / restricted alert as appropriate. The free-tier
    // "no super likes" path below remains the paywall route.
    if (!gate('super_like')) return;
    // Free-for-all: skip the balance gate while ALL_FEATURES_FREE is
    // on. consumeSuperLike() also short-circuits to true so the call
    // below stays harmless.
    if (!ALL_FEATURES_FREE && superLikes <= 0) {
      Alert.alert('No Super Likes', 'You\'re out of Super Likes!', [
        { text: 'Get More', onPress: () => navigation?.navigate?.('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    if (!consumeSuperLike()) return;
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

    // Optimistically prepend the profile back so the UI is responsive.
    setProfiles((prev) => [lastSwiped.profile, ...prev]);
    const undoneId = lastSwiped.profile?.id;
    const undoneDirection = lastSwiped.direction;
    setLastSwiped(null);
    setTimeout(() => {
      profileCardRef.current?.rewindFrom?.(undoneDirection);
    }, 50);

    // Best-effort server reversal: undo the swipe so the recipient
    // never sees the like AND refresh the daily-like counter so the
    // user gets the quota back. Both are no-ops if the backend
    // function isn't deployed yet — the client-side rewind still
    // works and the next discover refresh will reconcile state.
    if (session && undoneId) {
      discoverService.undoLastSwipe(undoneId).catch((err) => {
        if (__DEV__) console.warn('Swipe undo failed:', err);
      });
      discoverService.getDailyLikeStatus().then(setLikeStatus).catch(() => {});
    }
  }, [hasTier, navigation, lastSwiped, session]);

  const handleMessage = useCallback(() => {
    // Survey/moderation gate runs FIRST so we don't surface a paywall
    // ("you need JuNubin+") to a user whose actual problem is "your
    // profile isn't filled in". Tier and balance checks come after.
    if (!gate('like_with_whisper')) return;
    if (!canUseWhispers(tier || 'free')) {
      Alert.alert('Premium Feature', 'Whispers are available on JuNubin+ and higher.', [
        { text: 'Upgrade', onPress: () => navigation?.navigate?.('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    if (!ALL_FEATURES_FREE && whispers <= 0) {
      Alert.alert('No Whispers', 'You\'re out of whispers!', [
        { text: 'Upgrade', onPress: () => navigation?.navigate?.('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    setShowWhisperComposer(true);
  }, [gate, tier, whispers, navigation]);

  const handleSendWhisper = useCallback(() => {
    // Gate at composer-open (handleMessage) is the user-facing nudge;
    // re-running it here is a belt-and-brace path in case state
    // shifted between opening and sending. Silent so we don't double-
    // prompt the user with two modals in a row.
    if (!gate('like_with_whisper', { silent: true })) return;
    const text = whisperDraft.trim();
    if (!text) {
      Alert.alert('Write a whisper', 'Please type a whisper before sending.');
      return;
    }
    if (!ALL_FEATURES_FREE && (whispers ?? 0) <= 0) {
      Alert.alert('No Whispers', 'You\'re out of whispers!');
      return;
    }
    const targetId = currentProfile?.id;

    // Optimistic UX: animate the swipe + close the composer immediately.
    setShowWhisperComposer(false);
    setWhisperDraft('');
    if (profileCardRef.current?.swipe) {
      profileCardRef.current.swipe('right');
    } else {
      handleSwipe('right');
    }

    // Network: record the swipe with the whisper attached. Only debit
    // the local credit after the server accepts — that way a network
    // failure refunds the user automatically (their balance never
    // moved). Without a session, we treat it as a local-only demo
    // whisper and skip the consume too.
    if (targetId && session) {
      discoverService
        .recordSwipe(targetId, 'like', { whisper: text, mode: mode === 'Social' ? 'social' : 'dating' })
        .then(() => {
          consumeWhisper();
          Alert.alert('Whisper sent', `If they like you back, they'll see: "${text}"`);
        })
        .catch((err) => {
          if (__DEV__) console.warn('Whisper swipe failed:', err);
          Alert.alert('Whisper not sent', 'We couldn\'t deliver your whisper. Your credit was not used.');
        });
    } else {
      Alert.alert('Whisper sent', `If they like you back, they'll see: "${text}"`);
    }
  }, [whisperDraft, whispers, consumeWhisper, handleSwipe, currentProfile?.id, session]);

  const filtersLocked = !hasTier('plus');
  // Per-pill paywall: lock every label in the active filter set except
  // Age (Social mode has no Age filter, so all of its pills end up
  // locked when on free tier).
  const lockedFilterLabels = useMemo(() => {
    if (!filtersLocked) return [];
    const list = mode === 'Social' ? SOCIAL_FILTERS : DEFAULT_FILTERS;
    return list.filter((f) => f.label !== 'Age').map((f) => f.label);
  }, [filtersLocked, mode]);
  const showFiltersUpgrade = useCallback(() => {
    Alert.alert('JuNubin+ Filters', 'Upgrade to JuNubin+ to unlock advanced filters. Age stays free.', [
      { text: 'Upgrade', onPress: () => navigation?.navigate?.('Elite') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [navigation]);

  const handleFilterPress = useCallback((filterName) => {
    if (filterName === 'More') {
      navigation?.navigate?.('Preferences');
      return;
    }
    // Age stays free; everything else gated
    if (filtersLocked && filterName !== 'Age') {
      showFiltersUpgrade();
      return;
    }
    setActiveFilters((prev) =>
      prev.includes(filterName)
        ? prev.filter((f) => f !== filterName)
        : [...prev, filterName]
    );
  }, [navigation, filtersLocked, showFiltersUpgrade]);

  const handleFilterSelect = useCallback((filterName, value) => {
    if (filtersLocked && filterName !== 'Age') {
      showFiltersUpgrade();
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
  }, [filtersLocked, showFiltersUpgrade]);

  const handlePass = useCallback(() => {
    profileCardRef.current?.swipe ? profileCardRef.current.swipe('left') : handleSwipe('left');
  }, [handleSwipe]);

  const handleLike = useCallback(() => {
    profileCardRef.current?.swipe ? profileCardRef.current.swipe('right') : handleSwipe('right');
  }, [handleSwipe]);

  const handleReaction = useCallback((emoji) => {
    // Send reaction as a super-like with the emoji attached
    if (currentProfile?.id && session) {
      const swipeMode = mode === 'Social' ? 'social' : 'dating';
      discoverService.recordSwipe(currentProfile.id, 'super_like', { mode: swipeMode }).catch((err) => {
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

  // App Review-friendly contextual push prompt. Fires at most once,
  // immediately after the user dismisses their first match overlay —
  // they've just seen something worth being notified about, so the
  // OS dialog has the right framing. We persist a one-shot flag so
  // we don't pester anyone who declined.
  const maybePromptForPush = useCallback(async () => {
    try {
      const seen = await AsyncStorage.getItem(FIRST_MATCH_NOTIFY_PROMPT_KEY);
      if (seen) return;
      await AsyncStorage.setItem(FIRST_MATCH_NOTIFY_PROMPT_KEY, '1');
      const status = await getNotificationPermissionStatus();
      if (status === 'granted' || status === 'denied') return; // already answered, nothing to do
      // Brief in-app pre-prompt before the OS dialog so the user
      // understands the value. Apple guidance: never call the OS
      // permission dialog cold.
      Alert.alert(
        'Get a heads-up next time?',
        'Turn on notifications to know the moment someone matches with you, sends a message, or likes your post.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Turn on', onPress: () => { promptForPushPermission().catch(() => {}); } },
        ],
      );
    } catch {
      // AsyncStorage hiccups shouldn't break the match flow — just
      // skip the prompt this round.
    }
  }, []);

  const handleMatchSendMessage = useCallback(() => {
    const convId = matchData?.conversationId;
    const matched = matchData?.matchedUser;
    setMatchData(null);
    maybePromptForPush();
    if (convId) {
      navigation?.navigate?.('Chat', {
        conversationId: convId,
        match: matched,
        // Tells ChatScreen this is a fresh match — show the "You matched" banner
        // exactly once, then dismiss.
        fromMatch: true,
      });
    }
  }, [matchData?.conversationId, matchData?.matchedUser, navigation, maybePromptForPush]);

  const handleKeepSwiping = useCallback(() => {
    setMatchData(null);
    maybePromptForPush();
  }, [maybePromptForPush]);

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
        {viewMode === 'map' ? (
          <PeopleMap
            mode={mode}
            // Sit the privacy banner + chip row below the HomeScreen
            // header (mode label + map toggle + avatar) so they don't
            // overlap the status bar or the title.
            topInset={insets.top + Layout.headerHeight + 8}
            onPersonPress={(person) => navigation?.navigate?.('ProfileDetail', {
              profile: { ...person, images: person.photos || [] },
            })}
          />
        ) : isLoadingProfiles ? (
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
                hasRewind={!!lastSwiped}
                mode={mode}
              />
            </View>
          </>
        ) : (
          <View style={styles.empty}>
            <View style={styles.emptyBanner}>
              <View style={styles.emptyCircle}>
                <Ionicons name="heart-outline" size={36} color={colors.accent} />
              </View>
              <Text style={styles.emptyTitle}>
                {mode === 'Social' ? 'You\'ve met everyone!' : 'That\'s everyone for now'}
              </Text>
              <Text style={styles.emptySub}>
                {mode === 'Social'
                  ? 'Come back later for new people, or widen your filters to meet more.'
                  : 'New people join daily. Widen your filters or check back soon.'}
              </Text>
              <View style={styles.emptyActions}>
                <Button
                  title="Widen Filters"
                  variant="primary"
                  size="md"
                  fullWidth
                  onPress={() => navigation?.navigate?.('Preferences')}
                />
                <Button
                  title={mode === 'Dating' ? 'Try Social Mode' : 'Try Dating Mode'}
                  variant="outline"
                  size="md"
                  fullWidth
                  onPress={() => setModeAndPersist(mode === 'Dating' ? 'Social' : 'Dating')}
                />
              </View>
              {!hasTier('plus') && (
                <TouchableOpacity
                  style={styles.upgradeInline}
                  onPress={() => navigation?.navigate?.('Elite')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="flash" size={14} color={colors.accent} />
                  <Text style={styles.upgradeInlineText}>Get unlimited with JuNubin+</Text>
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
          {/* Left — Mode label + toggle */}
          <View style={styles.headerLeft}>
            <Text style={styles.headerModeLabel}>{mode === 'Social' ? 'Socialize' : 'Dating'}</Text>
            <TouchableOpacity
              onPress={() => setModeAndPersist(mode === 'Dating' ? 'Social' : 'Dating')}
              activeOpacity={0.8}
              style={styles.modeToggle}
            >
              <Ionicons name="swap-horizontal" size={15} color={colors.black} />
            </TouchableOpacity>

            {/* Map toggle — single icon that flips state. Tap to enter
                the Snap-Map view, tap again to return to the swipe
                deck. Active state is communicated by the icon color
                turning accent (red), not a separate filled pill — so
                the header doesn't compete with the deck/map content
                for visual weight. State is local because the deck is
                the canonical Connect surface and the map is a side
                trip that shouldn't persist across cold starts. */}
            <TouchableOpacity
              onPress={() => setViewMode((v) => (v === 'deck' ? 'map' : 'deck'))}
              activeOpacity={0.7}
              style={styles.mapToggle}
              accessibilityRole="button"
              accessibilityState={{ selected: viewMode === 'map' }}
              accessibilityLabel={viewMode === 'deck' ? 'Switch to map view' : 'Switch to swipe deck'}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons
                name={viewMode === 'map' ? 'map' : 'map-outline'}
                size={20}
                color={viewMode === 'map' ? colors.accent : colors.black}
              />
            </TouchableOpacity>
          </View>

          {/* Right — Boost (hidden during v1 launch) + Avatar */}
          <View style={styles.headerRight}>
            {SHOW_PAYMENTS_UI && (
              <TouchableOpacity
                onPress={() => navigation?.navigate?.('Boost')}
                activeOpacity={0.85}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.headerIconBtn}
              >
                <Ionicons name="flash" size={17} color={colors.black} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => navigation?.navigate?.('Profile')}
              activeOpacity={0.85}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Image source={imageSource(currentUser?.images?.[0])} style={styles.avatar} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* ─── FILTER BAR — below top bar, collapses on swipe.
            Hidden on the map view: PeopleMap renders its own chip row
            (Nearby / 25mi / 50mi / Anywhere / Active now) which is a
            different filtering paradigm. Stacking both would put four
            rows of chrome above the map. */}
        {viewMode !== 'map' && (
          <Animated.View
            style={[
              styles.filterBarWrap,
              {
                top: insets.top + Layout.headerHeight + 2,
                opacity: topMotion,
                transform: [
                  {
                    translateY: topMotion.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }),
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
              lockedFilters={lockedFilterLabels}
              onDisabledPress={showFiltersUpgrade}
            />
          </Animated.View>
        )}
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
        mode={mode}
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

      {/* Survey-completion prompt for any blocked dating action. The
          modal owns its own visibility, navigation, and copy — see
          useEligibility / SurveyNudgeModal. Mounted once at screen
          root so any handler that calls gate() can surface it. */}
      {surveyNudge}
    </View>
  );
};

const getStyles = (colors, insets, isDark) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  cardArea: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: insets.top + Layout.headerHeight + Layout.filterGap + 44,
    paddingBottom: 10,
    position: 'relative',
  },
  cardLayer: {
    flex: 1,
  },
  // Visible deck stack
  currentCard: {
    flex: 1,
    zIndex: 3,
  },
  deckPeek1: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  deckPeek2: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  deckPeekCard: {
    flex: 1,
    backgroundColor: colors.gray300,
    borderRadius: 22,
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
    ...Typography.tabTitle,
    color: colors.black,
  },
  modeToggle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  // Map toggle — icon-only, no chip background. Sits in the header
  // alongside the mode swap. Accent color signals the map is on; outline
  // icon + neutral color signals the deck is on. Larger tap target than
  // the mode pill since it's a top-level navigation action.
  mapToggle: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    backgroundColor: colors.gray300,
  },

  // ── Filter bar ──
  filterBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 18,
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
    bottom: 14,
    left: 0,
    right: 0,
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
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(206,17,38,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(206,17,38,0.15)',
  },
  emptyActions: {
    width: '100%',
    gap: 10,
    marginBottom: 4,
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
