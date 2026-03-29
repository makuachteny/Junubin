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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={colors.black} />
        </TouchableOpacity>
        <BrandLogo size="small" />
        <View style={{ width: 28 }} />
      </View>

      {/* Hero banner */}
      <View style={styles.heroSection}>
        <Image source={imageSource(displayUser.images?.[0])} style={styles.heroImage} resizeMode="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.65)']}
          style={styles.heroGradient}
        />
        <Text style={styles.heroName}>{displayUser.name}, {displayUser.age}</Text>

        {/* Edit button */}
        <TouchableOpacity style={[styles.editBtn, styles.editBtnLeft]} onPress={handleEdit}>
          <Ionicons name="pencil" size={16} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Settings button */}
        <TouchableOpacity
          style={[styles.editBtn, styles.editBtnRight]}
          onPress={() => navigation.navigate('Settings')}
        >
          <Ionicons name="settings" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Upper content — flex fills available space */}
      <View style={styles.content}>
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

        {/* Verification row */}
        <TouchableOpacity style={styles.verifyBtn} onPress={handleVerify}>
          <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
          <Text style={styles.verifyText}>Get verified</Text>
        </TouchableOpacity>

        <ProfileCompletenessCard
          score={completeness.score}
          suggestion={completeness.suggestions?.[0]}
          onPress={() => navigation.navigate('EditProfile')}
          colors={colors}
        />

        {/* Stats row */}
        <View style={styles.statsRow}>
          {statItems.map((item, index) => {
            const gradientColors = index === 0
              ? [colors.flagRed, '#E8102A']
              : index === 1
              ? [colors.gold, colors.goldDark]
              : [colors.green, colors.greenDark];
            return (
              <TouchableOpacity
                key={index}
                style={{ flex: 1 }}
                onPress={() => item.screen && navigation.navigate(item.screen)}
              >
                <LinearGradient
                  colors={gradientColors}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.statCard}
                >
                  <Ionicons name={item.icon} size={20} color="#FFFFFF" />
                  <Text style={styles.statText}>{item.label}</Text>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Sticker button */}
        <TouchableOpacity style={styles.stickerBtn} onPress={handleSticker}>
          <View style={styles.stickerCircle}>
            <Ionicons name="add" size={28} color={colors.accent} />
          </View>
          <Text style={styles.stickerText}>Sticker</Text>
        </TouchableOpacity>
      </View>

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
    width: '100%',
    height: 200,
    position: 'relative',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 280,
    top: -40,
    backgroundColor: colors.gray300,
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },
  heroName: {
    position: 'absolute',
    bottom: 48,
    left: 16,
    ...Typography.h2,
    color: '#FFFFFF',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  editBtn: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  editBtnLeft: {
    bottom: 10,
    left: 16,
  },
  editBtnRight: {
    bottom: 10,
    right: 16,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 16,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
  },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 0,
    marginBottom: 2,
  },
  followCard: {
    flex: 1,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  followCountNum: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: colors.black,
  },
  followCountLabel: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    color: colors.gray400,
    marginTop: 1,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  verifyText: {
    ...Typography.bodySmallMedium,
    fontSize: 13,
    color: colors.black,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    width: '100%',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statText: {
    ...Typography.captionBold,
    fontSize: 11,
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  stickerBtn: {
    alignItems: 'center',
    marginTop: 18,
    gap: 6,
  },
  stickerCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.accentTint04,
  },
  stickerText: {
    ...Typography.caption,
    fontSize: 12,
    color: colors.black,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
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
