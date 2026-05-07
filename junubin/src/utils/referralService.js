// AnaJunubin — Referral Service (placeholder for backend integration)
import AsyncStorage from '@react-native-async-storage/async-storage';

const REF_KEY = '@junubin_referral';

export async function getReferralStats() {
  try {
    const raw = await AsyncStorage.getItem(REF_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed || { count: 0, history: [], code: null, claimedRewards: [] };
  } catch {
    return { count: 0, history: [], code: null, claimedRewards: [] };
  }
}

export async function recordReferral(referredUserId) {
  try {
    const stats = await getReferralStats();
    stats.count += 1;
    stats.history.push({ userId: referredUserId, date: Date.now() });
    await AsyncStorage.setItem(REF_KEY, JSON.stringify(stats));
    return stats;
  } catch {
    return null;
  }
}

export async function markRewardClaimed(rewardId) {
  try {
    const stats = await getReferralStats();
    stats.claimedRewards = Array.isArray(stats.claimedRewards) ? stats.claimedRewards : [];
    if (!stats.claimedRewards.includes(rewardId)) {
      stats.claimedRewards.push(rewardId);
      await AsyncStorage.setItem(REF_KEY, JSON.stringify(stats));
    }
    return stats;
  } catch {
    return null;
  }
}

export async function applyReferralCode(code) {
  // In production, validate with backend
  if (!code || code.length < 4) return { success: false, error: 'Invalid code' };
  return { success: true };
}
