import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PaymentService from './PaymentService';
import { PRODUCTS, TIER_RANK, tierFromEntitlements } from './products';
import { supabase } from '../config/supabase';
import { hasTierAccess, canSeeWhoLikesYou, hasUnlimitedLikes, canUseAdvancedFilters, canUseDiasporaConnect, isSubscribed as checkSubscribed } from './entitlements';

const STORAGE_KEY = '@haboba_subscription';

const DEFAULT_STATE = {
  tier: 'free',
  tierProductId: null,
  spotlights: 3,
  superLikes: 5,
  whispers: 2,
  coins: 100,
  promoTier: null,
  promoEndsAt: null,
  adsEnabled: true,
  purchaseHistory: [],
};

const SubscriptionStateContext = createContext(null);
const SubscriptionActionsContext = createContext(null);

export function SubscriptionProvider({ children }) {
  const [state, setState] = useState(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);
  const [offerings, setOfferings] = useState(null);
  const unsubRef = useRef(null);

  const normalizeState = useCallback((next) => {
    const promoEndsAt = next.promoEndsAt ? new Date(next.promoEndsAt).getTime() : null;
    if (promoEndsAt && promoEndsAt <= Date.now()) {
      return { ...next, promoTier: null, promoEndsAt: null };
    }
    return next;
  }, [syncTierToBackend]);

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
    } catch {}
  }, []);

  const syncPromoToBackend = useCallback(async (promoTier, promoEndsAt) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      await supabase
        .from('User')
        .update({ promoTier: promoTier || null, promoEndsAt: promoEndsAt || null })
        .eq('auth_id', authUser.id);
    } catch {}
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
    } catch {
      return null;
    }
  }, []);

  // Load persisted state + initialize PaymentService on mount
  useEffect(() => {
    (async () => {
      await PaymentService.initialize();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        PaymentService.identify(authUser.id);
      }

      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setState((prev) => normalizeState({ ...prev, ...parsed }));
        }
      } catch {}

      // Load server-side state (coins + tier fallback)
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
          tier: PaymentService.isDemoMode && serverState.subscriptionTier ? serverState.subscriptionTier : prev.tier,
        }));
      }

      // Fetch real customer info from RevenueCat (if available)
      if (!PaymentService.isDemoMode) {
        try {
          const info = await PaymentService.getCustomerInfo();
          if (info.success && info.tier) {
            setState((prev) => ({ ...prev, tier: info.tier }));
            syncTierToBackend(info.tier);
          }
        } catch {}
      }

      // Fetch offerings (localized prices)
      try {
        const currentOffering = await PaymentService.getOfferings();
        if (currentOffering) {
          setOfferings(currentOffering);
        }
      } catch {}

      setLoaded(true);
    })();
  }, [loadServerState, normalizeState, syncTierToBackend]);

  // Listen for customer info updates (subscription renewal/expiry)
  useEffect(() => {
    if (loaded && !PaymentService.isDemoMode) {
      unsubRef.current = PaymentService.onCustomerInfoUpdate(({ tier }) => {
        if (tier) {
          setState((prev) => ({ ...prev, tier }));
          syncTierToBackend(tier);
        }
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
        PaymentService.identify(s.user.id);
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
              tier: PaymentService.isDemoMode && serverState.subscriptionTier ? serverState.subscriptionTier : prev.tier,
            }));
          }
        }).catch(() => {});
      }
    });
    return () => subscription.unsubscribe();
  }, [loadServerState]);

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
          if (product.category === 'spotlight') {
            next.spotlights = prev.spotlights + product.quantity;
          } else if (product.category === 'superlike') {
            next.superLikes = prev.superLikes + product.quantity;
          }
        }

        return next;
      });

      if (product?.type === 'consumable') {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          if (product.category === 'spotlight') {
            supabase.rpc('add_spotlights', { user_auth_id: authUser.id, amount: product.quantity }).catch(() => {});
          } else if (product.category === 'superlike') {
            supabase.rpc('add_superlikes', { user_auth_id: authUser.id, amount: product.quantity }).catch(() => {});
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
      tier: 'free',
      tierProductId: null,
    }));
    syncTierToBackend('free');
  }, [syncTierToBackend]);

  const consumeSpotlight = useCallback(() => {
    let consumed = false;
    setState((prev) => {
      if (prev.spotlights <= 0) return prev;
      consumed = true;
      return { ...prev, spotlights: prev.spotlights - 1 };
    });
    if (consumed) {
      supabase.auth.getUser().then(({ data: { user: authUser } }) => {
        if (authUser) {
          supabase.rpc('consume_spotlight', { user_auth_id: authUser.id, amount: 1 }).catch(() => {});
        }
      }).catch(() => {});
    }
    return consumed;
  }, []);

  const consumeSuperLike = useCallback(() => {
    let consumed = false;
    setState((prev) => {
      if (prev.superLikes <= 0) return prev;
      consumed = true;
      return { ...prev, superLikes: prev.superLikes - 1 };
    });
    if (consumed) {
      supabase.auth.getUser().then(({ data: { user: authUser } }) => {
        if (authUser) {
          supabase.rpc('consume_superlike', { user_auth_id: authUser.id, amount: 1 }).catch(() => {});
        }
      }).catch(() => {});
    }
    return consumed;
  }, []);

  const consumeWhisper = useCallback(() => {
    let consumed = false;
    setState((prev) => {
      if (prev.whispers <= 0) return prev;
      consumed = true;
      return { ...prev, whispers: prev.whispers - 1 };
    });
    if (consumed) {
      supabase.auth.getUser().then(({ data: { user: authUser } }) => {
        if (authUser) {
          supabase.rpc('consume_whisper', { user_auth_id: authUser.id, amount: 1 }).catch(() => {});
        }
      }).catch(() => {});
    }
    return consumed;
  }, []);

  const consumeCoins = useCallback((amount) => {
    let consumed = false;
    setState((prev) => {
      if (prev.coins < amount) return prev;
      consumed = true;
      return { ...prev, coins: prev.coins - amount };
    });
    // Sync deduction to backend (fire-and-forget)
    if (consumed) {
      supabase.auth.getUser().then(({ data: { user: authUser } }) => {
        if (authUser) {
          supabase.rpc('deduct_coins', { user_auth_id: authUser.id, amount }).catch(() => {});
        }
      }).catch(() => {});
    }
    return consumed;
  }, []);

  const addCoins = useCallback((amount) => {
    setState((prev) => ({ ...prev, coins: prev.coins + amount }));
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser) {
        supabase.rpc('add_coins', { user_auth_id: authUser.id, amount }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const addSpotlights = useCallback((amount) => {
    setState((prev) => ({ ...prev, spotlights: prev.spotlights + amount }));
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser) {
        supabase.rpc('add_spotlights', { user_auth_id: authUser.id, amount }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const addSuperLikes = useCallback((amount) => {
    setState((prev) => ({ ...prev, superLikes: prev.superLikes + amount }));
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser) {
        supabase.rpc('add_superlikes', { user_auth_id: authUser.id, amount }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const addWhispers = useCallback((amount) => {
    setState((prev) => ({ ...prev, whispers: prev.whispers + amount }));
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser) {
        supabase.rpc('add_whispers', { user_auth_id: authUser.id, amount }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const setAdsEnabled = useCallback((enabled) => {
    setState((prev) => ({ ...prev, adsEnabled: !!enabled }));
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser) {
        supabase
          .from('User')
          .update({ adsEnabled: !!enabled })
          .eq('auth_id', authUser.id)
          .catch(() => {});
      }
    }).catch(() => {});
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
  }), [state, purchaseInProgress, offerings, effectiveTier]);

  const actionsValue = useMemo(() => ({
    purchase,
    restorePurchases,
    cancelSubscription,
    consumeSpotlight,
    consumeSuperLike,
    consumeWhisper,
    consumeCoins,
    addCoins,
    addSpotlights,
    addSuperLikes,
    addWhispers,
    setAdsEnabled,
    grantPromoTier,
    reset,
  }), [purchase, restorePurchases, cancelSubscription, consumeSpotlight, consumeSuperLike, consumeWhisper, consumeCoins, addCoins, addSpotlights, addSuperLikes, addWhispers, setAdsEnabled, grantPromoTier, reset]);

  if (!loaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#CE1126" />
      </View>
    );
  }

  return (
    <SubscriptionStateContext.Provider value={stateValue}>
      <SubscriptionActionsContext.Provider value={actionsValue}>
        {children}
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
    backgroundColor: '#000000',
  },
});
