import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  Animated,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GraffitiChat } from '../components/icons';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme, Typography, FontFamily, Layout } from '../theme';
import { imageSource } from '../utils/imageSource';
import { useSubscription } from '../payments';
import { useAuth } from '../auth';
import { useCurrentUser } from '../hooks';
import { mockMatches, mockLikes } from '../data/__dev__/mockProfiles';
import { mockStories } from '../data/__dev__/mockStories';
import { DEMO_DATA_ENABLED } from '../config/demoData';
import * as matchesService from '../api/services/matchesService';
import * as likesService from '../api/services/likesService';
import * as storyService from '../api/services/storyService';
import { useRealtime } from '../api/hooks/useRealtime';
import MessageListSkeleton from '../components/MessageListSkeleton';
import StoriesRow from '../components/StoriesRow';
import ThemedRefreshControl from '../components/ThemedRefreshControl';
import ProfilePromptBanner from '../components/ProfilePromptBanner';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAccessibilityPreferences } from '../accessibility';

export default function MessagesScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { prefs } = useAccessibilityPreferences();
  const [matches, setMatches] = useState([]);
  const [likes, setLikes] = useState([]);
  const styles = useMemo(() => getStyles(colors, isDark, prefs), [colors, isDark, prefs]);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsMuted, setNotificationsMuted] = useState(false);
  const { hasTier } = useSubscription();
  const { session } = useAuth();
  const { currentUser } = useCurrentUser();
  const { onMatchCreated } = useRealtime(currentUser?.id);
  const contentAnim = useRef(new Animated.Value(0)).current;
  const rowAnimsRef = useRef([]);
  const hasAnimatedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  // Mode is read from the authoritative source — `useCurrentUser`
  // resolves it from Profile.appMode → accountPurpose → AsyncStorage
  // → 'Social' default. Reading it directly here keeps the inbox
  // labels in sync whenever Settings flips the toggle, with no
  // remount required (the old AsyncStorage-only read would lag a
  // navigation cycle behind).
  const mode = currentUser?.preferences?.mode || 'Social';
  // Lowercase form for Match/Swipe row comparisons; the DB stores
  // 'dating' / 'social', not the capitalized client-side labels.
  const modeKey = mode === 'Social' ? 'social' : 'dating';
  const isPlus = hasTier('plus');
  const loadingTimeoutRef = useRef(null);
  const [seenConnections, setSeenConnections] = useState(new Set());
  const [storiesRefreshKey, setStoriesRefreshKey] = useState(0);

  // CreateStoryScreen returns the freshly-created story via
  // route.params.createdStory. Bump the StoriesRow refreshKey so it
  // refetches and the new story appears in the strip immediately.
  useEffect(() => {
    if (route?.params?.createdStory) {
      setStoriesRefreshKey((k) => k + 1);
      navigation.setParams({ createdStory: undefined });
    }
  }, [route?.params?.createdStory, navigation]);

  // Hydrate seen-connections from AsyncStorage. Mode is no longer read
  // here — `currentUser.preferences.mode` is the source of truth and is
  // resolved upstream by useCurrentUser (00025 / appMode column).
  useEffect(() => {
    AsyncStorage.getItem('@junubin_seen_connections').then((value) => {
      if (!value) return;
      try {
        const ids = JSON.parse(value);
        if (Array.isArray(ids)) setSeenConnections(new Set(ids));
      } catch {
        // ignore corrupt cache
      }
    }).catch(() => {});
  }, []);
  const filtersLocked = !isPlus;

  const showFiltersLocked = useCallback(() => {
    Alert.alert('JuNubin+ Filters', 'Upgrade to JuNubin+ to unlock message filters and search.', [
      { text: 'Upgrade', onPress: () => navigation.navigate('Elite') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [navigation]);

  // Demo-mode fallback. When DEMO_DATA_ENABLED is true (TestFlight
  // launch period), the inbox is seeded with mockMatches/mockLikes
  // so testers have something to interact with before real users
  // sign up. Flip the flag off in src/config/demoData.js before App
  // Review submission — they don't like fake-looking populations.
  const demoMatches = DEMO_DATA_ENABLED ? mockMatches : [];
  const demoLikes   = DEMO_DATA_ENABLED ? mockLikes   : [];

  const fetchMatches = useCallback(() => {
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    loadingTimeoutRef.current = setTimeout(() => {
      setMatches((prev) => (prev.length ? prev : demoMatches));
      setLikes((prev) => (prev.length ? prev : demoLikes));
      setIsLoading(false);
    }, 600);

    if (!session) {
      setMatches(demoMatches);
      setLikes(demoLikes);
      setIsLoading(false);
      return Promise.resolve();
    }
    return Promise.all([
      matchesService.getMatches().then((apiMatches) => {
        setMatches(apiMatches.length > 0 ? apiMatches : demoMatches);
      }),
      likesService.getReceivedLikes().then((apiLikes) => {
        setLikes(apiLikes.length > 0 ? apiLikes : demoLikes);
      }),
    ]).catch((err) => {
      if (__DEV__) console.warn('Messages fetch failed:', err);
      setMatches(demoMatches);
      setLikes(demoLikes);
    }).finally(() => {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      setIsLoading(false);
    });
  }, [session, demoMatches, demoLikes]);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  // Re-fetch on tab focus too. Handles the "another device unmatched
  // / blocked while this screen was backgrounded" case where the
  // realtime sub may have missed the event (Realtime occasionally
  // drops postgres_changes during disconnects).
  useFocusEffect(
    useCallback(() => {
      if (session) fetchMatches();
    }, [session, fetchMatches]),
  );

  // Realtime: INSERT (new match) and DELETE (unmatch from any device)
  // both refetch the list. The hook now passes `eventType` as the
  // second arg; we don't need to branch here since both events should
  // trigger the same refresh.
  useEffect(() => {
    if (!session) return;
    const unsub = onMatchCreated(() => {
      fetchMatches();
    });
    return unsub;
  }, [session, onMatchCreated, fetchMatches]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchMatches().finally(() => setRefreshing(false));
  }, [fetchMatches]);

  useEffect(() => {
    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [contentAnim]);

  const handleMatchPress = (match) => {
    navigation.navigate('Chat', { match });
  };

  // Try to open the tapped person's active story, if they have one.
  // Resolves real story groups via storyService (so a story posted by
  // someone you matched with on the server actually plays here).
  // Returns true when a story was opened so the caller can
  // short-circuit its default tap handler. Returns false (silently)
  // when there's no active story for the user — there is no longer
  // any mock-stories fallback, so the row just isn't taken.
  const handleOpenStoryIfAvailable = useCallback(async (person) => {
    const name = person?.name?.trim().toLowerCase();
    const userId = person?.userId || person?.id;
    if (!name && !userId) return false;
    try {
      const groups = await storyService.listActiveStoryGroups();
      const index = groups.findIndex((g) => {
        if (userId && g.userId === userId) return true;
        if (name && g.userName?.trim().toLowerCase() === name) return true;
        return false;
      });
      if (index >= 0) {
        navigation.navigate('StoriesView', {
          story: groups[index],
          storyIndex: index,
          storyList: groups,
        });
        return true;
      }
    } catch {
      // listActiveStoryGroups failed — just don't open a story.
    }
    return false;
  }, [navigation]);

  const handleLikePress = (like) => {
    if (!hasTier('junub')) {
      Alert.alert('Junub Feature', `Upgrade to Junub to message people who ${mode === 'Social' ? 'waved at' : 'liked'} you.`, [
        { text: 'Upgrade', onPress: () => navigation.navigate('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    // A `like` is someone who has liked YOU but you haven't matched
    // back yet — there's no conversation thread, so opening Chat would
    // load mock history (or nothing). Route to ProfileDetail instead
    // so the user can like-back to create a real match → conversation.
    if (!like?.conversationId) {
      navigation.navigate('ProfileDetail', { profile: like });
      return;
    }
    navigation.navigate('Chat', {
      conversationId: like.conversationId,
      match: like,
    });
  };

  // Build combined conversation list with category + search filtering,
  // then sort so the current mode's items float to the top while the
  // other mode stays below (rather than disappearing — the user can
  // still see they have other-mode conversations without flipping the
  // toggle). Within each bucket, sort by recency.
  //
  // A conversation's `mode` field comes from the DB (Match.mode /
  // Swipe.mode, set when the swipe was recorded). Legacy rows that
  // pre-date the 00025 migration default to 'dating' at the service
  // layer, so an unmigrated install still produces a stable order.
  const conversationData = useMemo(() => {
    const q = (filtersLocked ? '' : searchQuery).toLowerCase().trim();
    const likeItems = likes.map((like) => ({ ...like, type: 'like' }));
    const matchItems = matches.map((match) => ({ ...match, type: 'match' }));
    let all = [...likeItems, ...matchItems];
    const effectiveCategory = filtersLocked ? 'All' : activeCategory;
    if (effectiveCategory === 'Matches') all = matchItems;
    else if (effectiveCategory === 'Likes') all = likeItems;
    if (q) all = all.filter((item) => item.name?.toLowerCase().includes(q));

    const sortKey = (item) => {
      // Likes use `likedAt`, matches use `updatedAt` (last message) →
      // fall back through both so the comparator is stable for either.
      return new Date(item.updatedAt || item.likedAt || 0).getTime();
    };
    return all.slice().sort((a, b) => {
      const aMatchesMode = (a.mode || 'dating') === modeKey;
      const bMatchesMode = (b.mode || 'dating') === modeKey;
      if (aMatchesMode !== bMatchesMode) return aMatchesMode ? -1 : 1;
      return sortKey(b) - sortKey(a);
    });
  }, [likes, matches, searchQuery, activeCategory, filtersLocked, modeKey]);

  useEffect(() => {
    if (!filtersLocked) return;
    if (activeCategory !== 'All') setActiveCategory('All');
    if (searchQuery) setSearchQuery('');
  }, [filtersLocked, activeCategory, searchQuery]);

  // Build row animation values when conversation data changes (only first render)
  useEffect(() => {
    if (hasAnimatedRef.current || conversationData.length === 0) return;
    const anims = conversationData.map(() => new Animated.Value(0));
    rowAnimsRef.current = anims;
    hasAnimatedRef.current = true;
    const staggered = anims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 280,
        delay: i * 45,
        useNativeDriver: true,
      })
    );
    Animated.stagger(0, staggered).start();
  }, [conversationData]);

  const renderConversation = ({ item, index }) => {
    const rowAnim = rowAnimsRef.current[index];
    const animStyle = rowAnim ? {
      opacity: rowAnim,
      transform: [{
        translateY: rowAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      }],
    } : {};

    if (item.type === 'like') {
      const isNew = !seenConnections.has(item.id);
      return (
        <Animated.View style={animStyle}>
          <TouchableOpacity
            style={[styles.messageRow, isNew && styles.likeRowNew]}
            onPress={() => {
              if (isNew) {
                setSeenConnections((prev) => {
                  const next = new Set(prev);
                  next.add(item.id);
                  AsyncStorage.setItem('@junubin_seen_connections', JSON.stringify([...next])).catch(() => {});
                  return next;
                });
              }
              handleLikePress(item);
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={prefs?.screenReaderHints ? `${item.name}, ${mode === 'Social' ? 'waved at you' : 'liked you recently'}` : item.name}
          >
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={(e) => {
                e.stopPropagation?.();
                if (handleOpenStoryIfAvailable(item)) return;
                navigation.navigate('ProfileDetail', { profile: item });
              }}
              activeOpacity={0.8}
            >
              {/* Like rows mirror the story-row visual language: a solid
                  accent ring on "new" items signals "actionable content".
                  Once seen, the ring drops to neutral gray. */}
              <View style={[styles.likeAvatarRing, !isNew && styles.likeAvatarRingSeen]}>
                <Image source={imageSource(item.images?.[0])} style={styles.msgAvatar} />
              </View>
            </TouchableOpacity>
            <View style={styles.msgInfo}>
              <View style={styles.likeNameRow}>
                <Text style={[styles.msgName, isNew && styles.msgNameBold]}>{item.name}</Text>
                {isNew && (
                  <View style={styles.likeBadge}>
                    <Text style={styles.likeBadgeText}>New</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.likePreviewPrimary, isNew && styles.likePreviewNew]} numberOfLines={1}>
                {mode === 'Social' ? 'Wants to connect' : 'Liked your profile'}
              </Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowTimeHint}>Just now</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      );
    }

    // Source of truth on initial paint and on tab-focus refetch is the
    // server-derived `unreadCount` (matchesService computes it from
    // Message.readAt). Local-state `unread` boolean stays as a
    // fallback for any code path that hasn't been migrated yet.
    const unreadCount = typeof item.unreadCount === 'number' ? item.unreadCount : (item.unread ? 1 : 0);
    const isUnread = unreadCount > 0 || !!item.unread;
    const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

    return (
      <Animated.View style={animStyle}>
        <TouchableOpacity
          style={styles.messageRow}
          onPress={() => handleMatchPress(item)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={prefs?.screenReaderHints ? `${item.name}, ${isUnread ? `${unreadCount || 1} unread message${(unreadCount || 1) === 1 ? '' : 's'}` : 'message thread'}` : item.name}
        >
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={(e) => {
              e.stopPropagation?.();
              // Avatar tap shows the full profile card (same as the swipe
              // deck's expand action). Story takes priority if one's
              // active. Falls back to ProfileDetail rather than Chat so
              // users can review who they're about to talk to.
              if (handleOpenStoryIfAvailable(item)) return;
              navigation.navigate('ProfileDetail', { profile: item });
            }}
            activeOpacity={0.8}
          >
            {/* Match rows: clean photo, no story ring. The colored ring is
                reserved for stories + likes (actionable content). Unread
                state is signalled exclusively by the count badge in the
                right column + a bolder name. */}
            <View style={styles.matchAvatarFrame}>
              <Image source={imageSource(item.images?.[0])} style={styles.msgAvatar} />
            </View>
            <View style={styles.onlineDot} />
          </TouchableOpacity>
          <View style={styles.msgInfo}>
            <View style={styles.msgNameRow}>
              <Text style={[styles.msgName, isUnread && styles.msgNameBold]}>{item.name}</Text>
              {isUnread && prefs?.nonColorCues && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>New</Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.msgPreview,
                isUnread && styles.msgUnread,
                // Italicize the placeholder so it's visually distinct
                // from a real last-message preview. Without this, a
                // brand-new match would look indistinguishable from a
                // match where the other person said the literal words
                // "Say hi" — which is the exact confusion users hit
                // with the old hardcoded mock previews.
                !item.lastMessage && styles.msgPreviewPlaceholder,
              ]}
              numberOfLines={1}
            >
              {item.lastMessage || 'Say hi 👋'}
            </Text>
          </View>
          <View style={styles.rowRight}>
            {item.timestamp ? (
              <Text style={styles.msgTime}>{item.timestamp}</Text>
            ) : null}
            {unreadCount > 0 && <View style={styles.unreadCountDot}><Text style={styles.unreadCountText}>{badgeText}</Text></View>}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const unreadMatchCount = useMemo(() => matches.filter((m) => (m.unreadCount > 0) || m.unread).length, [matches]);
  const likesCount = likes.length;
  const CATEGORIES = [
    { label: 'All', badge: unreadMatchCount + likesCount },
    { label: 'Matches', badge: unreadMatchCount },
    { label: 'Likes', badge: likesCount },
  ];

  // New matches for horizontal scroll
  const newMatchAvatars = useMemo(() => {
    const combined = [...likes.slice(0, 8), ...matches.filter(m => m.unread).slice(0, 4)];
    const seen = new Set();
    return combined.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
  }, [likes, matches]);

  // Stories scroll with the list (rendered as the first list item).
  // Pulled out so the FlatList and the loading/empty ScrollViews can
  // share the exact same component instance.
  const renderStories = useCallback(() => (
    <StoriesRow
      colors={colors}
      refreshKey={storiesRefreshKey}
      onCreatePress={() => navigation.navigate('CreateStory')}
      onStoryPress={(story, storyIndex, storyList) =>
        navigation.navigate('StoriesView', { story, storyIndex, storyList })
      }
    />
  ), [colors, storiesRefreshKey, navigation]);

  // Banners/ads/upsell — scroll BELOW the sticky filters. Always returns a
  // wrapper view so this slot has a stable identity in the list (keeps the
  // sticky-header index math predictable even when nothing is shown).
  const renderBanners = useCallback(() => (
    <View>
      {!hasTier('plus') && (
        <ProfilePromptBanner
          message="Unlock unlimited messages with JuNubin+"
          onPress={() => navigation.navigate('Elite')}
          colors={colors}
        />
      )}
      {!hasTier('junub') && likesCount > 0 && (
        <TouchableOpacity
          style={styles.upsellCard}
          onPress={() => navigation.navigate('Elite')}
          activeOpacity={0.8}
        >
          <View style={styles.upsellAvatarStack}>
            {likes.slice(0, 4).map((like, i) => (
              <Image
                key={like.id}
                source={imageSource(like.images?.[0])}
                style={[styles.upsellStackAvatar, { marginLeft: i === 0 ? 0 : -10, zIndex: 4 - i }]}
                blurRadius={8}
              />
            ))}
            {likesCount > 4 && (
              <View style={[styles.upsellStackAvatar, styles.upsellStackMore, { marginLeft: -10, zIndex: 0 }]}>
                <Text style={styles.upsellStackMoreText}>+{likesCount - 4}</Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.upsellTitle}>{likesCount} people {mode === 'Social' ? 'waved at you' : 'liked you'}</Text>
            <Text style={styles.upsellDesc}>Tap to match instantly</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  ), [colors, navigation, hasTier, likes, likesCount, mode, styles]);

  const filtersPanel = useCallback(() => (
    <View style={styles.filtersPanel}>
      <View style={styles.categoryRow}>
        <View style={styles.categoryChips}>
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.label;
            const isLikes = cat.label === 'Likes';
            const countText = cat.badge > 0 ? `${cat.badge > 99 ? '99+' : cat.badge}` : '';
            return (
              <TouchableOpacity
                key={cat.label}
                style={[
                  styles.categoryChip,
                  isActive && (isLikes ? styles.categoryChipLikes : styles.categoryChipActive),
                  filtersLocked && styles.categoryChipLocked,
                ]}
                onPress={() => {
                  if (filtersLocked) { showFiltersLocked(); return; }
                  setActiveCategory(cat.label);
                }}
                activeOpacity={filtersLocked ? 1 : 0.8}
              >
                <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                  {cat.label}
                </Text>
                {countText !== '' && (
                  <Text style={[styles.categoryChipCount, isActive && styles.categoryChipCountActive]}>
                    {countText}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity
          style={[styles.notifToggle, notificationsMuted && styles.notifToggleMuted]}
          onPress={() => setNotificationsMuted((m) => !m)}
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="switch"
          accessibilityState={{ checked: !notificationsMuted }}
          accessibilityLabel={notificationsMuted ? 'Notifications off — tap to turn on' : 'Notifications on — tap to mute'}
        >
          <Ionicons
            name={notificationsMuted ? 'notifications-off-outline' : 'notifications-outline'}
            size={18}
            color={notificationsMuted ? colors.gray400 : colors.black}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.gray400} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search conversations..."
            placeholderTextColor={colors.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
            editable={!filtersLocked}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={19} color={colors.gray400} />
            </TouchableOpacity>
          )}
          {filtersLocked && (
            <Pressable style={styles.searchLockOverlay} onPress={showFiltersLocked} />
          )}
        </View>
      </View>

      {filtersLocked && (
        <TouchableOpacity style={styles.filtersLockedRow} onPress={showFiltersLocked} activeOpacity={0.8}>
          <Ionicons name="lock-closed" size={14} color={colors.gray500} />
          <Text style={styles.filtersLockedText}>Filters are JuNubin+ only</Text>
        </TouchableOpacity>
      )}
    </View>
  ), [CATEGORIES, activeCategory, filtersLocked, searchQuery, colors, showFiltersLocked, notificationsMuted]);

  // Unified data for the FlatList. Keeping a fixed prefix (stories,
  // filters, banners) means stickyHeaderIndices=[1] always points at
  // the filters strip. `__type` is read by the dispatcher below.
  const listData = useMemo(() => {
    const head = [
      { __type: 'stories', id: '__stories' },
      { __type: 'filters', id: '__filters' },
      { __type: 'banners', id: '__banners' },
    ];
    // Tag each conversation with its position in conversationData so
    // renderConversation can look up the right row-animation value
    // (the FlatList index is offset by the head items above).
    const convs = conversationData.map((c, i) => ({ ...c, __convIndex: i }));
    return [...head, ...convs];
  }, [conversationData]);

  const renderListItem = useCallback(({ item }) => {
    switch (item.__type) {
      case 'stories': return renderStories();
      case 'filters': return filtersPanel();
      case 'banners': return renderBanners();
      default: return renderConversation({ item, index: item.__convIndex });
    }
  }, [renderStories, filtersPanel, renderBanners]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ─── Header ─── */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: contentAnim,
            transform: [{
              translateY: contentAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-8, 0],
              }),
            }],
          },
        ]}
      >
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.headerRight}>
          {/* Bell sits to the LEFT of the avatar, same affordance as
              CommunityScreen so the header reads consistently across
              tabs. In-app Notifications screen lands in v1.1 — for now
              this surfaces the "coming soon" copy. */}
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'Coming soon',
                'In-app notifications are landing in v1.1. For now, push notifications cover matches, likes, and messages.'
              )
            }
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={22} color={colors.gray500} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
            <Image source={imageSource(currentUser?.images?.[0])} style={styles.headerAvatar} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ─── Everything scrolls together ───
          Layout contract:
            - index 0 (stories) scrolls up and off-screen
            - index 1 (filters + search) sticks to the top once it
              reaches it; everything below it scrolls underneath
            - index 2 (banners/ads/upsell) and beyond scroll normally
      */}
      {isLoading ? (
        <ScrollView
          stickyHeaderIndices={[1]}
          showsVerticalScrollIndicator={false}
        >
          {renderStories()}
          {filtersPanel()}
          {renderBanners()}
          <MessageListSkeleton />
        </ScrollView>
      ) : conversationData.length === 0 && !searchQuery ? (
        <ScrollView
          stickyHeaderIndices={[1]}
          showsVerticalScrollIndicator={false}
        >
          {renderStories()}
          {filtersPanel()}
          {renderBanners()}
          <View style={styles.emptyMessages}>
            <GraffitiChat size={50} color={colors.gray400} />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Start swiping to find connections!</Text>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          renderItem={renderListItem}
          stickyHeaderIndices={[1]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={5}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={true}
          refreshControl={
            <ThemedRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        />
      )}

      {/* ─── Create Bottom Sheet ─── */}
      <Modal
        visible={showCreateSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateSheet(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCreateSheet(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Create</Text>
            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => {
                setShowCreateSheet(false);
                navigation.navigate('CreateStory');
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.black} />
              <View style={styles.sheetTextWrap}>
                <Text style={styles.sheetRowTitle}>Add Story</Text>
                <Text style={styles.sheetRowSub}>Share a moment with your followers</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors, isDark, prefs = {}) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },

  // ─── Header ───
  header: {
    width: '100%',
    height: Layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
    marginBottom: 0,
  },
  headerTitle: {
    ...Typography.tabTitle,
    color: colors.black,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.gray300,
    backgroundColor: colors.gray300,
  },

  filtersPanel: {
    // Opaque background — this strip is sticky-pinned, so content
    // scrolling underneath must not bleed through.
    backgroundColor: colors.surfaceMuted,
    paddingTop: 2,
    // Hairline divider on the bottom (was top) — when pinned, the
    // separation that matters is between the strip and the list below.
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
  },

  // ─── New Matches horizontal row ───
  newMatchesSection: {
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    marginBottom: 4,
  },
  newMatchesScroll: {
    paddingHorizontal: 16,
    gap: 16,
    paddingBottom: 8,
  },
  newMatchItem: {
    alignItems: 'center',
    width: 64,
  },
  newMatchRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2.5,
  },
  newMatchAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.gray300,
    borderWidth: 2,
    borderColor: colors.cardBg,
  },
  newMatchName: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    color: colors.black,
    marginTop: 5,
    textAlign: 'center',
    maxWidth: 64,
  },

  // ─── Section labels ───
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    color: colors.black,
    letterSpacing: 0.2,
  },
  sectionBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ─── Category Chips ───
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 8,
  },
  categoryChips: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  // Notification mute toggle — sits on the right edge of the filter row
  notifToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
  },
  notifToggleMuted: {
    backgroundColor: 'transparent',
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  },
  categoryChipLocked: {
    opacity: 0.7,
  },
  categoryChipActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  categoryChipLikes: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  categoryChipText: {
    ...Typography.label,
    fontSize: 13,
    color: isDark ? 'rgba(255,255,255,0.6)' : colors.gray500,
  },
  categoryChipTextActive: {
    color: colors.cardBg,
    fontWeight: '700',
  },
  categoryChipCount: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: isDark ? 'rgba(255,255,255,0.4)' : colors.gray400,
    marginLeft: 4,
  },
  categoryChipCountActive: {
    color: isDark ? 'rgba(26,26,26,0.45)' : 'rgba(255,255,255,0.65)',
  },

  // ─── Search Bar ───
  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 40,
    gap: 8,
  },
  searchLockOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  searchInput: {
    flex: 1,
    ...Typography.caption,
    fontSize: 14,
    color: colors.black,
    paddingVertical: 0,
  },
  filtersLockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  filtersLockedText: {
    ...Typography.caption,
    color: colors.gray500,
    fontSize: 12,
  },

  // ─── New Connections ───
  // ─── Messages Header ───
  messagesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    marginTop: 2,
  },
  messagesTitle: {
    ...Typography.sectionTitle,
    color: colors.black,
  },

  // ─── Conversations list ───
  listContent: {
    paddingBottom: 20,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: prefs?.largerTouchTargets ? 14 : 11,
    marginHorizontal: 8,
    marginVertical: 2,
    borderRadius: 14,
    backgroundColor: 'transparent',
  },
  // Like rows are the only "actionable" inbox state — keep a barely-
  // there tint so the row reads as different without competing with the
  // ring + badge that already carry the signal.
  likeRowNew: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(206,17,38,0.025)',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  // Plain frame for match rows — clean photo, hairline border for crispness
  matchAvatarFrame: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: colors.gray300,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
  },
  // Like rows mirror the story ring — solid theme accent for "new"
  likeAvatarRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2.5,
    backgroundColor: colors.accent,
  },
  likeAvatarRingSeen: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)',
  },
  msgAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.gray300,
  },
  likeEmojiDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: isDark ? '#2A2A2A' : '#F0F0F0',
  },
  likeEmojiText: {
    fontSize: 12,
  },
  onlineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2.5,
    borderColor: colors.cardBg,
  },
  msgInfo: {
    flex: 1,
  },
  msgNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 4,
  },
  msgName: {
    ...Typography.bodySmallMedium,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.black,
  },
  msgNameBold: {
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  rowRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
    marginLeft: 8,
  },
  rowTimeHint: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    color: prefs?.highContrast ? colors.gray700 : colors.gray500,
  },
  msgTime: {
    ...Typography.caption,
    fontSize: 12,
    color: prefs?.highContrast ? colors.gray700 : colors.gray500,
  },
  unreadCountDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadCountText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: '#FFFFFF',
  },
  msgPreview: {
    ...Typography.caption,
    color: prefs?.highContrast ? colors.gray700 : colors.gray600,
    marginTop: 2,
  },
  // Used when there's no last-message preview yet (brand-new match).
  // Italic + muted so it reads as a CTA rather than a real message.
  msgPreviewPlaceholder: {
    fontStyle: 'italic',
    color: prefs?.highContrast ? colors.gray600 : colors.gray500,
  },
  likePreviewPrimary: {
    ...Typography.caption,
    color: prefs?.highContrast ? colors.gray700 : colors.gray500,
    marginTop: 2,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  likePreviewSecondary: {
    ...Typography.caption,
    color: prefs?.highContrast ? colors.gray700 : colors.gray600,
    marginTop: 2,
  },
  likeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  likeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  likeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  likePreviewNew: {
    color: isDark ? 'rgba(206,17,38,0.8)' : '#CE1126',
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  unreadBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.gray300,
    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.surfaceMuted,
  },
  unreadBadgeText: {
    ...Typography.captionBold,
    color: colors.black,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  msgUnread: {
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.black,
  },
  likesYouRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // ─── Create Sheet ───
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 20,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray300,
    marginBottom: 8,
  },
  sheetTitle: {
    ...Typography.h4,
    color: colors.black,
    textAlign: 'center',
    marginBottom: 10,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  sheetTextWrap: {
    flex: 1,
  },
  sheetRowTitle: {
    ...Typography.bodySmallMedium,
    color: colors.black,
  },
  sheetRowSub: {
    ...Typography.caption,
    color: colors.gray500,
    marginTop: 2,
  },

  // ─── Empty state ───
  emptyMessages: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    ...Typography.h4,
    color: colors.black,
    marginTop: 16,
  },
  emptySubtext: {
    ...Typography.bodySmall,
    color: colors.gray500,
    marginTop: 8,
  },

  // ─── Upsell Card ───
  upsellCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    gap: 12,
  },
  upsellAvatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upsellStackAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: isDark ? colors.gray200 : colors.white,
    backgroundColor: colors.gray300,
  },
  upsellStackMore: {
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upsellStackMoreText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: '#FFFFFF',
  },
  upsellTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.black,
    marginBottom: 1,
  },
  upsellDesc: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    color: colors.gray500,
  },
});
