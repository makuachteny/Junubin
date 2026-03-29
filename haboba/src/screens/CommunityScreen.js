import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily, getShadow, Layout } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';
import { GraffitiCommunity, GraffitiSparkles, GraffitiFlame, GraffitiLocation, GraffitiStar } from '../components/icons';
import { GraffitiSectionDivider } from '../components/GraffitiAccents';
import PostCard from '../components/PostCard';
import ThemedRefreshControl from '../components/ThemedRefreshControl';
import EmptyState from '../components/EmptyState';
import SkeletonShimmer from '../components/SkeletonShimmer';
import AdBanner from '../components/AdBanner';
import { mockPosts, mockGroups } from '../data/mockProfiles';
import { imageSource } from '../utils/imageSource';
import { useCurrentUser } from '../hooks';
import { mockEvents } from '../data/mockEvents';
import { applyCommunityFilters } from '../utils/communityFilters';

const FIXED_TABS = ['Feed', 'Live'];
const OPTIONAL_TABS = ['Groups', 'Events'];

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

export default function CommunityScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { currentUser } = useCurrentUser();
  const [activeTab, setActiveTab] = useState('Feed');
  const [enabledOptionalTabs, setEnabledOptionalTabs] = useState(['Groups', 'Events']);
  const visibleTabs = [...FIXED_TABS, ...OPTIONAL_TABS.filter((t) => enabledOptionalTabs.includes(t))];
  const [activeFilters, setActiveFilters] = useState([]);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
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

  useEffect(() => {
    const timer = setTimeout(() => {
      setPosts(mockPosts);
      setIsLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const createdPost = route?.params?.createdPost;
    if (!createdPost) return;
    setPosts((prev) => [createdPost, ...prev.filter((p) => p.id !== createdPost.id)]);
    setActiveTab('Feed');
    navigation.setParams({ createdPost: undefined });
  }, [route?.params?.createdPost, navigation]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setPosts(mockPosts);
      setRefreshing(false);
    }, 800);
  }, []);

  const renderPost = useCallback(({ item }) => (
    <PostCard post={item} />
  ), []);

  const keyExtractor = useCallback((item) => item.id, []);
  const filteredPosts = useMemo(
    () => applyCommunityFilters(posts, activeFilters),
    [posts, activeFilters]
  );
  const filteredMyGroups = useMemo(
    () => applyCommunityFilters(mockGroups.myGroups, activeFilters),
    [activeFilters]
  );
  const filteredDiscoverGroups = useMemo(
    () => applyCommunityFilters(mockGroups.discover, activeFilters),
    [activeFilters]
  );
  const filteredEvents = useMemo(
    () => applyCommunityFilters(mockEvents, activeFilters),
    [activeFilters]
  );

  // ─── Groups tab content ───
  const renderGroups = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.groupsContent}
      refreshControl={
        <ThemedRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {renderActiveMeta()}
      {/* My Groups — horizontal scroll */}
      <Text style={styles.sectionTitle}>My Groups</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.myGroupsRow}
      >
        {filteredMyGroups.map((group) => (
          <TouchableOpacity
            key={group.id}
            style={styles.myGroupCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('GroupDetail', { group })}
          >
            <View style={styles.myGroupIcon}>
              <GraffitiCommunity size={20} color={colors.royal} filled />
            </View>
            <Text style={styles.myGroupName} numberOfLines={1}>{group.name}</Text>
            <Text style={styles.myGroupMembers}>{group.members} members</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {filteredMyGroups.length === 0 && (
        <EmptyState
          icon="people-outline"
          title="No groups match filters"
          subtitle="Try removing a filter to see more groups."
        />
      )}

      {/* Graffiti section divider */}
      <GraffitiSectionDivider colors={colors} style={{ marginTop: 16 }} />

      {/* Discover Groups — vertical list */}
      <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Discover Groups</Text>
      {filteredDiscoverGroups.map((group) => (
        <TouchableOpacity
          key={group.id}
          style={styles.discoverCard}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('GroupDetail', { group })}
        >
          <View style={styles.discoverIcon}>
            <GraffitiCommunity size={22} color={colors.royal} filled />
          </View>
          <View style={styles.discoverInfo}>
            <Text style={styles.discoverName}>{group.name}</Text>
            <Text style={styles.discoverDesc} numberOfLines={2}>{group.description}</Text>
            <Text style={styles.discoverMembers}>{group.members.toLocaleString()} members</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
        </TouchableOpacity>
      ))}
      {filteredDiscoverGroups.length === 0 && (
        <EmptyState
          icon="search-outline"
          title="No discover groups found"
          subtitle="Adjust filters to broaden results."
        />
      )}
    </ScrollView>
  );

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
        <Text style={styles.headerTitle}>Community</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.gray500} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
            <Image source={imageSource(currentUser.images?.[0])} style={styles.avatar} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ─── Tabs + Inline Filters ─── */}
      <Animated.View
        style={{
          opacity: contentAnim,
          transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.combinedBar}
        >
          {visibleTabs.map((tab) => {
            const isTabActive = activeTab === tab;
            const TAB_ICONS = { Feed: 'newspaper-outline', Live: 'radio-outline', Groups: 'people-outline', Events: 'calendar-outline' };
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.segmentPill, isTabActive && styles.segmentPillActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={TAB_ICONS[tab] || 'ellipse-outline'}
                  size={15}
                  color={isTabActive ? '#FFFFFF' : colors.gray500}
                  style={{ marginRight: 5 }}
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
            const GRAFFITI_MAP = { sparkles: GraffitiSparkles, flame: GraffitiFlame, location: GraffitiLocation, community: GraffitiCommunity, star: GraffitiStar };
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
                  <GraffitiComp size={14} color={isActive ? '#FFFFFF' : colors.gray600} filled={isActive} />
                ) : (
                  <Ionicons name={filter.icon} size={14} color={isActive ? '#FFFFFF' : colors.gray600} />
                )}
                <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            style={styles.moreFilterBtn}
            onPress={() => setShowMoreFilters(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="options-outline" size={18} color={activeFilters.length > 0 ? colors.black : colors.gray500} />
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>

      {/* ─── More Filters Modal ─── */}
      <Modal visible={showMoreFilters} transparent animationType="fade" onRequestClose={() => setShowMoreFilters(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowMoreFilters(false)}>
          <View style={styles.modalSheet} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Customize</Text>

            <Text style={styles.modalSectionLabel}>Tabs</Text>
            <View style={styles.modalPillRow}>
              {OPTIONAL_TABS.map((tab) => {
                const isOn = enabledOptionalTabs.includes(tab);
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.modalFilterPill, isOn && styles.modalFilterPillActive]}
                    onPress={() => {
                      setEnabledOptionalTabs((prev) =>
                        prev.includes(tab) ? prev.filter((t) => t !== tab) : [...prev, tab]
                      );
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={tab === 'Groups' ? 'people-outline' : 'calendar-outline'} size={16} color={isOn ? (isDark ? '#1A1A1A' : '#FFF') : colors.gray600} />
                    <Text style={[styles.modalFilterText, isOn && { color: isDark ? '#1A1A1A' : '#FFF' }]}>{tab}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.modalSectionLabel}>Filters</Text>
            <View style={styles.modalPillRow}>
              {COMMUNITY_FILTERS.slice(INLINE_FILTER_COUNT).map((filter) => {
                const isActive = activeFilters.includes(filter.id);
                const GRAFFITI_MAP = { sparkles: GraffitiSparkles, flame: GraffitiFlame, location: GraffitiLocation, community: GraffitiCommunity, star: GraffitiStar };
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
                      <GraffitiComp size={16} color={isActive ? (isDark ? '#1A1A1A' : '#FFFFFF') : colors.gray600} filled={isActive} />
                    ) : (
                      <Ionicons name={filter.icon} size={16} color={isActive ? (isDark ? '#1A1A1A' : '#FFFFFF') : colors.gray600} />
                    )}
                    <Text style={[styles.modalFilterText, isActive && { color: isDark ? '#1A1A1A' : '#FFF' }]}>{filter.label}</Text>
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
            transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          },
        ]}
      >
        {activeTab === 'Live' ? (
          <LiveTab navigation={navigation} insets={insets} />
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
              data={filteredPosts}
              keyExtractor={keyExtractor}
              renderItem={renderPost}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.feedList}
              maxToRenderPerBatch={6}
              windowSize={5}
              refreshControl={
                <ThemedRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
              }
              ListHeaderComponent={(
                <View>
                  {renderActiveMeta()}
                  <AdBanner colors={colors} />
                </View>
              )}
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
        ) : activeTab === 'Events' ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.groupsContent}>
            {renderActiveMeta()}
            <TouchableOpacity
              style={[styles.eventsCtaCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F4F4F6', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E8E8EC' }]}
              onPress={() => navigation.navigate('Events')}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar" size={24} color={colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.eventsCtaTitle, { color: colors.black }]}>Upcoming Events</Text>
                <Text style={[styles.eventsCtaSub, { color: colors.gray }]}>{filteredEvents.length} events near you</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.gold} />
            </TouchableOpacity>
            {filteredEvents.slice(0, 3).map((evt) => (
              <TouchableOpacity
                key={evt.id}
                style={styles.discoverCard}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('EventDetail', { event: evt })}
              >
                <View style={[styles.discoverIcon, { backgroundColor: colors.goldLight }]}>
                  <Ionicons name="calendar-outline" size={22} color={colors.gold} />
                </View>
                <View style={styles.discoverInfo}>
                  <Text style={[styles.discoverName, { color: colors.black }]}>{evt.title}</Text>
                  <Text style={[styles.discoverDesc, { color: colors.gray600 }]}>{evt.date} - {evt.time}</Text>
                  <Text style={[styles.discoverMembers, { color: colors.gray500 }]}>{evt.attendees} attending</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
              </TouchableOpacity>
            ))}
            {filteredEvents.length === 0 && (
              <EmptyState
                icon="calendar-outline"
                title="No events match filters"
                subtitle="Try another filter to see more events."
              />
            )}
          </ScrollView>
        ) : (
          renderGroups()
        )}
      </Animated.View>

      {/* ─── FAB — Feed or Reels tab ─── */}
      {(activeTab === 'Feed' || activeTab === 'Live') && (
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.85}
          onPress={() => activeTab === 'Live' ? navigation.navigate('GoLive') : navigation.navigate('CreatePost')}
        >
          <LinearGradient
            colors={['#000000', '#CE1126', '#009739']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <Ionicons name={activeTab === 'Live' ? 'radio' : 'add'} size={22} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      )}
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

