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
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, Typography, FontFamily, Layout, Gradients } from '../theme';
import { mockMatches, mockLikes } from '../data/mockProfiles';
import { imageSource } from '../utils/imageSource';
import { useSubscription } from '../payments';
import { useAuth } from '../auth';
import { useCurrentUser } from '../hooks';
import * as matchesService from '../api/services/matchesService';
import * as likesService from '../api/services/likesService';
import { useRealtime } from '../api/hooks/useRealtime';
import MessageListSkeleton from '../components/MessageListSkeleton';
import ThemedRefreshControl from '../components/ThemedRefreshControl';
import AdBanner from '../components/AdBanner';
import ProfilePromptBanner from '../components/ProfilePromptBanner';
import { mockStories } from '../data/mockStories';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAccessibilityPreferences } from '../accessibility';

export default function MessagesScreen({ navigation }) {
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
  const [mode, setMode] = useState('Social');
  const isPlus = hasTier('plus');
  const loadingTimeoutRef = useRef(null);
  const [seenConnections, setSeenConnections] = useState(new Set());

  // Hydrate persisted prefs (mode + seen-connections) in a single round-trip.
  useEffect(() => {
    AsyncStorage.multiGet(['@junubin_seen_connections', '@junubin_mode']).then((entries) => {
      for (const [key, value] of entries) {
        if (!value) continue;
        if (key === '@junubin_mode' && (value === 'Dating' || value === 'Social')) {
          setMode(value);
        } else if (key === '@junubin_seen_connections') {
          try {
            const ids = JSON.parse(value);
            if (Array.isArray(ids)) setSeenConnections(new Set(ids));
          } catch {
            // ignore corrupt cache
          }
        }
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

  const fetchMatches = useCallback(() => {
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    loadingTimeoutRef.current = setTimeout(() => {
      // Failsafe: don't keep skeletons spinning too long
      setMatches((prev) => (prev.length ? prev : mockMatches));
      setLikes((prev) => (prev.length ? prev : mockLikes));
      setIsLoading(false);
    }, 600);

    if (!session) {
      // Fall back to mock data when not authenticated
      setMatches(mockMatches);
      setLikes(mockLikes);
      setIsLoading(false);
      return Promise.resolve();
    }
    return Promise.all([
      matchesService.getMatches().then((apiMatches) => {
        if (apiMatches.length > 0) setMatches(apiMatches);
        else setMatches(mockMatches); // fallback
      }),
      likesService.getReceivedLikes().then((apiLikes) => {
        if (apiLikes.length > 0) setLikes(apiLikes);
        else setLikes(mockLikes); // fallback
      }),
    ]).catch((err) => {
      if (__DEV__) console.warn('Messages fetch failed:', err);
      setMatches(mockMatches);
      setLikes(mockLikes);
    }).finally(() => {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      setIsLoading(false);
    });
  }, [session]);

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

  const handleOpenStoryIfAvailable = useCallback((person) => {
    const name = person?.name?.trim().toLowerCase();
    if (!name) return false;
    const index = mockStories.findIndex((s) => s.userName?.trim().toLowerCase() === name);
    if (index < 0) return false;
    navigation.navigate('StoriesView', {
      story: mockStories[index],
      storyIndex: index,
      storyList: mockStories,
    });
    return true;
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

  // Build combined conversation list with category + search filtering
  const conversationData = useMemo(() => {
    const q = (filtersLocked ? '' : searchQuery).toLowerCase().trim();
    const likeItems = likes.map((like) => ({ ...like, type: 'like' }));
    const matchItems = matches.map((match) => ({ ...match, type: 'match' }));
    let all = [...likeItems, ...matchItems];
    const effectiveCategory = filtersLocked ? 'All' : activeCategory;
    if (effectiveCategory === 'Matches') all = matchItems;
    else if (effectiveCategory === 'Likes') all = likeItems;
    if (q) all = all.filter((item) => item.name?.toLowerCase().includes(q));
    return all;
  }, [likes, matches, searchQuery, activeCategory, filtersLocked]);

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
              <LinearGradient
                colors={isNew ? ['#CE1126', '#FF6B81'] : [colors.gray300, colors.gray300]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatarRing}
              >
                <Image source={imageSource(item.images?.[0])} style={styles.msgAvatar} />
              </LinearGradient>
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

    return (
      <Animated.View style={animStyle}>
        <TouchableOpacity
          style={[styles.messageRow, item.unread && styles.messageRowUnread]}
          onPress={() => handleMatchPress(item)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={prefs?.screenReaderHints ? `${item.name}, ${item.unread ? 'unread message' : 'message thread'}` : item.name}
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
            <LinearGradient
              colors={item.unread ? Gradients.accent : [colors.gray300, colors.gray300]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarRing}
            >
              <Image source={imageSource(item.images?.[0])} style={styles.msgAvatar} />
            </LinearGradient>
            {item.unread && <View style={styles.unreadDot} />}
            <View style={styles.onlineDot} />
          </TouchableOpacity>
          <View style={styles.msgInfo}>
            <View style={styles.msgNameRow}>
              <Text style={[styles.msgName, item.unread && styles.msgNameBold]}>{item.name}</Text>
              {item.unread && prefs?.nonColorCues && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>New</Text>
                </View>
              )}
            </View>
            <Text style={[styles.msgPreview, item.unread && styles.msgUnread]} numberOfLines={1}>
              {item.lastMessage}
            </Text>
          </View>
          <View style={styles.rowRight}>
            <Text style={[styles.msgTime, item.unread && styles.msgTimeUnread]}>{item.timestamp}</Text>
            {item.unread && <View style={styles.unreadCountDot}><Text style={styles.unreadCountText}>1</Text></View>}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const unreadMatchCount = useMemo(() => matches.filter((m) => m.unread).length, [matches]);
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

  const listHeader = useCallback(() => (
    <>
      {/* Filters + search scroll with content */}
      {filtersPanel()}

      {/* ─── Upsell Banner (free users) ─── */}
      {!hasTier('plus') && (
        <ProfilePromptBanner
          message="Unlock unlimited messages with JuNubin+"
          onPress={() => navigation.navigate('Elite')}
          colors={colors}
        />
      )}

      {/* ─── Ad Banner (free tier) ─── */}
      <AdBanner />

      {/* ─── See who likes you upsell (non-Junub) ─── */}
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

    </>
  ), [colors, isDark, navigation, hasTier, likesCount, filtersPanel, newMatchAvatars]);

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
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
            <Image source={imageSource(currentUser?.images?.[0])} style={styles.headerAvatar} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ─── Everything scrolls together ─── */}
      {isLoading ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          {listHeader()}
          <MessageListSkeleton />
        </ScrollView>
      ) : conversationData.length === 0 && !searchQuery ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          {listHeader()}
          <View style={styles.emptyMessages}>
            <GraffitiChat size={50} color={colors.gray400} />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Start swiping to find connections!</Text>
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={conversationData}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          ListHeaderComponent={listHeader}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews
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
            <TouchableOpacity
              style={styles.sheetRow}
              onPress={() => {
                setShowCreateSheet(false);
                navigation.navigate('GoLive');
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="radio-outline" size={20} color="#CE1126" />
              <View style={styles.sheetTextWrap}>
                <Text style={styles.sheetRowTitle}>Go Live</Text>
                <Text style={styles.sheetRowSub}>Start a live session now</Text>
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
    backgroundColor: 'transparent',
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
    paddingTop: 2,
    paddingBottom: 6,
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
    paddingHorizontal: 16,
    paddingVertical: prefs?.largerTouchTargets ? 16 : 13,
    marginHorizontal: 10,
    marginVertical: 3,
    borderRadius: 16,
    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'transparent',
  },
  messageRowUnread: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(206,17,38,0.03)',
  },
  likeRowNew: {
    backgroundColor: isDark ? 'rgba(206,17,38,0.08)' : 'rgba(206,17,38,0.04)',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  msgAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.gray300,
    borderWidth: 2,
    borderColor: colors.cardBg,
  },
  avatarRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
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
  unreadDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
    position: 'absolute',
    bottom: -4,
    right: -4,
    borderWidth: 2,
    borderColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
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
  msgTimeUnread: {
    color: colors.accent,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
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
