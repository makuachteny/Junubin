import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily, getShadow } from '../theme';
import Button from '../components/Button';
import { mockLikes, currentUser, imageSource } from '../data/mockProfiles';
import { useSubscription } from '../payments';
import { useAuth } from '../auth';
import * as likesService from '../api/services/likesService';

const FILTER_PILLS = ['All', 'Notes', 'New', 'Social', 'Dating', 'Recent', 'Nearby', 'Verified'];

export default function LikesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState('All');
  const [likes, setLikes] = useState(mockLikes);
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { canSeeWhoLikesYou } = useSubscription();
  const { session } = useAuth();
  const contentAnim = useRef(new Animated.Value(0)).current;
  const cardAnimsRef = useRef([]);
  const hasAnimatedCardsRef = useRef(false);

  useEffect(() => {
    if (!session) return;
    likesService.getReceivedLikes().then((apiLikes) => {
      if (apiLikes.length > 0) setLikes(apiLikes);
    }).catch((err) => {
      if (__DEV__) console.warn('Likes fetch failed:', err);
    });
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
    if (hasAnimatedCardsRef.current || visibleLikes.length === 0) return;
    const anims = visibleLikes.map(() => new Animated.Value(0));
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
  }, [visibleLikes]);

  const unlocked = canSeeWhoLikesYou();
  const likesAccent = '#FF80AB';
  const visibleLikes = useMemo(() => {
    switch (activeTab) {
      case 'Notes':
        return likes.filter((_, index) => index % 2 === 0);
      case 'New':
        return likes.slice(0, 3);
      case 'Social':
        return likes.filter((_, index) => index % 3 === 0);
      case 'Dating':
        return likes;
      case 'Recent':
        return likes.slice(0, 4);
      case 'Nearby':
        return likes.filter((l) => l.distance && parseInt(l.distance, 10) <= 5);
      case 'Verified':
        return likes.filter((l) => l.verified);
      case 'All':
      default:
        return likes;
    }
  }, [activeTab, likes]);

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
          <Image source={imageSource(currentUser.images?.[0])} style={styles.avatar} />
        </TouchableOpacity>
      </Animated.View>

      {/* Filter pills — horizontally scrollable */}
      <Animated.View
        style={{
          opacity: contentAnim,
          transform: [{ translateY: contentAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
        >
          {FILTER_PILLS.map((pill) => {
            const isActive = activeTab === pill;
            return (
              <TouchableOpacity
                key={pill}
                style={[styles.pill, isActive ? styles.pillActive : styles.pillInactive]}
                onPress={() => setActiveTab(pill)}
                activeOpacity={0.7}
              >
                <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{pill}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>

      <Animated.ScrollView
        style={[
          styles.content,
          {
            opacity: contentAnim,
            transform: [
              {
                translateY: contentAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.likesCount}>{visibleLikes.length} Like{visibleLikes.length !== 1 ? 's' : ''}</Text>

        {unlocked ? (
          <Text style={styles.upgradeText}>
            You can see everyone who likes you!
          </Text>
        ) : (
          <Text style={styles.upgradeText}>
            Upgrade to Junub to see people who already liked you!
          </Text>
        )}

        <View style={styles.likesGrid}>
          {visibleLikes.map((like, idx) => {
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
                  blurRadius={unlocked ? 0 : 20}
                />
                <View style={styles.likeCardOverlay} />
                <View style={styles.likeInfo}>
                  <View style={styles.infoContent}>
                    {unlocked ? (
                      <Text style={styles.likeName}>{like.name}</Text>
                    ) : (
                      <View style={styles.blurredName} />
                    )}
                    <Text style={styles.likeAge}>{like.age}</Text>
                  </View>
                  <View style={styles.likeDistance}>
                    <Ionicons name="location" size={12} color="#FFFFFF" />
                    <Text style={styles.likeDistText}>{like.distance}</Text>
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </View>

        {!unlocked && visibleLikes.length > 0 && (
          <View style={styles.ctaSection}>
            <Button
              title="SEE WHO LIKES YOU"
              variant="primary"
              size="lg"
              onPress={() => navigation.navigate('Elite')}
              textStyle={{ letterSpacing: 1 }}
            />
          </View>
        )}
      </Animated.ScrollView>
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
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    paddingLeft: 14,
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  pillActive: {
    backgroundColor: colors.accent,
    ...getShadow('md', isDark, colors.accent),
  },
  pillInactive: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.22)' : colors.gray300,
    ...getShadow('sm', isDark),
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: isDark ? 'rgba(255,255,255,0.92)' : colors.gray700,
  },
  pillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  likesCount: {
    ...Typography.h1,
    color: colors.black,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  upgradeText: {
    ...Typography.bodySmall,
    fontSize: 15,
    color: colors.gray600,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  likesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  likeCard: {
    width: '47.5%',
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.gray300,
    ...getShadow('md', isDark),
  },
  likeImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  likeCardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  likeInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  infoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  blurredName: {
    width: 60,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderRadius: 4,
  },
  likeName: {
    ...Typography.bodySmallMedium,
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  likeAge: {
    ...Typography.bodySmallMedium,
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  likeDistance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 6,
  },
  likeDistText: {
    ...Typography.caption,
    color: '#FFFFFF',
  },
  ctaSection: {
    marginVertical: 24,
  },
});
