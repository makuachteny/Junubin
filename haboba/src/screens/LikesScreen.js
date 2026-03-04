import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily, getShadow } from '../theme';
import { GraffitiLocation, GraffitiHeart } from '../components/icons';
import Button from '../components/Button';
import AdBanner from '../components/AdBanner';
import ProfilePromptBanner from '../components/ProfilePromptBanner';
import EmptyState from '../components/EmptyState';
import ThemedRefreshControl from '../components/ThemedRefreshControl';
import { mockLikes } from '../data/mockProfiles';
import { imageSource } from '../utils/imageSource';
import { useSubscription } from '../payments';
import { useAuth } from '../auth';
import { useCurrentUser } from '../hooks';
import * as likesService from '../api/services/likesService';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_W - 32 - CARD_GAP) / 2; // 16px padding each side
const CARD_HEIGHT = CARD_WIDTH * 1.45;

export default function LikesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [likes, setLikes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const styles = useMemo(() => getStyles(colors, isDark, insets), [colors, isDark, insets]);
  const { canSeeWhoLikesYou, hasTier } = useSubscription();
  const { session } = useAuth();
  const { currentUser } = useCurrentUser();
  const [refreshing, setRefreshing] = useState(false);
  const contentAnim = useRef(new Animated.Value(0)).current;
  const cardAnimsRef = useRef([]);
  const hasAnimatedCardsRef = useRef(false);

  const fetchLikes = useCallback(() => {
    if (!session) {
      setLikes(mockLikes);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    likesService.getReceivedLikes().then((apiLikes) => {
      setLikes(apiLikes.length > 0 ? apiLikes : mockLikes);
    }).catch((err) => {
      if (__DEV__) console.warn('Likes fetch failed:', err);
      setLikes(mockLikes);
    }).finally(() => setIsLoading(false));
  }, [session]);

  useEffect(() => {
    fetchLikes();
  }, [fetchLikes]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    if (!session) {
      setTimeout(() => {
        setLikes(mockLikes);
        setRefreshing(false);
      }, 800);
      return;
    }
    likesService.getReceivedLikes().then((apiLikes) => {
      setLikes(apiLikes.length > 0 ? apiLikes : mockLikes);
    }).catch(() => {
      setLikes(mockLikes);
    }).finally(() => setRefreshing(false));
  }, [session]);

  useEffect(() => {
    Animated.timing(contentAnim, {
      toValue: 1,
      duration: 320,
      useNativeDriver: true,
    }).start();
  }, [contentAnim]);

  // Staggered scale+fade for grid cards (first render only)
  useEffect(() => {
    if (hasAnimatedCardsRef.current || likes.length === 0) return;
    const anims = likes.map(() => new Animated.Value(0));
    cardAnimsRef.current = anims;
    hasAnimatedCardsRef.current = true;
    const staggered = anims.map((anim, i) =>
      Animated.spring(anim, {
        toValue: 1,
        tension: 68,
        friction: 10,
        delay: i * 50,
        useNativeDriver: true,
      })
    );
    Animated.stagger(0, staggered).start();
  }, [likes]);

  const unlocked = canSeeWhoLikesYou();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header row */}
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
          style={styles.filterBtn}
          onPress={() => navigation.navigate('Settings')}
          activeOpacity={0.75}
        >
          <Ionicons name="options-outline" size={18} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Likes</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} activeOpacity={0.8}>
          <Image source={imageSource(currentUser?.images?.[0])} style={styles.avatar} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView
        style={[
          styles.content,
          {
            opacity: contentAnim,
            transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          },
        ]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <ThemedRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Like count */}
        <Text style={styles.likesCount}>{likes.length} Like{likes.length !== 1 ? 's' : ''}</Text>

        {/* Upgrade text */}
        {unlocked ? (
          <Text style={styles.upgradeText}>
            You can see everyone who likes you!
          </Text>
        ) : (
          <Text style={styles.upgradeText}>
            Upgrade to Elite Membership to see{'\n'}people who already liked you!
          </Text>
        )}

        {/* Upsell Banner (free users) */}
        {!hasTier('plus') && (
          <ProfilePromptBanner
            message="See who liked you first with JuNubin+"
            onPress={() => navigation.navigate('Elite')}
            colors={colors}
          />
        )}

        {/* Ad Banner */}
        <AdBanner colors={colors} style={{ marginBottom: 12 }} />

        {/* Empty state */}
        {likes.length === 0 && !isLoading && (
          <EmptyState
            icon="heart"
            title="No likes yet"
            subtitle="Keep swiping to get noticed!"
          />
        )}

        {/* Card grid */}
        <View style={styles.likesGrid}>
          {likes.map((like, idx) => {
            const cardAnim = cardAnimsRef.current[idx];
            const cardAnimStyle = cardAnim ? {
              opacity: cardAnim,
              transform: [{
                scale: cardAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.85, 1],
                }),
              }],
            } : {};

            return (
              <Animated.View key={like.id} style={[styles.likeCard, cardAnimStyle]}>
                <Image
                  source={imageSource(like.images?.[0])}
                  style={styles.likeImage}
                  blurRadius={unlocked ? 0 : 25}
                />
                {/* Bottom gradient overlay */}
                <View style={styles.gradientOverlay} />

                {/* Card info */}
                <View style={styles.likeInfo}>
                  {/* Name + Age + Heart row */}
                  <View style={styles.nameRow}>
                    {unlocked ? (
                      <Text style={styles.likeName} numberOfLines={1}>{like.name}</Text>
                    ) : (
                      <View style={styles.blurredName} />
                    )}
                    <Text style={styles.likeAge}>{like.age}</Text>
                    <GraffitiHeart size={16} color={colors.rose} filled />
                  </View>

                  {/* Activity row */}
                  <View style={styles.activityRow}>
                    {like.activity === 'nearby' ? (
                      <>
                        <GraffitiLocation size={13} color="#FFFFFF" filled />
                        <Text style={styles.activityText}>Nearby</Text>
                      </>
                    ) : (
                      <>
                        <View style={styles.activeDot} />
                        <Text style={styles.activityText}>Recently Active</Text>
                      </>
                    )}
                  </View>
                </View>
              </Animated.View>
            );
          })}

        </View>
      </Animated.ScrollView>

      {/* Fixed CTA button — stays at bottom, does not scroll */}
      {!unlocked && likes.length > 0 && (
        <View style={styles.ctaFixed}>
          <TouchableOpacity
            style={styles.ctaButton}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Elite')}
          >
            <Text style={styles.ctaText}>SEE WHO LIKES YOU</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const getStyles = (colors, isDark, insets) => StyleSheet.create({
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
  filterBtn: {
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
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  likesCount: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.accent,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  upgradeText: {
    fontSize: 16,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    color: isDark ? colors.gray400 : colors.gray700,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 23,
  },

  // ─── Card grid ───
  likesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
    position: 'relative',
  },
  likeCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.gray300,
  },
  likeImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
    backgroundColor: 'transparent',
    // Simulated gradient with layered opacity
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    // Use a dark overlay at the bottom
    ...StyleSheet.absoluteFillObject,
    top: undefined,
    backgroundGradient: undefined, // RN doesn't support CSS gradients
  },
  likeInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 14,
    paddingTop: 40,
    // Dark gradient effect
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },

  // ─── Name row ───
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  blurredName: {
    width: 70,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 4,
  },
  likeName: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },
  likeAge: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },

  // ─── Activity row ───
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.warning, // yellow dot for "Recently Active"
  },
  activityText: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
  },

  // ─── CTA fixed at bottom ───
  ctaFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 16 + (insets?.bottom || 0),
    alignItems: 'center',
    zIndex: 10,
  },
  ctaButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
});
