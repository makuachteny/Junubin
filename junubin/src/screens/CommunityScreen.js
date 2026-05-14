import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily, Layout } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';
import { GraffitiCommunity, GraffitiSparkles, GraffitiFlame, GraffitiLocation, GraffitiStar } from '../components/icons';
import PostCard from '../components/PostCard';
import ThemedRefreshControl from '../components/ThemedRefreshControl';
import EmptyState from '../components/EmptyState';
import Toast from '../components/Toast';
import SkeletonShimmer from '../components/SkeletonShimmer';
import * as postService from '../api/services/postService';
import { supabase } from '../config/supabase';
import { useAuth } from '../auth';
import { imageSource } from '../utils/imageSource';
import { useCurrentUser } from '../hooks';
import { applyCommunityFilters } from '../utils/communityFilters';

const FIXED_TABS = ['Feed', 'Live'];

const { width: SCREEN_W } = Dimensions.get('window');

const COMMUNITY_FILTERS = [
  { id: 'fun', label: 'Fun', icon: 'sparkles', accent: true, graffitiIcon: 'sparkles' },
  { id: 'trending', label: 'Trending', icon: 'trending-up', graffitiIcon: 'flame' },
  { id: 'nearby', label: 'Nearby', icon: 'location', graffitiIcon: 'location' },
  { id: 'new', label: 'New', icon: 'time' },
  { id: 'friends', label: 'Friends', icon: 'people', graffitiIcon: 'community' },
  { id: 'popular', label: 'Popular', icon: 'flame', graffitiIcon: 'star' },
];
const INLINE_FILTER_COUNT = 2;

// Hoisted to module scope so the lookup isn't rebuilt on every render
// of every filter pill (was previously inlined inside two .map calls).
const GRAFFITI_MAP = {
  sparkles: GraffitiSparkles,
  flame: GraffitiFlame,
  location: GraffitiLocation,
  community: GraffitiCommunity,
  star: GraffitiStar,
};

// Hydrate `liked` / `reposted` state on a batch of posts. Mock posts
// (seeded by mockProfiles.js with simple ids like `post1`/`post2`) are
// skipped so we don't waste a round trip looking them up — they
// aren't in the DB. Real ids are UUID v4s from crypto.randomUUID(),
// or the legacy `p_*` fallback. Errors are swallowed: stale chip
// state on first paint is acceptable, the user's own taps will
// repair it via the optimistic-toggle path.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isRealPostId = (id) => {
  if (!id) return false;
  const s = String(id);
  return UUID_RE.test(s) || s.startsWith('p_');
};

async function hydrateInteractionState(posts) {
  const realIds = posts.map((p) => p.id).filter(isRealPostId);
  if (realIds.length === 0) return posts;
  try {
    const [likedSet, repostedSet] = await Promise.all([
      postService.getLikedPostIds(realIds),
      postService.getRepostedPostIds(realIds),
    ]);
    return posts.map((p) =>
      likedSet.has(p.id) || repostedSet.has(p.id)
        ? { ...p, liked: likedSet.has(p.id), reposted: repostedSet.has(p.id) }
        : p,
    );
  } catch {
    return posts;
  }
}