const LIVE_CARD_W = (SCREEN_W - 32 - 10) / 2;
const LIVE_CARD_H = LIVE_CARD_W * 1.4;

function formatCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function LiveTab({ navigation }) {
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
    />
  );
}

const liveStyles = StyleSheet.create({
  grid: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  row: {
    gap: 10,
    marginBottom: 10,
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
    fontSize: 9,
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
    fontSize: 28,
    fontFamily: FontFamily.black,
    fontWeight: '900',
    color: colors.black,
    letterSpacing: -0.8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.gray300,
    backgroundColor: colors.gray300,
  },
  // ─── Filter Bar ───
  filterBarWrap: {
    paddingTop: Layout.filterGap,
    paddingBottom: 6,
  },
  filterBarContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
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
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: isDark ? 'rgba(255,255,255,0.92)' : colors.gray700,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  content: {
    flex: 1,
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
  groupsContent: {
    paddingBottom: 40,
  },
  sectionTitle: {
    ...Typography.sectionTitle,
    color: colors.black,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  myGroupsRow: {
    paddingLeft: 16,
    paddingRight: 8,
    gap: 12,
  },
  myGroupCard: {
    width: 120,
    backgroundColor: isDark ? colors.gray200 : colors.gray100,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    ...getShadow('sm', isDark),
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
  myGroupName: {
    ...Typography.captionBold,
    color: colors.black,
    textAlign: 'center',
    marginBottom: 4,
  },
  myGroupMembers: {
    ...Typography.caption,
    color: colors.gray500,
    fontSize: 11,
  },
  discoverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  discoverIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.royalLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  discoverInfo: {
    flex: 1,
  },
  discoverName: {
    ...Typography.sectionLabel,
    color: colors.black,
    marginBottom: 3,
  },
  discoverDesc: {
    ...Typography.bodySmall,
    color: colors.gray600,
    lineHeight: 18,
    marginBottom: 4,
  },
  discoverMembers: {
    ...Typography.caption,
    color: colors.gray500,
    fontSize: 11,
  },

  // ─── Events CTA ───
  eventsCtaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  eventsCtaTitle: {
    ...Typography.sectionLabel,
    marginBottom: 2,
  },
  eventsCtaSub: {
    ...Typography.caption,
  },

  // ─── Combined Bar (Tabs + Filters) ───
  combinedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingRight: 8,
    backgroundColor: colors.white,
  },
  barDivider: {
    width: 1,
    height: 22,
    backgroundColor: colors.separator,
    marginHorizontal: 4,
  },
  segmentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
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
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: isDark ? 'rgba(255,255,255,0.92)' : colors.gray700,
  },
  segmentPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  moreFilterBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: isDark ? colors.gray300 : colors.surfaceMuted,
  },

  // ─── Filter Modal ───
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: colors.black,
    marginBottom: 20,
  },
  modalSectionLabel: {
    fontSize: 12,
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
    backgroundColor: colors.white,
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
    color: isDark ? '#1A1A1A' : '#FFF',
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
