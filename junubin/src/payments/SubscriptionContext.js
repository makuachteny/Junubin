import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PaymentService from './PaymentService';
import StripeService from './StripeService';
import FlutterwaveService from './FlutterwaveService';
import { PRODUCTS, TIER_RANK, tierFromEntitlements } from './products';
import { supabase } from '../config/supabase';
import { hasTierAccess, canSeeWhoLikesYou, hasUnlimitedLikes, canUseAdvancedFilters, canUseIncognito as canUseIncognitoFn, canUseDiasporaConnect, isSubscribed as checkSubscribed, ALL_FEATURES_FREE } from './entitlements';
import { PAYMENTS_ENABLED, showPaymentsComingSoon } from './comingSoon';
import { useTheme } from '../theme';
import { reportError } from '../utils/reportError';

const STORAGE_KEY = '@junubin_subscription';

const DEFAULT_STATE = {
  tier: ALL_FEATURES_FREE ? 'junub' : 'free',
  tierProductId: null,
  spotlights: ALL_FEATURES_FREE ? 999 : 3,
  superLikes: ALL_FEATURES_FREE ? 999 : 5,
  whispers: ALL_FEATURES_FREE ? 999 : 2,
  coins: ALL_FEATURES_FREE ? 999999 : 100,
  promoTier: null,
  promoEndsAt: null,
  adsEnabled: false,
  purchaseHistory: [],
};

function applyFreeLaunchState(next) {
  if (!ALL_FEATURES_FREE) return next;
  return {
    ...next,
    tier: 'junub',
    tierProductId: null,
    spotlights: Math.max(Number(next.spotlights) || 0, 999),
    superLikes: Math.max(Number(next.superLikes) || 0, 999),
    whispers: Math.max(Number(next.whispers) || 0, 999),
    coins: Math.max(Number(next.coins) || 0, 999999),
    adsEnabled: false,
  };
}

const SubscriptionStateContext = createContext(null);
const SubscriptionActionsContext = createContext(null);

