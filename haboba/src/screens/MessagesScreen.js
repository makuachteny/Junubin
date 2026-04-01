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
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, Typography, FontFamily, Layout } from '../theme';
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

  // Read current mode
  useEffect(() => {
    AsyncStorage.getItem('@haboba_mode').then((stored) => {
      if (stored === 'Dating' || stored === 'Social') setMode(stored);
    });
  }, []);
  const filtersLocked = !isPlus;

  const showFiltersLocked = useCallback(() => {
    Alert.alert('JuNubin+ Filters', 'Upgrade to JuNubin+ to unlock message filters and search.', [
      { text: 'Upgrade', onPress: () => navigation.navigate('Elite') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [navigation]);

  const fetchMatches = useCallback(() => {
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
    }).finally(() => setIsLoading(false));
  }, [session]);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  // Live match listener — re-fetch when a new match is created
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
    navigation.navigate('Chat', { match: like });
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
      return (
        <Animated.View style={animStyle}>
          <TouchableOpacity
            style={styles.messageRow}
            onPress={() => handleLikePress(item)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={prefs?.screenReaderHints ? `${item.name}, ${mode === 'Social' ? 'waved at you' : 'liked you recently'}` : item.name}
          >
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={(e) => {
                e.stopPropagation?.();
                handleOpenStoryIfAvailable(item);
              }}
              activeOpacity={0.8}
            >
              <Image source={imageSource(item.images?.[0])} style={styles.msgAvatar} />
            </TouchableOpacity>
            <View style={styles.msgInfo}>
              <Text style={styles.msgName}>{item.name}</Text>
              <Text style={styles.msgPreview}>{mode === 'Social' ? 'Waved at you! Say hi back' : 'Liked you recently, match now!'}</Text>
            </View>
            <View style={styles.likesYouRight}>
              <View style={styles.likesYouBadge}>
                <Text style={styles.likesYouText}>{mode === 'Social' ? 'Says Hi' : 'Likes You'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color={colors.gray400} />
            </View>
          </TouchableOpacity>
        </Animated.View>
      );
    }

    return (
      <Animated.View style={animStyle}>
        <TouchableOpacity
          style={styles.messageRow}
          onPress={() => handleMatchPress(item)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={prefs?.screenReaderHints ? `${item.name}, ${item.unread ? 'unread message' : 'message thread'}` : item.name}
        >
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={(e) => {
              e.stopPropagation?.();
              if (!handleOpenStoryIfAvailable(item)) {
                handleMatchPress(item);
              }
            }}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={Gradients.accent}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarRing}
            >
              <Image source={imageSource(item.images?.[0])} style={styles.msgAvatar} />
            </LinearGradient>
            {item.unread && <View style={styles.unreadDot} />}
          </TouchableOpacity>
          <View style={styles.msgInfo}>
            <View style={styles.msgNameRow}>
              <Text style={styles.msgName}>{item.name}</Text>
              {item.unread && prefs?.nonColorCues && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>Unread</Text>
                </View>
              )}
              <Text style={styles.msgTime}>{item.timestamp}</Text>
            </View>
            <Text style={[styles.msgPreview, item.unread && styles.msgUnread]}>
              {item.lastMessage}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={colors.gray400} />
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
      <AdBanner colors={colors} />

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
  ), [colors, isDark, navigation, hasTier, likesCount, filtersPanel]);

  const filtersPanel = useCallback(() => (
    <View style={styles.filtersPanel}>
      <View style={styles.categoryRow}>
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
  ), [CATEGORIES, activeCategory, filtersLocked, searchQuery, colors, showFiltersLocked]);

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
          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.gray500} />
          </TouchableOpacity>
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
          maxToRenderPerBatch={8}
          windowSize={5}
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
    backgroundColor: isDark ? colors.white : '#F4F2EE',
  },

  // ─── Header ───
  header: {
    width: '100%',
    height: Layout.headerHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    marginBottom: 0,
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
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.gray300,
    backgroundColor: colors.gray300,
  },

  filtersPanel: {
    backgroundColor: colors.white,
  },

  // ─── Category Chips ───
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.separator,
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
    color: isDark ? '#1A1A1A' : '#FFFFFF',
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
    paddingBottom: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 44,
    gap: 8,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
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
    paddingVertical: prefs?.largerTouchTargets ? 14 : 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: isDark ? 'rgba(255,255,255,0.04)' : colors.separator,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  msgAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gray300,
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
  msgTime:
 {
    ...Typography.caption,
    fontSize: 13,
    color: prefs?.highContrast ? colors.gray700 : colors.gray500,
    marginLeft: 8,
  },
  msgPreview: {
    ...Typography.caption,
    color: prefs?.highContrast ? colors.gray700 : colors.gray600,
    marginTop: 2,
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
    fontSize: 10,
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
    gap: 6,
    marginLeft: 8,
  },
  likesYouBadge: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  likesYouText: {
    ...Typography.captionBold,
    color: '#FFFFFF',
    fontSize: 12,
    letterSpacing: 0.3,
  },

  // ─── Create Sheet ───
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
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
    fontSize: 10,
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
