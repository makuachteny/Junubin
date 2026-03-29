import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Animated,
  Easing,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import BrandLogo from '../components/BrandLogo';
import Button from '../components/Button';
import ProfileCompletenessCard from '../components/ProfileCompletenessCard';
import { imageSource } from '../utils/imageSource';
import { useSubscription } from '../payments';
import { useCurrentUser } from '../hooks';
import { useMyFollowCounts } from '../hooks/useFollow';
import { calculateCompleteness } from '../utils/profileCompleteness';

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { spotlights, superLikes, whispers, hasTier } = useSubscription();
  const { currentUser } = useCurrentUser();

  const displayUser = currentUser;
  const followCounts = useMyFollowCounts(currentUser?.id);

  // Stats counter animation
  const statsAnim = useRef(new Animated.Value(0)).current;
  const [animatedCounts, setAnimatedCounts] = useState({ spotlights: 0, superLikes: 0, whispers: 0 });

  useEffect(() => {
    const listener = statsAnim.addListener(({ value }) => {
      setAnimatedCounts({
        spotlights: Math.round(value * spotlights),
        superLikes: Math.round(value * superLikes),
        whispers: Math.round(value * whispers),
      });
    });
    Animated.timing(statsAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => statsAnim.removeListener(listener);
  }, [spotlights, superLikes, whispers, statsAnim]);

  const statItems = useMemo(() => [
    { icon: 'flash', iconColor: colors.accent, label: `${animatedCounts.spotlights} Spotlights`, screen: 'Boost' },
    { icon: 'star', iconColor: colors.rose, label: `${animatedCounts.superLikes} Super Likes`, screen: 'Elite' },
    { icon: 'send', iconColor: colors.accent, label: `${animatedCounts.whispers} Whispers`, screen: null },
  ], [animatedCounts.spotlights, animatedCounts.superLikes, animatedCounts.whispers, colors.accent, colors.rose]);

  const showJunubCTA = !hasTier('junub');
  const completeness = useMemo(() => calculateCompleteness(displayUser?._raw || displayUser), [displayUser]);

  const handleEdit = () => {
    navigation.navigate('EditProfile');
  };

  const handleVerify = () => {
    navigation.navigate('PhotoVerification');
  };

  const handleSticker = () => {
    navigation.navigate('EditProfile');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: showJunubCTA ? 0 : insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="settings-outline" size={22} color={colors.black} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
        {/* Profile avatar + name */}
        <View style={styles.heroSection}>
          <Image source={imageSource(displayUser.images?.[0])} style={styles.heroImage} resizeMode="cover" />
          <Text style={styles.heroName}>{displayUser.name}, {displayUser.age}</Text>
          {displayUser.bio ? (
            <Text style={styles.heroBio} numberOfLines={1}>{displayUser.bio}</Text>
          ) : null}
        </View>

        {/* Follow counts */}
        <View style={styles.followRow}>
          <TouchableOpacity
            style={styles.followCard}
            onPress={() => navigation.navigate('FollowList', { userId: displayUser.id, userName: displayUser.name, initialTab: 'Followers' })}
          >
            <Text style={styles.followCountNum}>{followCounts.followers}</Text>
            <Text style={styles.followCountLabel}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.followCard}
            onPress={() => navigation.navigate('FollowList', { userId: displayUser.id, userName: displayUser.name, initialTab: 'Following' })}
          >
            <Text style={styles.followCountNum}>{followCounts.following}</Text>
            <Text style={styles.followCountLabel}>Following</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.followCard}
            onPress={() => navigation.navigate('FollowList', { userId: displayUser.id, userName: displayUser.name, initialTab: 'Friends' })}
          >
            <Text style={styles.followCountNum}>{followCounts.followers > 0 ? Math.min(followCounts.followers, followCounts.following) : 0}</Text>
            <Text style={styles.followCountLabel}>Friends</Text>
          </TouchableOpacity>
        </View>

        {/* Quick actions row */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickActionBtn} onPress={handleEdit}>
            <Ionicons name="create-outline" size={20} color={colors.black} />
            <Text style={styles.quickActionText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={handleVerify}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.black} />
            <Text style={styles.quickActionText}>Verify</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => Alert.alert('Saved', 'No saved profiles yet. Bookmark profiles to see them here.')}>
            <Ionicons name="bookmark-outline" size={20} color={colors.black} />
            <Text style={styles.quickActionText}>Saved</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('Settings')}>
            <Ionicons name="settings-outline" size={20} color={colors.black} />
            <Text style={styles.quickActionText}>Settings</Text>
          </TouchableOpacity>
        </View>

        <ProfileCompletenessCard
          score={completeness.score}
          suggestion={completeness.suggestions?.[0]}
          onPress={() => navigation.navigate('EditProfile')}
          colors={colors}
        />

        {/* Stats row — clean, uniform */}
        <View style={styles.statsRow}>
          {statItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.statCard}
              onPress={() => item.screen && navigation.navigate(item.screen)}
              activeOpacity={0.8}
            >
              <Ionicons name={item.icon} size={22} color={item.iconColor} />
              <Text style={styles.statCount}>{item.count || 0}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Match More CTA section — anchored at bottom */}
      {showJunubCTA && (
        <View style={[styles.matchMore, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Text style={styles.matchMoreTitle}>Match More</Text>
          <Text style={styles.matchMoreDesc}>
            See Who Likes You, connect the diaspora, and unlock advanced filters with Junub.
          </Text>
          <View style={styles.matchMoreBtn}>
            <Button
              title="GO JUNUB"
              variant="primary"
              size="md"
              onPress={() => navigation.navigate('Elite')}
              textStyle={{ letterSpacing: 1.2, fontSize: 14 }}
              fullWidth={false}
              style={{ paddingHorizontal: 44, paddingVertical: 12 }}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 16,
  },
  heroImage: {
    width: 120,
    height: 120,
    borderRadius: 28,
    backgroundColor: colors.gray300,
    marginBottom: 12,
  },
  heroName: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: colors.black,
    letterSpacing: -0.3,
  },
  heroBio: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    color: colors.gray500,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  content: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
  },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  followCard: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  followCountNum: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: FontFamily.black,
    color: colors.black,
  },
  followCountLabel: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    color: colors.gray400,
    marginTop: 2,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickActionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.black,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 16,
    gap: 4,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.separator,
  },
  statCount: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: colors.black,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    color: colors.gray400,
  },
  matchMore: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 22,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  matchMoreTitle: {
    ...Typography.h3,
    fontSize: 20,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: colors.accent,
    letterSpacing: 0.3,
  },
  matchMoreDesc: {
    ...Typography.bodySmall,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 20,
  },
  matchMoreBtn: {
    marginTop: 16,
  },
});