export function SubscriptionProvider({ children }) {
  const { colors } = useTheme();
  const [state, setState] = useState(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);
  const [offerings, setOfferings] = useState(null);
  const unsubRef = useRef(null);

  // Mirror the latest state on a ref so consume callbacks (which are
  // memoized with no deps to keep their identity stable for downstream
  // consumers) can do a fast pre-flight balance check without closing
  // over a stale `state` value.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const normalizeState = useCallback((next) => {
    const promoEndsAt = next.promoEndsAt ? new Date(next.promoEndsAt).getTime() : null;
    if (promoEndsAt && promoEndsAt <= Date.now()) {
      return applyFreeLaunchState({ ...next, promoTier: null, promoEndsAt: null });
    }
    return applyFreeLaunchState(next);
  }, []);

  const getEffectiveTier = useCallback((baseTier, promoTier, promoEndsAt) => {
    const promoActive = promoTier && promoEndsAt && new Date(promoEndsAt).getTime() > Date.now();
    if (!promoActive) return baseTier;
    return TIER_RANK[promoTier] > TIER_RANK[baseTier] ? promoTier : baseTier;
  }, []);

  const syncTierToBackend = useCallback(async (tierToSync) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser || !tierToSync) return;
      await supabase
        .from('User')
        .update({ subscriptionTier: tierToSync })
        .eq('auth_id', authUser.id);
    } catch (err) {
      reportError('SubscriptionContext.syncTier', err, { tierToSync });
    }
  }, []);

  const syncPromoToBackend = useCallback(async (promoTier, promoEndsAt) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      await supabase
        .from('User')
        .update({ promoTier: promoTier || null, promoEndsAt: promoEndsAt || null })
        .eq('auth_id', authUser.id);
    } catch (err) {
      reportError('SubscriptionContext.syncPromo', err);
    }
  }, []);

  const loadServerState = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return null;
      const { data } = await supabase
        .from('User')
        .select('subscriptionTier, coins, spotlights, superLikes, whispers, promoTier, promoEndsAt, adsEnabled')
        .eq('auth_id', authUser.id)
        .single();
      return data || null;
    } catch (err) {
      reportError('SubscriptionContext.loadServerState', err);
      return null;
    }
  }, []);

  // Load persisted state + initialize PaymentService on mount
  useEffect(() => {
    (async () => {
      if (!ALL_FEATURES_FREE) {
        await PaymentService.initialize();
      }
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser && !ALL_FEATURES_FREE) {
        PaymentService.identify(authUser.id);
      }

      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setState((prev) => normalizeState({ ...prev, ...parsed }));
        }
      } catch (err) {
        reportError('SubscriptionContext.loadPersisted', err);
      }

      // Load server-side state (coins + authoritative tier).
      //
      // ── Why the server tier is authoritative across all providers ──
      // Two rails can mutate User.subscriptionTier: RevenueCat (iOS
      // IAP / Google Play) and Stripe (web checkout). Both webhooks
      // write directly to the same column. Previously this client
      // only trusted the server value when in `isDemoMode`; in
      // production it deferred to RevenueCat alone — which produced
      // a silent payment regression: a user who upgraded via Stripe
      // got the tier granted on the server but the app continued to
      // show them as 'free' because it ignored that column and read
      // RevenueCat (which knew nothing about the Stripe purchase).
      //
      // Hydrate from the server first; RevenueCat (when available)
      // can still upgrade the value via the customer-info fetch
      // below if it knows about an even-newer purchase. That keeps
      // RevenueCat's near-real-time push working while Stripe users
      // see their tier reflected on the very next app open.
      const serverState = await loadServerState();
      if (serverState) {
        setState((prev) => normalizeState({
          ...prev,
          coins: Number.isFinite(serverState.coins) ? serverState.coins : prev.coins,
          spotlights: Number.isFinite(serverState.spotlights) ? serverState.spotlights : prev.spotlights,
          superLikes: Number.isFinite(serverState.superLikes) ? serverState.superLikes : prev.superLikes,
          whispers: Number.isFinite(serverState.whispers) ? serverState.whispers : prev.whispers,
          promoTier: serverState.promoTier || prev.promoTier,
          promoEndsAt: serverState.promoEndsAt || prev.promoEndsAt,
          adsEnabled: typeof serverState.adsEnabled === 'boolean' ? serverState.adsEnabled : prev.adsEnabled,
          // Always trust the server tier — it's the single column all
          // three providers' webhooks write. RevenueCat lift below.
          tier: serverState.subscriptionTier || prev.tier,
        }));
      }

      // Fetch real customer info from RevenueCat (if available).
      //
      // ── Important: RevenueCat can UPGRADE the tier but never DOWNGRADE ──
      // A user might be on 'plus' from a Stripe (web) purchase that
      // RevenueCat knows nothing about. The naive
      // "setState({ tier: info.tier })" path used to clobber that
      // valid server tier back to 'free' whenever RevenueCat returned
      // a no-active-entitlements response — silently revoking a paid
      // subscription on every app launch.
      //
      // The right rule: only apply RevenueCat's tier when it ranks
      // strictly higher than what we already have. Subscription
      // cancellations/expirations flow through the Stripe webhook
      // (which DOES write subscriptionTier='free') so we don't lose
      // the downgrade signal — it just doesn't come from RevenueCat
      // for purchases RevenueCat didn't make.
      if (!ALL_FEATURES_FREE && !PaymentService.isDemoMode) {
        try {
          const info = await PaymentService.getCustomerInfo();
          if (info.success && info.tier) {
            setState((prev) => {
              const prevRank = TIER_RANK[prev.tier] ?? 0;
              const rcRank = TIER_RANK[info.tier] ?? 0;
              if (rcRank > prevRank) {
                // RevenueCat sees a higher tier than the server gave
                // us — likely an IAP that hasn't reached our webhook
                // yet. Trust RC and write it back.
                syncTierToBackend(info.tier);
                return { ...prev, tier: info.tier };
              }
              return prev;
            });
          }
        } catch (err) {
          reportError('SubscriptionContext.rcCustomerInfo', err);
        }
      }

      // Fetch offerings (localized prices)
      try {
        const currentOffering = await PaymentService.getOfferings();
        if (currentOffering) {
          setOfferings(currentOffering);
        }
      } catch (err) {
        reportError('SubscriptionContext.getOfferings', err);
      }

      setLoaded(true);
    })();
  }, [loadServerState, normalizeState, syncTierToBackend]);

  // Listen for customer info updates (subscription renewal/expiry).
  // Same upgrade-only rule as the initial fetch above: RevenueCat
  // can grant a higher tier in real time when an IAP completes, but
  // must not silently revoke a Stripe-granted tier. A genuine expiry
  // on the RC side will arrive through the Stripe webhook's
  // downgradeToFree path.
  useEffect(() => {
    if (loaded && !ALL_FEATURES_FREE && !PaymentService.isDemoMode) {
      unsubRef.current = PaymentService.onCustomerInfoUpdate(({ tier }) => {
        if (!tier) return;
        setState((prev) => {
          const prevRank = TIER_RANK[prev.tier] ?? 0;
          const rcRank = TIER_RANK[tier] ?? 0;
          if (rcRank > prevRank) {
            syncTierToBackend(tier);
            return { ...prev, tier };
          }
          return prev;
        });
      });
    }
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, [loaded, syncTierToBackend]);

  // Refresh server state on auth changes (account switch / fresh login)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (s?.user?.id) {
        if (!ALL_FEATURES_FREE) {
          PaymentService.identify(s.user.id);
        }
        loadServerState().then((serverState) => {
          if (serverState) {
            setState((prev) => normalizeState({
              ...prev,
              coins: Number.isFinite(serverState.coins) ? serverState.coins : prev.coins,
              spotlights: Number.isFinite(serverState.spotlights) ? serverState.spotlights : prev.spotlights,
              superLikes: Number.isFinite(serverState.superLikes) ? serverState.superLikes : prev.superLikes,
              whispers: Number.isFinite(serverState.whispers) ? serverState.whispers : prev.whispers,
              promoTier: serverState.promoTier || prev.promoTier,
              promoEndsAt: serverState.promoEndsAt || prev.promoEndsAt,
              adsEnabled: typeof serverState.adsEnabled === 'boolean' ? serverState.adsEnabled : prev.adsEnabled,
              tier: ALL_FEATURES_FREE ? 'junub' : (PaymentService.isDemoMode && serverState.subscriptionTier ? serverState.subscriptionTier : prev.tier),
            }));
          }
        }).catch((err) => reportError('SubscriptionContext.authChangeReload', err));
      }
    });
    return () => subscription.unsubscribe();
  }, [loadServerState]);

  // Junub subscribers receive 1 free spotlight per calendar month. The
  // grant is decided server-side via `claim_monthly_spotlight` (00020),
  // which checks the calendar-month gate against `User.lastMonthlySpotlightAt`
  // — so reinstalling the app no longer re-grants. The server is the
  // authority on the resulting balance; we just mirror it locally.
  const claimMonthlyJunubSpotlight = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('claim_monthly_spotlight');
      if (error || !data?.[0]?.granted) return false;
      setState((prev) => ({ ...prev, spotlights: data[0].spotlights }));
      return true;
    } catch (err) {
      reportError('SubscriptionContext.claimMonthly', err);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!loaded) return;
    claimMonthlyJunubSpotlight();
  }, [loaded, state.tier, state.promoTier, state.promoEndsAt, claimMonthlyJunubSpotlight]);

  // Auto-expire promo tiers
  useEffect(() => {
    if (!state.promoEndsAt) return;
    const endsAt = new Date(state.promoEndsAt).getTime();
    const ms = endsAt - Date.now();
    if (ms <= 0) {
      setState((prev) => normalizeState(prev));
      syncPromoToBackend(null, null);
      return;
    }
    const timer = setTimeout(() => {
      setState((prev) => normalizeState(prev));
      syncPromoToBackend(null, null);
    }, ms);
    return () => clearTimeout(timer);
  }, [state.promoEndsAt, normalizeState, syncPromoToBackend]);

  // Persist state on change
  useEffect(() => {
    if (loaded) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, loaded]);

  const purchase = useCallback(async (packageOrProductId) => {
    // Payments-coming-soon gate: return a friendly alert instead of
    // hitting the real RevenueCat path. Flip PAYMENTS_ENABLED in
    // src/payments/comingSoon.js to enable the purchase flow.
    if (!PAYMENTS_ENABLED) {
      return showPaymentsComingSoon();
    }

    // Determine the product for state updates
    const productId = typeof packageOrProductId === 'string'
      ? packageOrProductId
      : packageOrProductId?.product?.identifier;
    const product = PRODUCTS[productId];

    setPurchaseInProgress(true);
    try {
      const result = await PaymentService.purchaseProduct(packageOrProductId);

      if (!result.success) {
        return { success: false, error: result.error || 'Purchase failed' };
      }

      // Update tier from RevenueCat customer info if available
      let newTier = null;
      if (result.customerInfo?.entitlements?.active) {
        newTier = tierFromEntitlements(result.customerInfo.entitlements.active);
      }

      setState((prev) => {
        const next = { ...prev };
        const historyEntry = {
          productId,
          transactionId: result.transactionId,
          timestamp: Date.now(),
        };
        next.purchaseHistory = [...prev.purchaseHistory, historyEntry];

        if (product?.type === 'subscription') {
          const finalTier = newTier || product.tier;
          next.tier = finalTier;
          next.tierProductId = productId;
          syncTierToBackend(finalTier);
        } else if (product?.type === 'consumable') {
          // Unreachable: the app is free and PRODUCTS no longer
          // contains any consumable (spotlights, super likes and coins
          // were retired with the dating monetization — see
          // RETIRED_PRODUCT_IDS in products.js). The branch is kept so
          // that a legacy receipt replayed through restorePurchases
          // still credits the balance it was paid for rather than
          // silently dropping it.
          if (product.category === 'spotlight') {
            next.spotlights = prev.spotlights + product.quantity;
          } else if (product.category === 'superlike') {
            next.superLikes = prev.superLikes + product.quantity;
          } else if (product.category === 'coins') {
            next.coins = prev.coins + product.quantity;
          }
        }

        return next;
      });

      if (product?.type === 'consumable') {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const rpcArgs = { user_auth_id: authUser.id, amount: product.quantity };
          const onFail = (err) => reportError('SubscriptionContext.addConsumable', err, { category: product.category });
          if (product.category === 'spotlight') {
            supabase.rpc('add_spotlights', rpcArgs).catch(onFail);
          } else if (product.category === 'superlike') {
            supabase.rpc('add_superlikes', rpcArgs).catch(onFail);
          } else if (product.category === 'coins') {
            supabase.rpc('add_coins', rpcArgs).catch(onFail);
          }
        }
      }

      return { success: true, transactionId: result.transactionId };
    } catch (err) {
      return { success: false, error: err.message || 'Purchase failed' };
    } finally {
      setPurchaseInProgress(false);
    }
  }, []);

  /**
   * Purchase via Stripe Checkout — JuNubin's primary payment rail.
   *
   * Returns a hosted Checkout URL + sessionId; the caller opens it in
   * the StripeCheckout WebView modal (or system browser on web).
   * Entitlements are granted server-side via the `stripe-webhook` edge
   * function once Stripe marks the session paid, and the resulting
   * Payment row is what `confirmStripePayment` polls for.
   */
  const purchaseWithStripe = useCallback(async ({ productId, successUrl, cancelUrl } = {}) => {
    if (!PAYMENTS_ENABLED) {
      return showPaymentsComingSoon();
    }
    setPurchaseInProgress(true);
    try {
      const result = await StripeService.createCheckout({ productId, successUrl, cancelUrl });
      return { success: true, url: result.url, sessionId: result.sessionId };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to create Stripe checkout' };
    } finally {
      setPurchaseInProgress(false);
    }
  }, []);

  /**
   * Confirm a Stripe payment after the user returns from the hosted
   * Checkout. Polls the Payment row written by `stripe-webhook`; when
   * it lands as `succeeded` we refresh server state so the local
   * tier / consumable balance reflects the granted entitlement.
   */
  const confirmStripePayment = useCallback(async (sessionId) => {
    try {
      const result = await StripeService.getSessionStatus(sessionId);
      if (result.status === 'succeeded') {
        const serverState = await loadServerState();
        if (serverState) {
          setState((prev) => normalizeState({
            ...prev,
            coins: Number.isFinite(serverState.coins) ? serverState.coins : prev.coins,
            spotlights: Number.isFinite(serverState.spotlights) ? serverState.spotlights : prev.spotlights,
            superLikes: Number.isFinite(serverState.superLikes) ? serverState.superLikes : prev.superLikes,
            whispers: Number.isFinite(serverState.whispers) ? serverState.whispers : prev.whispers,
            tier: serverState.subscriptionTier || prev.tier,
          }));
        }
      }
      return result;
    } catch (err) {
      reportError('SubscriptionContext.confirmStripe', err, { sessionId });
      return { status: 'error', productId: null };
    }
  }, [loadServerState, normalizeState]);

  /**
   * Mobile-money purchase via Flutterwave (M-Pesa, MTN MoMo, Airtel).
   * Mirrors purchaseWithStripe: creates a hosted-checkout payment link
   * server-side and returns it for the FlutterwaveCheckout WebView.
   * Dormant unless the operator has enabled the rail — the edge
   * function 503s cleanly when FLUTTERWAVE_SECRET_KEY is unset.
   */
  const purchaseWithFlutterwave = useCallback(async ({ productId, paymentMethod, currency, phoneNumber, eventMeta } = {}) => {
    if (!PAYMENTS_ENABLED) {
      return showPaymentsComingSoon();
    }
    setPurchaseInProgress(true);
    try {
      const result = await FlutterwaveService.createPayment({
        productId, paymentMethod, currency, phoneNumber, eventMeta,
      });
      return { success: true, paymentLink: result.paymentLink, txRef: result.txRef };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to create payment' };
    } finally {
      setPurchaseInProgress(false);
    }
  }, []);

  /**
   * Confirm a Flutterwave payment after the user returns from checkout.
   * Polls the status endpoint; on success refreshes server state so the
   * granted tier / balances land locally (grants happen in flw-webhook).
   */
  const confirmFlutterwavePayment = useCallback(async (txRef) => {
    try {
      const result = await FlutterwaveService.checkPaymentStatus(txRef);
      if (result.status === 'successful') {
        const serverState = await loadServerState();
        if (serverState) {
          setState((prev) => normalizeState({
            ...prev,
            coins: Number.isFinite(serverState.coins) ? serverState.coins : prev.coins,
            spotlights: Number.isFinite(serverState.spotlights) ? serverState.spotlights : prev.spotlights,
            superLikes: Number.isFinite(serverState.superLikes) ? serverState.superLikes : prev.superLikes,
            whispers: Number.isFinite(serverState.whispers) ? serverState.whispers : prev.whispers,
            tier: serverState.subscriptionTier || prev.tier,
          }));
        }
      }
      return result;
    } catch (err) {
      reportError('SubscriptionContext.confirmFlutterwave', err, { txRef });
      return { status: 'error', productId: null };
    }
  }, [loadServerState, normalizeState]);

  const restorePurchases = useCallback(async () => {
    setPurchaseInProgress(true);
    try {
      const result = await PaymentService.restorePurchases();

      // Sync tier from restored purchases
      if (result.success && result.customerInfo?.entitlements?.active) {
        const restoredTier = tierFromEntitlements(result.customerInfo.entitlements.active);
        setState((prev) => ({ ...prev, tier: restoredTier }));
        syncTierToBackend(restoredTier);
      }

      return { success: result.success, error: result.error };
    } finally {
      setPurchaseInProgress(false);
    }
  }, [syncTierToBackend]);

  const cancelSubscription = useCallback(() => {
    setState((prev) => ({
      ...prev,
      tier: ALL_FEATURES_FREE ? 'junub' : 'free',
      tierProductId: null,
    }));
    syncTierToBackend(ALL_FEATURES_FREE ? 'junub' : 'free');
  }, [syncTierToBackend]);

  // Atomic consumes. The server (try_consume_* RPCs in 00014) is the
  // source of truth; the client decrement is optimistic so the UI
  // stays responsive, and we reconcile from the server's returned
  // balance once it lands. If the server rejects (survey_required,
  // moderation, lost-race on balance, network blip), we refund the
  // local credit so the user isn't out a paid action they didn't
  // actually take. Most call sites have already run gate() upstream —
  // this is the second line of defense.
  //
  // The synchronous boolean return is preserved so existing handlers
  // like `if (!consumeSuperLike()) return;` keep working. The boolean
  // reflects the optimistic decision; the server-side reconcile is
  // best-effort and updates state when it returns.
  const reconcileBalance = useCallback((field, refundDelta) => async (rpc, args) => {
    try {
      const { data, error } = await supabase.rpc(rpc, args);
      if (error || !data?.ok) {
        // Refund the optimistic decrement.
        setState((prev) => ({ ...prev, [field]: (prev[field] ?? 0) + refundDelta }));
        return;
      }
      if (typeof data.balance === 'number') {
        setState((prev) => ({ ...prev, [field]: data.balance }));
      }
    } catch (err) {
      reportError('SubscriptionContext.reconcile', err, { field });
      setState((prev) => ({ ...prev, [field]: (prev[field] ?? 0) + refundDelta }));
    }
  }, []);

  // Free-for-all gate: while ALL_FEATURES_FREE is on (see
  // entitlements.js), every consume action succeeds without
  // decrementing the balance or hitting the server-side reconcile
  // RPC. Returning `true` lets the caller proceed exactly as if the
  // balance were sufficient.
  //
  // Most consume callbacks below follow the same shape:
  //   1. If ALL_FEATURES_FREE → return true.
  //   2. Pre-flight: refuse if the current balance is below the cost.
  //   3. Optimistically decrement local state (UI stays snappy).
  //   4. Reconcile against the server `try_consume_*` RPC; refund the
  //      decrement if the server rejects.
  // `makeConsume` packs that pattern so we describe each consume in
  // one line instead of eight nearly identical lines.
  const makeConsume = useCallback((field, rpcName, buildArgs = () => ({})) => (amount = 1) => {
    if (ALL_FEATURES_FREE) return true;
    const current = stateRef.current?.[field] ?? 0;
    if (current < amount) return false;
    setState((prev) => ({ ...prev, [field]: Math.max(0, (prev[field] ?? 0) - amount) }));
    reconcileBalance(field, amount)(rpcName, buildArgs(amount));
    return true;
  }, [reconcileBalance]);

  // Spotlight has a separate async activation path because the backend
  // still needs to mark Profile.spotlightedUntil even when payment
  // balances are ignored during the free launch.
  const activateSpotlight = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('try_consume_spotlight');
      if (error || !data?.ok) {
        return { success: false, reason: data?.reason || error?.message || 'unknown' };
      }
      if (!ALL_FEATURES_FREE && typeof data.balance === 'number') {
        setState((prev) => ({ ...prev, spotlights: data.balance }));
      }
      return { success: true, spotlightedUntil: data.spotlightedUntil || null };
    } catch (err) {
      reportError('SubscriptionContext.activateSpotlight', err);
      return { success: false, reason: err?.message || 'network' };
    }
  }, []);

  const consumeSpotlight = useCallback((amount = 1) => {
    if (ALL_FEATURES_FREE) return true;
    return makeConsume('spotlights', 'try_consume_spotlight')(amount);
  }, [makeConsume]);

  // useMemo (not useCallback) — these are factory results, not closures
  // over fresh state. Identity is stable for downstream consumers that
  // put them in dependency arrays.
  const consumeSuperLike = useMemo(() => makeConsume('superLikes', 'try_consume_superlike'), [makeConsume]);
  const consumeWhisper   = useMemo(() => makeConsume('whispers',   'try_consume_whisper'),   [makeConsume]);
  const consumeCoins     = useMemo(() => makeConsume('coins',      'try_consume_coins', (amount) => ({ p_amount: amount })), [makeConsume]);

  // Grant helpers (matching shape). Increment local state immediately,
  // then fire the matching `add_*` RPC server-side. Failures are
  // best-effort: the local cache already updated, and any drift gets
  // reconciled on the next `loadServerState()` round-trip (app
  // foreground refresh or auth change).
  const makeAdd = useCallback((field, rpcName) => (amount) => {
    setState((prev) => ({ ...prev, [field]: (prev[field] ?? 0) + amount }));
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!authUser) return;
      supabase.rpc(rpcName, { user_auth_id: authUser.id, amount })
        .catch((err) => reportError(`SubscriptionContext.${rpcName}`, err));
    }).catch((err) => reportError(`SubscriptionContext.${rpcName}.getUser`, err));
  }, []);

  const addCoins      = useMemo(() => makeAdd('coins',      'add_coins'),      [makeAdd]);
  const addSpotlights = useMemo(() => makeAdd('spotlights', 'add_spotlights'), [makeAdd]);
  const addSuperLikes = useMemo(() => makeAdd('superLikes', 'add_superlikes'), [makeAdd]);
  const addWhispers   = useMemo(() => makeAdd('whispers',   'add_whispers'),   [makeAdd]);

  const setAdsEnabled = useCallback((enabled) => {
    setState((prev) => ({ ...prev, adsEnabled: !!enabled }));
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser) {
        supabase
          .from('User')
          .update({ adsEnabled: !!enabled })
          .eq('auth_id', authUser.id)
          .catch((err) => reportError('SubscriptionContext.setAdsEnabled', err));
      }
    }).catch((err) => reportError('SubscriptionContext.setAdsEnabled.getUser', err));
  }, []);

  const grantPromoTier = useCallback((tier, days) => {
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    setState((prev) => normalizeState({ ...prev, promoTier: tier, promoEndsAt: expiresAt }));
    syncPromoToBackend(tier, expiresAt);
  }, [normalizeState, syncPromoToBackend]);

  const reset = useCallback(async () => {
    setState(DEFAULT_STATE);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const effectiveTier = getEffectiveTier(state.tier, state.promoTier, state.promoEndsAt);

  const stateValue = useMemo(() => ({
    loaded,
    tier: state.tier,
    effectiveTier,
    tierProductId: state.tierProductId,
    spotlights: state.spotlights,
    superLikes: state.superLikes,
    whispers: state.whispers,
    coins: state.coins,
    promoTier: state.promoTier,
    promoEndsAt: state.promoEndsAt,
    adsEnabled: state.adsEnabled,
    purchaseInProgress,
    purchaseHistory: state.purchaseHistory,
    offerings,
    isDemoMode: PaymentService.isDemoMode,
    hasTier: (requiredTier) => hasTierAccess(effectiveTier, requiredTier),
    isSubscribed: () => checkSubscribed(effectiveTier),
    canSeeWhoLikesYou: () => canSeeWhoLikesYou(effectiveTier),
    hasUnlimitedLikes: () => hasUnlimitedLikes(effectiveTier),
    canUseAdvancedFilters: () => canUseAdvancedFilters(effectiveTier),
    canUseDiasporaConnect: () => canUseDiasporaConnect(effectiveTier),
    canUseIncognito: () => canUseIncognitoFn(effectiveTier),
  }), [loaded, state, purchaseInProgress, offerings, effectiveTier]);

  const actionsValue = useMemo(() => ({
    purchase,
    purchaseWithStripe,
    confirmStripePayment,
    purchaseWithFlutterwave,
    confirmFlutterwavePayment,
    restorePurchases,
    cancelSubscription,
    consumeSpotlight,
    activateSpotlight,
    consumeSuperLike,
    consumeWhisper,
    consumeCoins,
    addCoins,
    addSpotlights,
    addSuperLikes,
    addWhispers,
    setAdsEnabled,
    grantPromoTier,
    claimMonthlyJunubSpotlight,
    // Re-exposed so the app-level foreground refresh hook can pull
    // server state when the user returns after a multi-device upgrade
    // / consumable purchase made elsewhere.
    refreshServerState: loadServerState,
    reset,
  }), [purchase, purchaseWithStripe, confirmStripePayment, purchaseWithFlutterwave, confirmFlutterwavePayment, restorePurchases, cancelSubscription, consumeSpotlight, activateSpotlight, consumeSuperLike, consumeWhisper, consumeCoins, addCoins, addSpotlights, addSuperLikes, addWhispers, setAdsEnabled, grantPromoTier, claimMonthlyJunubSpotlight, loadServerState, reset]);

  return (
    <SubscriptionStateContext.Provider value={stateValue}>
      <SubscriptionActionsContext.Provider value={actionsValue}>
        {loaded ? children : (
          <View style={[styles.loading, { backgroundColor: colors.cream }]}>
            <ActivityIndicator size="large" color="#CE1126" />
          </View>
        )}
      </SubscriptionActionsContext.Provider>
    </SubscriptionStateContext.Provider>
  );
}

export function useSubscription() {
  const stateCtx = useContext(SubscriptionStateContext);
  const actionsCtx = useContext(SubscriptionActionsContext);
  if (!stateCtx || !actionsCtx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return useMemo(() => ({ ...stateCtx, ...actionsCtx }), [stateCtx, actionsCtx]);
}

export function useSubscriptionState() {
  const ctx = useContext(SubscriptionStateContext);
  if (!ctx) throw new Error('useSubscriptionState must be used within SubscriptionProvider');
  return ctx;
}

export function useSubscriptionActions() {
  const ctx = useContext(SubscriptionActionsContext);
  if (!ctx) throw new Error('useSubscriptionActions must be used within SubscriptionProvider');
  return ctx;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
