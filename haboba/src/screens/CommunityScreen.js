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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily, getShadow } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';
import { GraffitiCommunity, GraffitiSparkles, GraffitiFlame, GraffitiLocation, GraffitiStar } from '../components/icons';
import { GraffitiSectionDivider } from '../components/GraffitiAccents';
import UnderlineTabs from '../components/UnderlineTabs';
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

const TABS = ['Feed', 'Groups', 'Events'];

const COMMUNITY_FILTERS = [
  { id: 'fun', label: 'Fun', icon: 'sparkles', accent: true, graffitiIcon: 'sparkles' },
  { id: 'trending', label: 'Trending', icon: 'trending-up', graffitiIcon: 'flame' },
  { id: 'nearby', label: 'Nearby', icon: 'location', graffitiIcon: 'location' },
  { id: 'new', label: 'New', icon: 'time' },
  { id: 'friends', label: 'Friends', icon: 'people', graffitiIcon: 'community' },
  { id: 'popular', label: 'Popular', icon: 'flame', graffitiIcon: 'star' },
];

export default function CommunityScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { currentUser } = useCurrentUser();
  const [activeTab, setActiveTab] = useState('Feed');
  const [activeFilters, setActiveFilters] = useState([]);
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

  const handleFilterPress = useCallback((filterId) => {
    if (filterId === 'fun') {
      navigation.navigate('InteractivityHub');
      return;
    }
    setActiveFilters((prev) =>
      prev.includes(filterId)
        ? prev.filter((f) => f !== filterId)
        : [...prev, filterId]
    );
  }, [navigation]);

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
              <GraffitiCommunity size={20} color={colors.accent} filled />
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
            <GraffitiCommunity size={22} color={colors.accent} filled />
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
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => navigation.navigate('Settings')}
          activeOpacity={0.75}
        >
          <Ionicons name="options-outline" size={18} color={colors.black} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Community</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
          <Image source={imageSource(currentUser.images?.[0])} style={styles.avatar} />
        </TouchableOpacity>
      </Animated.View>

      {/* ─── Filter Bar ─── */}
      <Animated.View
        style={[
          styles.filterBarWrap,
          {
            opacity: contentAnim,
            transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
          },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBarContent}
        >
          {COMMUNITY_FILTERS.map((filter) => {
            const isActive = filter.accent || activeFilters.includes(filter.id);
            const iconColor = isActive ? '#FFFFFF' : colors.gray600;
            const GRAFFITI_MAP = {
              sparkles: GraffitiSparkles,
              flame: GraffitiFlame,
              location: GraffitiLocation,
              community: GraffitiCommunity,
              star: GraffitiStar,
            };
            const GraffitiComp = filter.graffitiIcon ? GRAFFITI_MAP[filter.graffitiIcon] : null;
            return (
              <TouchableOpacity
                key={filter.id}
                style={[
                  styles.filterPill,
                  isActive && filter.accent && styles.filterPillAccent,
                  isActive && !filter.accent && styles.filterPillActive,
                ]}
                onPress={() => handleFilterPress(filter.id)}
                activeOpacity={0.8}
              >
                {GraffitiComp ? (
                  <GraffitiComp size={14} color={iconColor} filled={isActive} />
                ) : (
                  <Ionicons
                    name={filter.icon}
                    size={14}
                    color={iconColor}
                  />
                )}
                <Text
                  style={[
                    styles.filterPillText,
                    isActive
                      ? styles.filterPillTextActive
                      : { color: colors.gray600 },
                  ]}
                >
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* ─── Tabs ─── */}
      <Animated.View
        style={{
          opacity: contentAnim,
          transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
          paddingHorizontal: 16,
          paddingBottom: 4,
        }}
      >
        <UnderlineTabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      </Animated.View>
      {activeFilters.length > 0 && (
        <View style={styles.activeFilterMeta}>
          <Text style={styles.activeFilterMetaText}>
            {activeFilters.length} filter{activeFilters.length > 1 ? 's' : ''} active
          </Text>
          <TouchableOpacity onPress={() => setActiveFilters([])} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={styles.clearFiltersText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

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
              ListHeaderComponent={<AdBanner colors={colors} />}
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
            <TouchableOpacity
              style={[styles.eventsCtaCard, { backgroundColor: colors.accentTint08, borderColor: colors.accentTint15 }]}
              onPress={() => navigation.navigate('Events')}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar" size={24} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.eventsCtaTitle, { color: colors.black }]}>Upcoming Events</Text>
                <Text style={[styles.eventsCtaSub, { color: colors.gray }]}>{filteredEvents.length} events near you</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.accent} />
            </TouchableOpacity>
            {filteredEvents.slice(0, 3).map((evt) => (
              <TouchableOpacity
                key={evt.id}
                style={styles.discoverCard}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('EventDetail', { event: evt })}
              >
                <View style={[styles.discoverIcon, { backgroundColor: colors.accentTint10 }]}>
                  <Ionicons name="calendar-outline" size={22} color={colors.accent} />
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

      {/* ─── FAB — Feed tab only ─── */}
      {activeTab === 'Feed' && (
        <TouchableOpacity
          style={styles.fab}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('CreatePost')}
        >
          <LinearGradient
            colors={['#000000', '#EF4444', '#22C55E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <Ionicons name="add" size={28} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

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
    height: 56,
    backgroundColor: colors.white,
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 34,
    fontFamily: FontFamily.script,
    color: colors.black,
    textAlign: 'center',
    letterSpacing: 0.3,
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
  settingsBtn: {
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

  // ─── Filter Bar ───
  filterBarWrap: {
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.white,
  },
  filterPillAccent: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  filterPillActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
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
    backgroundColor: colors.accentTint10,
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
    backgroundColor: colors.accentTint10,
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

  // ─── FAB ───
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
