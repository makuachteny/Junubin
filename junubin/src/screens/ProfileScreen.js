import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Easing,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FontFamily, Layout } from '../theme';
import Button from '../components/Button';
import ProfileCompletenessCard from '../components/ProfileCompletenessCard';
import { imageSource } from '../utils/imageSource';
import { useSubscription, SHOW_PAYMENTS_UI } from '../payments';
import { useCurrentUser } from '../hooks';
import { useMyFollowCounts } from '../hooks/useFollow';
import { calculateCompleteness } from '../utils/profileCompleteness';
import { REFERRALS_BACKEND_READY } from '../utils/referralService';

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { spotlights, superLikes, whispers, hasTier } = useSubscription();
  const { currentUser, refreshUser } = useCurrentUser();

  // Re-pull the user from the server every time Profile gains focus so
  // edits made in EditProfile (a modal pushed on top) are always
  // reflected when the user returns here — never a stale in-memory copy.
  useFocusEffect(
    useCallback(() => {
      refreshUser?.();
    }, [refreshUser]),
  );

  const displayUser = currentUser;
  const followCounts = useMyFollowCounts(currentUser?.id);

  // Stats counter animation — count up on mount.
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
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => statsAnim.removeListener(listener);
  }, [spotlights, superLikes, whispers, statsAnim]);

  const statItems = useMemo(() => [
    { icon: 'flash', iconColor: colors.accent, count: animatedCounts.spotlights, label: 'Spotlights', screen: 'Boost' },
    { icon: 'star', iconColor: colors.rose, count: animatedCounts.superLikes, label: 'Super Likes', screen: 'Elite' },
    // Whispers are sold via the Elite paywall — same destination as
    // Super Likes. Previously `screen: null` made the tile a dead button.
    { icon: 'send', iconColor: colors.gold, count: animatedCounts.whispers, label: 'Whispers', screen: 'Elite' },
  ], [animatedCounts, colors.accent, colors.rose, colors.gold]);

  const showJunubCTA = !hasTier('junub');
  const completeness = useMemo(() => calculateCompleteness(displayUser?._raw || displayUser), [displayUser]);

  const handleEdit = () => navigation.navigate('EditProfile');
  const handleVerify = () => navigation.navigate('PhotoVerification');
  const handleCompletePress = () => {
    navigation.navigate('EditProfile', { focusStep: completeness.nextField?.step });
  };

  const followItems = [
    { label: 'Followers', count: followCounts.followers, tab: 'Followers' },
    { label: 'Following', count: followCounts.following, tab: 'Following' },
    { label: 'Friends', count: followCounts.friends ?? 0, tab: 'Friends' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={Layout.headerBackIconSize} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Settings">
          <Ionicons name="settings-outline" size={Layout.headerIconSize} color={colors.black} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.heroSection}>
          <View style={styles.heroImageWrap}>
            <Image source={imageSource(displayUser?.images?.[0])} style={styles.heroImage} resizeMode="cover" />
            {displayUser?.verified && (
              <View style={[styles.verifiedDot, { borderColor: colors.surfaceMuted }]}>
                <Ionicons name="checkmark" size={14} color="#FFF" />
              </View>
            )}
          </View>
          <Text style={styles.heroName} numberOfLines={1}>
            {displayUser?.name}
            {displayUser?.age ? <Text style={styles.heroAge}>, {displayUser.age}</Text> : null}
          </Text>
          {displayUser?.bio ? (
            <Text style={styles.heroBio} numberOfLines={2}>{displayUser.bio}</Text>
          ) : (
            <TouchableOpacity onPress={handleEdit} activeOpacity={0.7}>
              <Text style={styles.heroBioPlaceholder}>+ Add a bio</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Follow stats — single rounded card so the row is cohesive */}
        <View style={styles.followCard}>
          {followItems.map((item, idx) => (
            <React.Fragment key={item.label}>
              <TouchableOpacity
                style={styles.followCol}
                onPress={() => navigation.navigate('FollowList', {
                  userId: displayUser?.id, userName: displayUser?.name, initialTab: item.tab,
                })}
                activeOpacity={0.7}
              >
                <Text style={styles.followCountNum}>{item.count}</Text>
                <Text style={styles.followCountLabel}>{item.label}</Text>
              </TouchableOpacity>
              {idx < followItems.length - 1 && <View style={styles.followDivider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Complete Your Profile — top of the action area to nudge */}
        <ProfileCompletenessCard
          score={completeness.score}
          filledCount={completeness.filledCount}
          totalCount={completeness.totalCount}
          suggestion={completeness.suggestion}
          tier={completeness.tier}
          onPress={handleCompletePress}
          colors={colors}
        />

        {/* Quick actions. "Invite" hides while REFERRALS_BACKEND_READY
            is false — the reward path is local-only, so surfacing the
            entry point would let users grant themselves free Super
            Likes / Spotlights without any server verification. */}
        <View style={styles.quickActions}>
          <QuickAction icon="create-outline" label="Edit profile" onPress={handleEdit} colors={colors} />
          <QuickAction icon="shield-checkmark-outline" label="Verify" onPress={handleVerify} colors={colors} />
          {REFERRALS_BACKEND_READY && (
            <QuickAction
              icon="gift-outline"
              label="Invite"
              onPress={() => navigation.navigate('Referral')}
              colors={colors}
            />
          )}
        </View>

        {/* Stats — hidden during v1 launch (SHOW_PAYMENTS_UI). The tile
            counts read consumable balances which are infinite-but-shown-
            as-zero while ALL_FEATURES_FREE is on, so surfacing them
            would confuse users. The features themselves still work. */}
        {SHOW_PAYMENTS_UI && (
          <>
            <Text style={styles.sectionLabel}>Your boosts</Text>
            <View style={styles.statsRow}>
              {statItems.map((item) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.statCard}
                  onPress={() => item.screen && navigation.navigate(item.screen)}
                  activeOpacity={0.85}
                  disabled={!item.screen}
                >
                  <View style={[styles.statIconWrap, { backgroundColor: colors.surfaceMuted }]}>
                    <Ionicons name={item.icon} size={18} color={item.iconColor} />
                  </View>
                  <Text style={styles.statCount}>{item.count}</Text>
                  <Text style={styles.statLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Match More CTA — inline, properly bounded */}
        {showJunubCTA && (
          <View style={styles.matchMore}>
            <View style={styles.matchMoreHeader}>
              <View style={[styles.matchMoreIcon, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name="diamond" size={18} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.matchMoreTitle}>Match More with Junub</Text>
                <Text style={styles.matchMoreDesc}>
                  See who likes you, connect the diaspora, unlock advanced filters.
                </Text>
              </View>
            </View>
            <Button
              title="GO JUNUB"
              variant="primary"
              size="md"
              onPress={() => navigation.navigate('Elite')}
              fullWidth
              style={{ marginTop: 14 }}
              textStyle={{ letterSpacing: 1.2, fontSize: 14 }}
            />
          </View>
        )}

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
}

function QuickAction({ icon, label, onPress, colors }) {
  return (
    <TouchableOpacity style={qa.btn(colors)} onPress={onPress} activeOpacity={0.8}>
      <View style={qa.icon(colors)}>
        <Ionicons name={icon} size={18} color={colors.black} />
      </View>
      <Text style={qa.text(colors)}>{label}</Text>
    </TouchableOpacity>
  );
}

const qa = {
  btn: (colors) => ({
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    gap: 6,
  }),
  icon: (colors) => ({
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  }),
  text: (colors) => ({
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.black,
  }),
};

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Layout.headerPaddingX,
    height: Layout.headerHeight,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.black,
    letterSpacing: -0.2,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 14,
  },

  // ── Hero ──
  heroSection: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 6,
  },
  heroImageWrap: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.gray300,
    marginBottom: 12,
  },
  heroImage: {
    width: '100%',
    height: '100%',
    borderRadius: 56,
  },
  verifiedDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: colors.black,
    letterSpacing: -0.4,
  },
  heroAge: {
    fontWeight: '500',
    fontFamily: FontFamily.medium,
    color: colors.gray500,
  },
  heroBio: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    color: colors.gray500,
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 19,
  },
  heroBioPlaceholder: {
    fontSize: 13,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: colors.accent,
    marginTop: 6,
  },

  // ── Follow card ──
  followCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    paddingVertical: 14,
  },
  followCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  followCountNum: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: FontFamily.black,
    color: colors.black,
    letterSpacing: -0.3,
  },
  followCountLabel: {
    fontSize: 11,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: colors.gray500,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  followDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
    backgroundColor: colors.separator,
  },

  // ── Quick actions row ──
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },

  // ── Stats ──
  sectionLabel: {
    fontSize: 12,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    color: colors.gray500,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 4,
    marginBottom: -4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    gap: 4,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statCount: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: colors.black,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: colors.gray500,
    letterSpacing: 0.3,
  },

  // ── Match More CTA ──
  matchMore: {
    backgroundColor: colors.cardBg,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 4,
  },
  matchMoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  matchMoreIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchMoreTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: colors.black,
    letterSpacing: -0.2,
  },
  matchMoreDesc: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    color: colors.gray500,
    lineHeight: 18,
    marginTop: 2,
  },
});
