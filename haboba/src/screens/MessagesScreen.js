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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GraffitiChat } from '../components/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, Typography, FontFamily, getShadow, Gradients } from '../theme';
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
import StoriesRow from '../components/StoriesRow';
import AdBanner from '../components/AdBanner';
import ProfilePromptBanner from '../components/ProfilePromptBanner';
import { mockStories } from '../data/mockStories';
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
      Alert.alert('Junub Feature', 'Upgrade to Junub to message people who liked you.', [
        { text: 'Upgrade', onPress: () => navigation.navigate('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    navigation.navigate('Chat', { match: like });
  };

  // Build combined conversation list: likes first, then matches
  const conversationData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const likeItems = likes.map((like) => ({ ...like, type: 'like' }));
    const matchItems = matches.map((match) => ({ ...match, type: 'match' }));
    const all = [...likeItems, ...matchItems];
    if (!q) return all;
    return all.filter((item) => item.name?.toLowerCase().includes(q));
  }, [likes, matches, searchQuery]);

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
            accessibilityLabel={prefs?.screenReaderHints ? `${item.name}, liked you recently` : item.name}
          >
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={(e) => {
                e.stopPropagation?.();
                handleOpenStoryIfAvailable(item);
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
            </TouchableOpacity>
            <View style={styles.msgInfo}>
              <View style={styles.msgNameInline}>
                <Text style={styles.msgName}>{item.name}</Text>
                <View style={styles.likesYouBadge}>
                  <Text style={styles.likesYouText}>Likes You</Text>
                </View>
              </View>
              <Text style={styles.msgPreview}>Liked you recently, match now!</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
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
          <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const listHeader = useCallback(() => (
    <>
      {/* ─── Upsell Banner (free users) ─── */}
      {!hasTier('plus') && (
        <ProfilePromptBanner
          message="Unlock unlimited messages with JuNubin+"
          onPress={() => navigation.navigate('Elite')}
          colors={colors}
        />
      )}

      {/* ─── Stories Row ─── */}
      <StoriesRow
        colors={colors}
        onStoryPress={(story, index, storyList) => navigation.navigate('StoriesView', { story, storyIndex: index, storyList })}
        onCreateStory={() => navigation.navigate('CreateStory')}
      />

      {/* ─── Ad Banner (free tier) ─── */}
      <AdBanner colors={colors} />

      {/* ─── Search Bar ─── */}
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
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={colors.gray400} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ─── Messages header ─── */}
      <View style={styles.messagesHeader}>
        <Text style={styles.messagesTitle}>Messages</Text>
        <Ionicons name="notifications" size={15} color={colors.black} />
      </View>
    </>
  ), [colors, isDark, styles, searchQuery, likes, navigation, hasTier]);

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
        <TouchableOpacity
          style={styles.headerSettingsBtn}
          onPress={() => navigation.navigate('Settings')}
          activeOpacity={0.75}
        >
          <Ionicons name="options-outline" size={18} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chats</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
          <Image source={imageSource(currentUser?.images?.[0])} style={styles.headerAvatar} />
        </TouchableOpacity>
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
    </View>
  );
}

const getStyles = (colors, isDark, prefs = {}) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },

  // ─── Header ───
  header: {
    width: '100%',
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    marginBottom: 6,
  },
  headerSettingsBtn: {
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
  headerTitle: {
    fontSize: 34,
    fontFamily: FontFamily.script,
    color: colors.black,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.gray300,
    ...getShadow('md', isDark),
  },

  // ─── Search Bar ───
  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? colors.gray200 : colors.gray100,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 40,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    color: colors.black,
    paddingVertical: 0,
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
    paddingVertical: prefs?.largerTouchTargets ? 16 : 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatarRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    padding: 2.5,
  },
  msgAvatar: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: colors.gray300,
    borderWidth: 2,
    borderColor: colors.white,
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
  msgNameInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  msgName: {
    ...Typography.sectionLabel,
    color: colors.black,
    flex: 1,
  },
  msgTime: {
    ...Typography.caption,
    color: prefs?.highContrast ? colors.gray700 : colors.gray500,
    marginLeft: 8,
  },
  msgPreview: {
    ...Typography.bodySmall,
    color: prefs?.highContrast ? colors.gray700 : colors.gray600,
    marginTop: 2,
    lineHeight: 18,
  },
  unreadBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentTint10,
  },
  unreadBadgeText: {
    ...Typography.captionBold,
    color: colors.accent,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  msgUnread: {
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.black,
  },
  likesYouBadge: {
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginLeft: 8,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  likesYouText: {
    ...Typography.captionBold,
    color: '#FFFFFF',
    fontSize: 11,
    letterSpacing: 0.3,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
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
});
