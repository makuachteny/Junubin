// Payout requests — cash-out MVP.
//
// Real payout rails (Stripe Connect, Flutterwave Bank Transfer) are out
// of scope. This service records creator intent into the PayoutRequest
// table; the operations team processes the queue manually until rails
// are wired. The 00021 RPC `request_payout` debits
// User.totalGiftCoinsReceived atomically at submit time so the same
// coins can't be requested twice.

import { supabase } from '../../config/supabase';

const ALLOWED_METHODS = ['stripe_connect', 'mobile_money', 'bank_transfer'];

function makeId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `po_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Resolve the caller's app User.id from their auth session. Returns
 * null if unauthenticated. Mirrors the helper in postService /
 * liveGiftsService so callers can decide whether to throw or silently
 * no-op.
 */
async function resolveAppUserId() {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;
  const { data: appUser } = await supabase
    .from('User')
    .select('id')
    .eq('auth_id', authUser.id)
    .maybeSingle();
  return appUser?.id || null;
}

/**
 * Reshape a raw `PayoutRequest` row into the object the UI expects.
 * Single transformation point so backend column names can evolve
 * without touching every screen.
 */
function normalizePayoutRequest(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    coinAmount: raw.coinAmount || 0,
    method: raw.method,
    destination: raw.destination || {},
    status: raw.status || 'pending',
    rejectionReason: raw.rejectionReason || null,
    createdAt: raw.createdAt,
    resolvedAt: raw.resolvedAt || null,
  };
}

/**
 * Submit a payout request. Calls the SECURITY DEFINER RPC which:
 *   1. validates the coin balance,
 *   2. inserts the PayoutRequest row,
 *   3. debits User.totalGiftCoinsReceived atomically.
 *
 * Returns { requestId, balance } so the caller can update the
 * earnings sheet without a follow-up read. Throws on auth failure,
 * insufficient balance, or invalid method.
 */
export async function requestPayout({ coinAmount, method, destination }) {
  if (!Number.isFinite(coinAmount) || coinAmount <= 0) {
    throw new Error('coinAmount must be a positive number');
  }
  if (!ALLOWED_METHODS.includes(method)) {
    throw new Error(`method must be one of ${ALLOWED_METHODS.join(', ')}`);
  }

  const { data, error } = await supabase.rpc('request_payout', {
    coin_amount: coinAmount,
    method,
    destination: destination || {},
  });
  if (error) throw error;

  // The RPC returns jsonb { id, balance }.
  return {
    requestId: data?.id || null,
    balance: typeof data?.balance === 'number' ? data.balance : 0,
  };
}

/**
 * Fetch the caller's payout history (most recent first). Returns []
 * if unauthenticated rather than throwing — the GoLiveScreen renders
 * this list speculatively.
 */
export async function listMyPayoutRequests() {
  const userId = await resolveAppUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('PayoutRequest')
    .select('id, coinAmount, method, destination, status, rejectionReason, createdAt, resolvedAt')
    .eq('userId', userId)
    .order('createdAt', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data || []).map(normalizePayoutRequest);
}

/**
 * Cancel one of your own pending payout requests. Flips status to
 * 'cancelled' and stamps resolvedAt. RLS only permits this transition
 * for rows the caller owns AND only when the WITH CHECK passes
 * (status='cancelled'); the .eq('status', 'pending') guard keeps the
 * client from accidentally re-cancelling a row that was already paid
 * server-side between list-render and tap.
 *
 * Note: this does NOT credit the coins back. Operations team handles
 * refunds (rare path) by issuing a compensating ledger entry — keeps
 * the audit trail clean. If you need the coins back, contact support.
 */
export async function cancelPayoutRequest(requestId) {
  if (!requestId) throw new Error('requestId required');

  const { data, error } = await supabase
    .from('PayoutRequest')
    .update({ status: 'cancelled', resolvedAt: new Date().toISOString() })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return normalizePayoutRequest(data);
}

/**
 * Kick off Stripe Connect Express onboarding. Calls the
 * stripe-connect-onboard Edge Function which creates (or reuses) the
 * caller's Connect account and returns a Stripe-hosted onboarding URL.
 * The caller opens the URL in a WebView; Stripe handles KYC and
 * notifies us via the account.updated webhook when the account is
 * payouts-ready.
 *
 * Returns { url, accountId }. Throws on auth failure or Stripe error.
 */
export async function startStripeConnectOnboarding() {
  const { data, error } = await supabase.functions.invoke('stripe-connect-onboard', {
    body: {},
  });
  if (error) throw error;
  if (!data?.url) {
    throw new Error('Onboarding URL missing in response');
  }
  return { url: data.url, accountId: data.accountId || null };
}

/**
 * Read the caller's cached Stripe Connect status. Reflects the latest
 * `account.updated` webhook delivery. Returns the bare flags rather
 * than reaching out to Stripe — the UI uses this to decide whether to
 * show "Set up Stripe payouts" vs. "Request payout".
 *
 * Returns:
 *   {
 *     accountId: string | null,
 *     chargesEnabled: boolean,
 *     payoutsEnabled: boolean,
 *   }
 *
 * Returns disabled defaults if unauthenticated rather than throwing.
 */
export async function getMyConnectStatus() {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    return { accountId: null, chargesEnabled: false, payoutsEnabled: false };
  }

  const { data, error } = await supabase
    .from('User')
    .select('stripeConnectAccountId, stripeConnectChargesEnabled, stripeConnectPayoutsEnabled')
    .eq('auth_id', authUser.id)
    .maybeSingle();
  if (error) throw error;

  return {
    accountId: data?.stripeConnectAccountId || null,
    chargesEnabled: !!data?.stripeConnectChargesEnabled,
    payoutsEnabled: !!data?.stripeConnectPayoutsEnabled,
  };
}

// Exported for callers that want to render method labels client-side
// without duplicating the enum.
export const PAYOUT_METHODS = ALLOWED_METHODS;

// Exported for tests / seed fixtures.
export const __test__ = { makeId, normalizePayoutRequest };