export default function CommunityScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { currentUser } = useCurrentUser();
  const [activeTab, setActiveTab] = useState('Feed');
  const visibleTabs = FIXED_TABS;
  const [activeFilters, setActiveFilters] = useState([]);
  // Track whether persisted filter state has been hydrated from
  // AsyncStorage. Used to gate the persistence write so the initial
  // empty default can't overwrite stored selections.
  const filtersHydratedRef = useRef(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const feedListRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const contentAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [contentAnim]);

  // Hydrate persisted filter selections on mount so the user's last
  // chips survive a cold start. Falls through to the empty default on
  // missing key, parse error, or shape mismatch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('@junubin_community_filters');
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setActiveFilters(parsed);
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

  // Persist active filters, debounced so a flurry of taps coalesces
  // into a single write. Gated on hydration so the initial render can't
  // clobber stored values before the read lands.
  useEffect(() => {
    if (!filtersHydratedRef.current) return;
    const handle = setTimeout(() => {
      AsyncStorage.setItem(
        '@junubin_community_filters',
        JSON.stringify(activeFilters),
      ).catch(() => {});
    }, 500);
    return () => clearTimeout(handle);
  }, [activeFilters]);

  // Pull real posts from the API on mount. Falls back to mock data so
  // the feed isn't empty in dev / when the database is fresh — append
  // the mocks AFTER the real ones so user-generated content always
  // floats to the top.
  //
  // After loading the feed, batch-fetch which post IDs the caller has
  // already liked / reposted so PostCard renders the correct chip
  // state on first paint (rather than every chip showing un-liked then
  // updating on tap).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const live = await postService.listPosts();
        if (cancelled) return;
        setPosts(await hydrateInteractionState(live));
      } catch {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const [postedToast, setPostedToast] = useState(false);

  useEffect(() => {
    const createdPost = route?.params?.createdPost;
    if (!createdPost) return;
    setPosts((prev) => [createdPost, ...prev.filter((p) => p.id !== createdPost.id)]);
    setActiveTab('Feed');
    setPostedToast(true);
    navigation.setParams({ createdPost: undefined });
  }, [route?.params?.createdPost, navigation]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const live = await postService.listPosts();
      setPosts(await hydrateInteractionState(live));
    } catch {
      setPosts([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Live updates from other devices.
  //
  //   INSERT — a new post lands on the feed. We re-fetch listPosts to
  //            pull the normalized shape (the realtime payload doesn't
  //            include the author join).
  //   UPDATE — an existing post's counters changed (likeCount,
  //            commentCount, repostCount, moderationStatus). We patch
  //            the in-memory row in place so the like/comment numbers
  //            stay correct without a full refetch.
  //
  // moderationStatus flipping from 'pending' → 'rejected' on a row
  // someone else sees (i.e. not theirs) means the row should leave
  // the feed — we filter it out on UPDATE.
  const { session } = useAuth();
  useEffect(() => {
    if (!session) return undefined;
    const channel = supabase.channel('posts:feed');
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Post' }, async (payload) => {
        try {
          const live = await postService.listPosts();
          const fresh = live.find((p) => p.id === payload.new?.id);
          if (fresh) {
            setPosts((prev) => [fresh, ...prev.filter((p) => p.id !== fresh.id)]);
          }
        } catch {}
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'Post' }, (payload) => {
        const next = payload.new;
        if (!next?.id) return;
        // Pull rejected content out of the feed for non-authors.
        if (next.moderationStatus === 'rejected') {
          setPosts((prev) => prev.filter((p) => p.id !== next.id));
          return;
        }
        setPosts((prev) => prev.map((p) => p.id === next.id
          ? {
              ...p,
              likes:    Number.isFinite(next.likeCount)    ? next.likeCount    : p.likes,
              comments: Number.isFinite(next.commentCount) ? next.commentCount : p.comments,
              reposts:  Number.isFinite(next.repostCount)  ? next.repostCount  : p.reposts,
            }
          : p,
        ));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'Post' }, (payload) => {
        const removedId = payload.old?.id;
        if (!removedId) return;
        setPosts((prev) => prev.filter((p) => p.id !== removedId));
      })
      .subscribe();
    return () => {
      try { channel.unsubscribe(); supabase.removeChannel(channel); } catch {}
    };
  }, [session]);

  const renderPost = useCallback(({ item }) => (
    <PostCard post={item} />
  ), []);

  const keyExtractor = useCallback((item) => item.id, []);
  const query = searchQuery.trim().toLowerCase();
  const filterByQuery = useCallback((items, pick) => {
    if (!query) return items;
    return items.filter((item) => {
      const parts = pick(item).filter(Boolean);
      return parts.some((part) => String(part).toLowerCase().includes(query));
    });
  }, [query]);
  // ctx supplies viewer-state to community filter predicates: own location
  // (so "Nearby" actually filters around the viewer rather than a hardcoded
  // city) and following set (so "Friends" pulls real follows).
  const filterCtx = useMemo(() => ({
    viewerLocation: currentUser?.city || currentUser?.location,
    followingIds: currentUser?.followingIds instanceof Set
      ? currentUser.followingIds
      : new Set(currentUser?.followingIds || []),
  }), [currentUser?.city, currentUser?.location, currentUser?.followingIds]);

  const filteredPosts = useMemo(() => {
    const base = applyCommunityFilters(posts, activeFilters, filterCtx);
    return filterByQuery(base, (post) => [post.content, post.user?.name, post.user?.location]);
  }, [posts, activeFilters, filterByQuery, filterCtx]);

  const renderActiveMeta = () => (
    activeFilters.length > 0 ? (
      <View style={styles.activeFilterMeta}>
        <Text style={styles.activeFilterMetaText}>
          {activeFilters.length} filter{activeFilters.length > 1 ? 's' : ''} active
        </Text>
        <TouchableOpacity onPress={() => setActiveFilters([])} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={styles.clearFiltersText}>Clear</Text>
        </TouchableOpacity>
      </View>
    ) : null
  );

  // Tabs + inline filters — passed into the feed FlatList's ListHeaderComponent
  // so it scrolls up with content while the screen header stays sticky.
  const tabsAndFilters = (
    <Animated.View
      style={{
        opacity: contentAnim,
        transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
      }}
    >
      {showSearch && (
        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={colors.gray500} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search community..."
              placeholderTextColor={colors.gray500}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              autoFocus
            />
            {!!searchQuery && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color={colors.gray400} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.combinedBar}
      >
        {visibleTabs.map((tab) => {
          const isTabActive = activeTab === tab;
          const TAB_ICONS = { Feed: 'newspaper-outline', Live: 'radio-outline' };
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.segmentPill, isTabActive && styles.segmentPillActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={TAB_ICONS[tab] || 'ellipse-outline'}
                size={13}
                color={isTabActive ? (isDark ? colors.black : '#FFFFFF') : colors.gray500}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.segmentPillText, isTabActive && styles.segmentPillTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}

        <View style={styles.barDivider} />

        {COMMUNITY_FILTERS.slice(0, INLINE_FILTER_COUNT).map((filter) => {
          const isActive = filter.accent || activeFilters.includes(filter.id);
          const GraffitiComp = filter.graffitiIcon ? GRAFFITI_MAP[filter.graffitiIcon] : null;
          return (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterPill,
                isActive && filter.accent && styles.filterPillAccent,
                isActive && !filter.accent && styles.filterPillActive,
              ]}
              onPress={() => {
                if (filter.id === 'fun') { navigation.navigate('InteractivityHub'); return; }
                setActiveFilters((prev) =>
                  prev.includes(filter.id) ? prev.filter((f) => f !== filter.id) : [...prev, filter.id]
                );
              }}
              activeOpacity={0.7}
            >
              {GraffitiComp ? (
                <GraffitiComp size={13} color={isActive ? (isDark ? colors.black : '#FFFFFF') : colors.gray600} filled={isActive} />
              ) : (
                <Ionicons name={filter.icon} size={13} color={isActive ? (isDark ? colors.black : '#FFFFFF') : colors.gray600} />
              )}
              <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                {filter.label}
              </Text>
              {/* Fun navigates to InteractivityHub instead of toggling — show
                  a tiny launch chevron so the action is visually distinct from
                  the surrounding toggle pills. */}
              {filter.id === 'fun' && (
                <Ionicons
                  name="arrow-forward"
                  size={11}
                  color={isActive ? (isDark ? colors.black : '#FFFFFF') : colors.gray600}
                  style={{ marginLeft: 2 }}
                />
              )}
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={styles.moreFilterBtn}
          onPress={() => setShowMoreFilters(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="options-outline" size={15} color={activeFilters.length > 0 ? colors.black : colors.gray500} />
        </TouchableOpacity>
      </ScrollView>
    </Animated.View>
  );

  // Shared header for both Feed and Live tabs. Ensures the tabs row,
  // filter chips, active-filter meta, and Events CTA stay anchored in
  // place when toggling between the two tabs.
  const feedHeader = (
    <View>
      {tabsAndFilters}
      {renderActiveMeta()}
      {/* Hidden in v1 — Events stack not yet server-backed. Re-enable when
          eventStore.js is migrated off AsyncStorage to Supabase. */}
      {false && (
        <TouchableOpacity
          onPress={() => navigation.navigate('Events')}
          activeOpacity={0.85}
          style={[styles.eventsCtaCard, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255,255,255,0.10)' : colors.gray200,
          }]}
          accessibilityRole="button"
          accessibilityLabel="See community events"
        >
          <View style={[styles.eventsCtaIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.gray100 }]}>
            <Ionicons name="calendar-outline" size={18} color={colors.black} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.eventsCtaTitle, { color: colors.black }]}>Community Events</Text>
            <Text style={[styles.eventsCtaSub, { color: colors.gray500 }]}>Tap to see what's happening</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.gray500} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ─── Header ─── */}
      <Animated.View
        style={[
          styles.headerRow,
          {
            opacity: contentAnim,
            transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
          },
        ]}
      >
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>Junubin</Text>
          <Text style={styles.headerFlag}>🇸🇸</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => {
              // Tap behaviour: scroll the feed back to the top first, then
              // toggle the search bar. If the user has scrolled down a few
              // posts, the bar would render off-screen otherwise.
              feedListRef.current?.scrollToOffset?.({ offset: 0, animated: true });
              setShowSearch((prev) => !prev);
            }}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="search-outline" size={22} color={colors.gray500} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('CreatePost')}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Create post"
          >
            <Ionicons name="add" size={22} color={colors.gray500} />
          </TouchableOpacity>
          {/* Disabled until the Notification table + service exist (v1.1). */}
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                'Coming soon',
                'In-app notifications are landing in v1.1. For now, push notifications cover matches, likes, and messages.'
              )
            }
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.gray500} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
            <Image source={imageSource(currentUser.images?.[0])} style={styles.avatar} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ─── More Filters Modal ─── */}
      <Modal visible={showMoreFilters} transparent animationType="slide" onRequestClose={() => setShowMoreFilters(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowMoreFilters(false)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <View style={styles.modalGrabber} />
            <Text style={styles.modalTitle}>Customize</Text>

            <Text style={styles.modalSectionLabel}>Filters</Text>
            <View style={styles.modalPillRow}>
              {COMMUNITY_FILTERS.slice(INLINE_FILTER_COUNT).map((filter) => {
                const isActive = activeFilters.includes(filter.id);
                const GraffitiComp = filter.graffitiIcon ? GRAFFITI_MAP[filter.graffitiIcon] : null;
                return (
                  <TouchableOpacity
                    key={filter.id}
                    style={[styles.modalFilterPill, isActive && styles.modalFilterPillActive]}
                    onPress={() => {
                      setActiveFilters((prev) =>
                        prev.includes(filter.id) ? prev.filter((f) => f !== filter.id) : [...prev, filter.id]
                      );
                    }}
                    activeOpacity={0.7}
                  >
                    {GraffitiComp ? (
                      <GraffitiComp size={16} color={isActive ? (colors.cardBg) : colors.gray600} filled={isActive} />
                    ) : (
                      <Ionicons name={filter.icon} size={16} color={isActive ? (colors.cardBg) : colors.gray600} />
                    )}
                    <Text style={[styles.modalFilterText, isActive && { color: colors.cardBg }]}>{filter.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={styles.modalDoneBtn} onPress={() => setShowMoreFilters(false)} activeOpacity={0.8}>
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ─── Content ─── */}
      {/* The tab row, filter chips, active-filter meta, and Events CTA
          are rendered as a single header for BOTH Feed and Live so
          swapping tabs only changes the list area below — the chrome
          stays put instead of flopping in and out. */}
      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentAnim,
            transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
          },
        ]}
      >
        {activeTab === 'Live' ? (
          <LiveTab
            navigation={navigation}
            headerComponent={feedHeader}
          />
        ) : activeTab === 'Feed' ? (
          isLoading ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <View key={i} style={{ marginBottom: 16, borderRadius: 16, overflow: 'hidden' }}>
                  <SkeletonShimmer width="100%" height={120} borderRadius={16} />
                  <View style={{ marginTop: 10 }}>
                    <SkeletonShimmer width={200} height={14} borderRadius={7} />
                    <SkeletonShimmer width={140} height={12} borderRadius={6} style={{ marginTop: 8 }} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <FlatList
              ref={feedListRef}
              data={filteredPosts}
              keyExtractor={keyExtractor}
              renderItem={renderPost}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.feedList}
              initialNumToRender={4}
              maxToRenderPerBatch={6}
              windowSize={5}
              removeClippedSubviews
              updateCellsBatchingPeriod={50}
              refreshControl={
                <ThemedRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
              }
              ListHeaderComponent={feedHeader}
              ListEmptyComponent={
                <EmptyState
                  icon="chatbubbles-outline"
                  title="No posts yet"
                  subtitle="Be the first to share something!"
                  actionLabel="Create Post"
                  onAction={() => navigation.navigate('CreatePost')}
                />
              }
            />
          )
        ) : null}
      </Animated.View>

      {/* ─── FAB — Live tab only ─── */}
      {activeTab === 'Live' && (
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('GoLive')}
        >
          <LinearGradient
            colors={['#000000', '#CE1126', '#009739']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <Ionicons name="radio" size={22} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      <Toast
        visible={postedToast}
        message="Posted"
        onDismiss={() => setPostedToast(false)}
      />
    </View>
  );
}

// ── Mock live streams ──
const MOCK_LIVES = [
  { id: 'l1', name: 'Achol', age: 23, image: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600', viewers: 142, caption: 'Live from Juba!', verified: true, category: 'Hangout' },
  { id: 'l2', name: 'Nyirou', age: 26, image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600', viewers: 65, caption: 'Fashion talk', verified: false, category: 'Style' },
  { id: 'l3', name: 'Ateny', age: 24, image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600', viewers: 28, caption: 'Cooking kisra live!', verified: true, category: 'Cooking' },
  { id: 'l4', name: 'Deng', age: 25, image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600', viewers: 310, caption: 'Music session', verified: true, category: 'Music' },
  { id: 'l5', name: 'Garang', age: 28, image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600', viewers: 89, caption: 'Minneapolis vibes', verified: false, category: 'Hangout' },
  { id: 'l6', name: 'Akuch', age: 22, image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600', viewers: 204, caption: 'Q&A night', verified: true, category: 'Chat' },
];

// Live grid stays as a 2-column layout. Horizontal inset matches the
// Feed (PostCard's marginHorizontal: 12) so the leftmost/rightmost
// edges of cards line up across both tabs — toggling between Feed and
// Live no longer produces a visible horizontal shift.
const LIVE_GRID_PADDING = 12;
const LIVE_COLUMN_GAP = 10;
const LIVE_CARD_W = (SCREEN_W - LIVE_GRID_PADDING * 2 - LIVE_COLUMN_GAP) / 2;
const LIVE_CARD_H = LIVE_CARD_W * 1.4;

function formatCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function LiveTab({ navigation, headerComponent }) {
  const renderLiveCard = useCallback(({ item, index }) => {
    return (
      <TouchableOpacity
        style={liveStyles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('LiveView', { allLives: MOCK_LIVES, initialIndex: index })}
      >
        <Image source={{ uri: item.image }} style={liveStyles.cardImage} resizeMode="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          locations={[0.4, 1]}
          style={liveStyles.cardGradient}
          pointerEvents="none"
        />

        {/* LIVE badge + viewers */}
        <View style={liveStyles.liveBadge}>
          <View style={liveStyles.liveDot} />
          <Text style={liveStyles.liveText}>LIVE</Text>
        </View>

        <View style={liveStyles.viewerBadge}>
          <Ionicons name="eye" size={9} color="#FFFFFF" />
          <Text style={liveStyles.viewerText}>{formatCount(item.viewers)}</Text>
        </View>

        {/* Bottom info */}
        <View style={liveStyles.cardInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={liveStyles.cardName}>{item.name}, {item.age}</Text>
            {item.verified && <Ionicons name="checkmark-circle" size={12} color="#4DA6FF" />}
          </View>
          <Text style={liveStyles.cardCaption} numberOfLines={1}>{item.caption}</Text>
        </View>

      </TouchableOpacity>
    );
  }, [navigation]);

  return (
    <FlatList
      data={MOCK_LIVES}
      keyExtractor={(item) => item.id}
      renderItem={renderLiveCard}
      numColumns={2}
      columnWrapperStyle={liveStyles.row}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={liveStyles.grid}
      ListHeaderComponent={headerComponent}
      initialNumToRender={6}
      maxToRenderPerBatch={8}
      windowSize={5}
      removeClippedSubviews
    />
  );
}

const liveStyles = StyleSheet.create({
  // No horizontal padding on the contentContainerStyle — that would
  // also inset the ListHeaderComponent (the shared tabs/filter row),
  // causing a visible shift when you toggle Feed → Live. Instead, the
  // row wrapper carries the horizontal inset, so only the card grid
  // is padded; the header lines up with the Feed.
  grid: {
    paddingTop: 4,
    paddingBottom: 80,
  },
  row: {
    paddingHorizontal: LIVE_GRID_PADDING,
    gap: LIVE_COLUMN_GAP,
    marginBottom: LIVE_COLUMN_GAP,
  },
  card: {
    width: LIVE_CARD_W,
    height: LIVE_CARD_H,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  liveBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(206,17,38,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  liveText: {
    fontSize: 8,
    fontWeight: '900',
    fontFamily: 'DMSans-ExtraBold',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  viewerBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  viewerText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'DMSans-Bold',
    color: '#FFFFFF',
  },
  cardInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  cardName: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'DMSans-Bold',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  cardCaption: {
    fontSize: 11,
    fontFamily: 'DMSans-Regular',
    color: 'rgba(255,255,255,0.7)',
  },
});

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: Layout.headerHeight,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    ...Typography.tabTitle,
    color: colors.black,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerFlag: {
    fontSize: 22,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    backgroundColor: colors.gray300,
  },
  // ─── Filter Bar ───
  filterBarWrap: {
    paddingTop: Layout.filterGap,
    paddingBottom: 6,
    backgroundColor: 'transparent',
  },
  filterBarContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: isDark ? colors.gray800 : 'rgba(38,38,38,0.14)',
    backgroundColor: colors.surface,
    minHeight: 34,
  },
  filterPillAccent: {
    backgroundColor: isDark ? colors.gray300 : colors.gray700,
    borderColor: isDark ? colors.gray300 : colors.gray700,
  },
  filterPillActive: {
    backgroundColor: isDark ? colors.gray300 : colors.gray700,
    borderColor: isDark ? colors.gray300 : colors.gray700,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: isDark ? 'rgba(255,255,255,0.92)' : colors.gray700,
  },
  filterPillTextActive: {
    color: isDark ? colors.black : '#FFFFFF',
    fontWeight: '700',
  },

  content: {
    flex: 1,
  },
  // ─── Search ───
  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    paddingTop: 2,
    backgroundColor: 'transparent',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
  },
  searchInput: {
    flex: 1,
    ...Typography.caption,
    fontSize: 14,
    color: colors.black,
    paddingVertical: 0,
  },
  activeFilterMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  activeFilterMetaText: {
    ...Typography.caption,
    color: colors.gray600,
  },
  clearFiltersText: {
    ...Typography.captionBold,
    color: colors.accent,
  },
  feedList: {
    paddingBottom: 80,
    paddingTop: 4,
  },

  // ─── Groups ───
  createGroupCta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 6,
    padding: 12,
    borderRadius: 14,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : colors.gray200,
    gap: 10,
  },
  createGroupIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createGroupTitle: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.black,
  },
  createGroupSub: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    color: colors.gray500,
    marginTop: 1,
  },
  groupsContent: {
    paddingBottom: 80,
    paddingTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.black,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  myGroupsRow: {
    paddingHorizontal: 16,
    gap: 12,
  },
  myGroupCard: {
    width: 110,
    backgroundColor: isDark ? colors.gray200 : colors.gray100,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
  },
  myGroupIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.royalLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  myGroupIconGrad: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  myGroupName: {
    ...Typography.captionBold,
    color: colors.black,
    textAlign: 'center',
    marginBottom: 4,
  },
  myGroupMembers: {
    ...Typography.caption,
    color: colors.gray500,
    fontSize: 12,
  },
  discoverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: isDark ? 'rgba(255,255,255,0.04)' : colors.separator,
  },
  discoverIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.royalLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  discoverInfo: {
    flex: 1,
  },
  discoverName: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.black,
    marginBottom: 2,
  },
  discoverDesc: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    color: colors.gray600,
    lineHeight: 18,
    marginBottom: 4,
  },
  discoverMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  discoverMembers: {
    ...Typography.caption,
    color: colors.gray500,
    fontSize: 12,
  },
  discoverJoinBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: colors.accent,
  },
  discoverJoinText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },

  // ─── Events CTA ───
  eventsCtaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 8,
  },
  eventsCtaIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventsCtaTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    letterSpacing: -0.1,
  },
  eventsCtaSub: {
    ...Typography.caption,
    marginTop: 1,
  },

  // ─── Combined Bar (Tabs + Filters) ───
  combinedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 4,
    paddingRight: 8,
    backgroundColor: 'transparent',
  },
  barDivider: {
    width: 1,
    height: 18,
    backgroundColor: colors.separator,
    marginHorizontal: 3,
  },
  segmentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: isDark ? colors.gray800 : 'rgba(38,38,38,0.14)',
    minHeight: 34,
  },
  segmentPillActive: {
    backgroundColor: isDark ? colors.gray300 : colors.gray700,
    borderColor: isDark ? colors.gray300 : colors.gray700,
  },
  segmentPillText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: isDark ? 'rgba(255,255,255,0.92)' : colors.gray700,
  },
  segmentPillTextActive: {
    color: isDark ? colors.black : '#FFFFFF',
    fontWeight: '700',
  },
  moreFilterBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
  },

  // ─── Filter Modal — tall bottom sheet ───
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    minHeight: '85%',
  },
  modalGrabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray300,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: colors.black,
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  modalSectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.gray500,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 4,
  },
  modalPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  modalFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.cardBg,
  },
  modalFilterPillActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  modalFilterText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.gray600,
  },
  modalDoneBtn: {
    backgroundColor: colors.black,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  modalDoneText: {
    color: colors.cardBg,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },

  // ─── FAB ───
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 20,
  },
  fabGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
