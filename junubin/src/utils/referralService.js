// AnaJunubin — Referral Service
//
// The reward path (count → tiered grants) is gated on
// REFERRALS_BACKEND_READY. While the flag is false, this service is a
// local-only sandbox: `recordReferral` and `markRewardClaimed` keep
// writing to AsyncStorage so the UI can be exercised in development,
// but `applyReferralCode` refuses every code and the screen-level
// auto-grant short-circuits (see ReferralScreen).
//
// Why the gate exists: without a server validating that a referred
// user actually signed up — and capping the rewards budget — any
// caller can synthesize an arbitrary local count and harvest Super
// Likes / Spotlights / Plus weeks / coins for free. The audit
// (2026-05-22) flagged this as the highest-risk stub in the app.
// Flip the flag when the referral Edge Function + budget ledger are
// live.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const REFERRALS_BACKEND_READY = false;

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
  if (!REFERRALS_BACKEND_READY) {
    return { success: false, error: 'Referrals are not available yet.' };
  }
  if (!code || code.length < 4) return { success: false, error: 'Invalid code' };
  // TODO: Server validation when the referral Edge Function ships —
  // POST { code, userId } and let the server tell us if it's real,
  // hasn't been used, and is within budget. Local checks can be
  // bypassed by anyone with a debugger.
  return { success: true };
}
