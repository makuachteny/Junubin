// AnaJunubin — Referral Program Screen
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily, getShadow } from '../theme';
import Button from '../components/Button';
import * as referralService from '../utils/referralService';
import { useSubscription } from '../payments';

const REWARD_TIERS = [
  { id: 'superlikes_5', count: 1, reward: '5 Super Likes', icon: 'star', color: '#0047AB' },
  { id: 'spotlight_1', count: 3, reward: '1 Spotlight', icon: 'flash', color: '#F59E0B' },
  { id: 'promo_plus_7d', count: 5, reward: '1 Week Plus', icon: 'crown', color: '#CE1126' },
  { id: 'coins_100', count: 10, reward: '100 Coins', icon: 'logo-bitcoin', color: '#CE1126' },
];

export default function ReferralScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [referralCount, setReferralCount] = useState(0);
  const [referralCode, setReferralCode] = useState('');
  const [claimedRewards, setClaimedRewards] = useState([]);
  const { addCoins, addSpotlights, addSuperLikes, grantPromoTier } = useSubscription();

  const applyRewards = useCallback(async (stats) => {
    const claimed = Array.isArray(stats.claimedRewards) ? stats.claimedRewards : [];
    for (const tier of REWARD_TIERS) {
      if (stats.count >= tier.count && !claimed.includes(tier.id)) {
        if (tier.id === 'superlikes_5') addSuperLikes(5);
        if (tier.id === 'spotlight_1') addSpotlights(1);
        if (tier.id === 'promo_plus_7d') grantPromoTier('plus', 7);
        if (tier.id === 'coins_100') addCoins(100);
        await referralService.markRewardClaimed(tier.id);
        claimed.push(tier.id);
      }
    }
    setClaimedRewards(claimed);
  }, [addCoins, addSpotlights, addSuperLikes, grantPromoTier]);

  useEffect(() => {
    referralService.getReferralStats().then((stats) => {
      if (stats) {
        setReferralCount(stats.count || 0);
        setReferralCode(stats.code || `JUNUBIN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
        setClaimedRewards(stats.claimedRewards || []);
        applyRewards(stats);
      }
    }).catch(() => {});
  }, [applyRewards]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join me on AnaJubin! Use my referral code ${referralCode} when you sign up.`,
      });
    } catch {}
  };

  const handleCopyCode = () => {
    Alert.alert('Copied!', `Referral code "${referralCode}" copied to clipboard.`);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={26} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invite Friends</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <MaterialCommunityIcons name="gift" size={48} color={colors.accent} />
          <Text style={styles.heroTitle}>Share the Love</Text>
          <Text style={styles.heroDesc}>
            Invite your friends to JuNubin and earn rewards for each person who joins!
          </Text>
        </View>

        {/* Referral Code */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Your Referral Code</Text>
          <TouchableOpacity style={styles.codeBox} onPress={handleCopyCode} activeOpacity={0.7}>
            <Text style={styles.codeText}>{referralCode}</Text>
            <Ionicons name="copy-outline" size={18} color={colors.accent} />
          </TouchableOpacity>
        </View>

        <Button title="Share with Friends" variant="primary" size="lg" fullWidth onPress={handleShare} />

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{referralCount}</Text>
            <Text style={styles.statLabel}>Friends Invited</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{Math.floor(referralCount / 3)}</Text>
            <Text style={styles.statLabel}>Rewards Earned</Text>
          </View>
        </View>

        {/* Reward Tiers */}
        <Text style={styles.sectionTitle}>Reward Tiers</Text>
        {REWARD_TIERS.map((tier, i) => {
          const achieved = referralCount >= tier.count;
          const claimed = claimedRewards.includes(tier.id);
          return (
          <View key={i} style={styles.tierRow}>
            <View style={[styles.tierIcon, { backgroundColor: tier.color + '20' }]}>
              <Ionicons name={tier.icon} size={20} color={tier.color} />
            </View>
            <View style={styles.tierInfo}>
              <Text style={styles.tierCount}>{tier.count} referral{tier.count > 1 ? 's' : ''}</Text>
              <Text style={styles.tierReward}>{tier.reward}</Text>
            </View>
            {claimed ? (
              <Ionicons name="checkmark-circle" size={22} color="#CE1126" />
            ) : achieved ? (
              <Ionicons name="checkmark-circle" size={22} color="#CE1126" />
            ) : (
              <Ionicons name="ellipse-outline" size={22} color={colors.gray300} />
            )}
          </View>
        );})}
      </ScrollView>
    </View>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  headerTitle: {
    fontSize: 34,
    fontFamily: FontFamily.black,
    color: colors.black,
    letterSpacing: 0.3,
  },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  hero: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  heroTitle: { ...Typography.h2, color: colors.black },
  heroDesc: { ...Typography.bodySmall, color: colors.gray, textAlign: 'center', maxWidth: 300, lineHeight: 22 },
  codeCard: { marginVertical: 16, alignItems: 'center' },
  codeLabel: { ...Typography.caption, color: colors.gray, marginBottom: 8 },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.greenTint08,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.greenTint15,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderStyle: 'dashed',
  },
  codeText: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.accent,
    letterSpacing: 1,
  },
  statsRow: { flexDirection: 'row', gap: 12, marginVertical: 20 },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.separator,
    ...getShadow('sm', isDark),
  },
  statNumber: { fontSize: 24, fontWeight: '800', fontFamily: FontFamily.extrabold, color: colors.accent },
  statLabel: { ...Typography.caption, color: colors.gray, marginTop: 4 },
  sectionTitle: { ...Typography.sectionTitle, color: colors.black, marginTop: 8, marginBottom: 12 },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
    gap: 12,
  },
  tierIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  tierInfo: { flex: 1 },
  tierCount: { ...Typography.captionBold, color: colors.black },
  tierReward: { ...Typography.bodySmall, color: colors.gray, marginTop: 2 },
});
