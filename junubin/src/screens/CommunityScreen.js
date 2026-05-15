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
  Modal,
  Pressable,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily, Layout } from '../theme';
import { GraffitiCommunity, GraffitiSparkles, GraffitiFlame, GraffitiLocation, GraffitiStar } from '../components/icons';
import PostCard from '../components/PostCard';
import ThemedRefreshControl from '../components/ThemedRefreshControl';
import EmptyState from '../components/EmptyState';
import Toast from '../components/Toast';
import SkeletonShimmer from '../components/SkeletonShimmer';
import { mockPosts } from '../data/__dev__/mockProfiles';
import { imageSource } from '../utils/imageSource';
import { DEMO_DATA_ENABLED } from '../config/demoData';
import * as postService from '../api/services/postService';
import { supabase } from '../config/supabase';
import { useAuth } from '../auth';
import { useCurrentUser } from '../hooks';
import { applyCommunityFilters } from '../utils/communityFilters';

const FIXED_TABS = ['Feed', 'Media'];

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
  const { width: screenW } = useWindowDimensions();
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
  const demoPosts = DEMO_DATA_ENABLED ? mockPosts : [];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const live = await postService.listPosts();
        if (cancelled) return;
        // Show real posts first; demo posts trail behind so a real
        // post always floats to the top of the feed. Demo posts
        // disappear automatically once enough real posts exist.
        const combined = live.length > 0 ? [...live, ...demoPosts] : demoPosts;
        setPosts(await hydrateInteractionState(combined));
      } catch {
        if (!cancelled) setPosts(demoPosts);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [demoPosts]);

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
      const combined = live.length > 0 ? [...live, ...demoPosts] : demoPosts;
      setPosts(await hydrateInteractionState(combined));
    } catch {
      setPosts(demoPosts);
    } finally {
      setRefreshing(false);
    }
  }, [demoPosts]);

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

  // Media tab: every post in the filtered list that carries an image
  // or video. Posts where the upload is still being processed (image
  // === null) are skipped so the grid never shows blank tiles. Order
  // mirrors the Feed (newest first), so a freshly-posted photo
  // surfaces at the top of both tabs.
  const mediaPosts = useMemo(
    () => filteredPosts.filter((p) => p?.image || p?.video),
    [filteredPosts],
  );

  // Two-column grid sized to the screen width minus the outer padding
  // and the column gap. useWindowDimensions reacts to rotations on iPad
  // / split-view, so tiles re-square themselves without a remount.
  const MEDIA_PADDING = 12;
  const MEDIA_GAP = 6;
  const mediaTileSize = Math.floor((screenW - MEDIA_PADDING * 2 - MEDIA_GAP) / 2);

  const renderMediaTile = useCallback(({ item }) => {
    const isVideo = !!item.video;
    const uri = item.image || item.video;
    return (
      <TouchableOpacity
        style={[styles.mediaTile, { width: mediaTileSize, height: mediaTileSize }]}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('PostDetail', { post: item })}
      >
        <Image source={imageSource(uri)} style={styles.mediaImage} resizeMode="cover" />
        {isVideo && (
          <View style={styles.mediaPlayBadge} pointerEvents="none">
            <Ionicons name="play" size={14} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  }, [mediaTileSize, navigation, styles.mediaImage, styles.mediaPlayBadge, styles.mediaTile]);

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
          const TAB_ICONS = { Feed: 'newspaper-outline', Media: 'images-outline' };
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

  const feedHeader = (
    <View>
      {tabsAndFilters}
      {renderActiveMeta()}
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
      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentAnim,
            transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
          },
        ]}
      >
        {activeTab === 'Feed' ? (
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
        ) : activeTab === 'Media' ? (
          <FlatList
            data={mediaPosts}
            keyExtractor={keyExtractor}
            renderItem={renderMediaTile}
            numColumns={2}
            columnWrapperStyle={styles.mediaRow}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.mediaGrid}
            initialNumToRender={8}
            maxToRenderPerBatch={12}
            windowSize={6}
            removeClippedSubviews
            refreshControl={
              <ThemedRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
            ListHeaderComponent={feedHeader}
            ListEmptyComponent={
              <EmptyState
                icon="images-outline"
                title="No photos or videos yet"
                subtitle="Be the first to share a moment with the community."
                actionLabel="Create Post"
                onAction={() => navigation.navigate('CreatePost')}
              />
            }
          />
        ) : null}
      </Animated.View>

      <Toast
        visible={postedToast}
        message="Posted"
        onDismiss={() => setPostedToast(false)}
      />
    </View>
  );
}


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

  // ─── Media grid ───
  mediaGrid: {
    paddingTop: 4,
    paddingBottom: 80,
  },
  mediaRow: {
    paddingHorizontal: 12,
    gap: 6,
    marginBottom: 6,
  },
  mediaTile: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: isDark ? colors.gray800 : colors.gray200,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  mediaPlayBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
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

});
