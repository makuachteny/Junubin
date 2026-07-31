// AnaJunubin — Referral Program Screen
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily, getShadow } from '../theme';
import Button from '../components/Button';
import * as referralService from '../utils/referralService';
import { REFERRALS_BACKEND_READY } from '../utils/referralService';
import { reportError } from '../utils/reportError';

// JuNubin is free, so there is nothing to reward anyone WITH — no
// Super Likes, Spotlights, tiers or Coins exist. Inviting people is
// its own reward here: a bigger community in your city. Milestones
// stay as recognition only; none of them grant an entitlement.
const REWARD_TIERS = [
  { id: 'invite_1',  count: 1,  reward: 'First invite sent',        icon: 'paper-plane', color: '#0047AB' },
  { id: 'invite_3',  count: 3,  reward: 'Community builder',        icon: 'people',      color: '#F59E0B' },
  { id: 'invite_5',  count: 5,  reward: 'Connector',                icon: 'git-network', color: '#CE1126' },
  { id: 'invite_10', count: 10, reward: 'Diaspora champion',        icon: 'ribbon',      color: '#009739' },
];

export default function ReferralScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [referralCount, setReferralCount] = useState(0);
  const [referralCode, setReferralCode] = useState('');
  const [claimedRewards, setClaimedRewards] = useState([]);
  // Milestones are recognition, not entitlements — there is nothing to
  // grant on a free app, so this only records which ones have been
  // reached. That also removes the old exploit surface: the count comes
  // from local AsyncStorage, which any user can edit, and it no longer
  // buys anything.
  const applyRewards = useCallback(async (stats) => {
    const claimed = Array.isArray(stats.claimedRewards) ? stats.claimedRewards : [];
    if (!REFERRALS_BACKEND_READY) {
      setClaimedRewards(claimed);
      return;
    }
    for (const tier of REWARD_TIERS) {
      if (stats.count >= tier.count && !claimed.includes(tier.id)) {
        await referralService.markRewardClaimed(tier.id);
        claimed.push(tier.id);
      }
    }
    setClaimedRewards(claimed);
  }, []);

  useEffect(() => {
    referralService.getReferralStats().then((stats) => {
      if (stats) {
        setReferralCount(stats.count || 0);
        setReferralCode(stats.code || `JUNUBIN-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
        setClaimedRewards(stats.claimedRewards || []);
        applyRewards(stats);
      }
    }).catch((err) => reportError('ReferralScreen.getStats', err));
  }, [applyRewards]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join me on JuNubin! Use my referral code ${referralCode} when you sign up.`,
      });
    } catch {}
  };

  const handleCopyCode = async () => {
    if (!referralCode) return;
    try {
      await Clipboard.setStringAsync(referralCode);
      Alert.alert('Copied!', `Referral code "${referralCode}" copied to clipboard.`);
    } catch {
      Alert.alert('Could not copy', 'Long-press the code to select it manually.');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.black} />
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
            JuNubin works better the more of us are on it. Invite friends and family — the app is free for everyone.
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
            <Text style={styles.statNumber}>{REWARD_TIERS.filter((t) => referralCount >= t.count).length}</Text>
            <Text style={styles.statLabel}>Milestones</Text>
          </View>
        </View>

        {/* Reward Tiers */}
        <Text style={styles.sectionTitle}>Milestones</Text>
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
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.black,
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
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F4F4F6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E8E8EC',
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
