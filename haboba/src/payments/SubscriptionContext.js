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

  // Load persisted state + initialize PaymentService on mount
  useEffect(() => {
    (async () => {
      await PaymentService.initialize();

      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setState((prev) => ({ ...prev, ...parsed }));
        }
      } catch {}

      // Fetch real customer info from RevenueCat (if available)
      if (!PaymentService.isDemoMode) {
        try {
          const info = await PaymentService.getCustomerInfo();
          if (info.success && info.tier) {
            setState((prev) => ({ ...prev, tier: info.tier }));
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
  }, []);

  // Listen for customer info updates (subscription renewal/expiry)
  useEffect(() => {
    if (loaded && !PaymentService.isDemoMode) {
      unsubRef.current = PaymentService.onCustomerInfoUpdate(({ tier }) => {
        if (tier) {
          setState((prev) => ({ ...prev, tier }));
        }
      });
    }
    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, [loaded]);

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
          next.tier = newTier || product.tier;
          next.tierProductId = productId;
        } else if (product?.type === 'consumable') {
          if (product.category === 'spotlight') {
            next.spotlights = prev.spotlights + product.quantity;
          } else if (product.category === 'superlike') {
            next.superLikes = prev.superLikes + product.quantity;
          }
        }

        return next;
      });

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
      }

      return { success: result.success, error: result.error };
    } finally {
      setPurchaseInProgress(false);
    }
  }, []);

  const cancelSubscription = useCallback(() => {
    setState((prev) => ({
      ...prev,
      tier: 'free',
      tierProductId: null,
    }));
  }, []);

  const consumeSpotlight = useCallback(() => {
    let consumed = false;
    setState((prev) => {
      if (prev.spotlights <= 0) return prev;
      consumed = true;
      return { ...prev, spotlights: prev.spotlights - 1 };
    });
    return consumed;
  }, []);

  const consumeSuperLike = useCallback(() => {
    let consumed = false;
    setState((prev) => {
      if (prev.superLikes <= 0) return prev;
      consumed = true;
      return { ...prev, superLikes: prev.superLikes - 1 };
    });
    return consumed;
  }, []);

  const consumeWhisper = useCallback(() => {
    let consumed = false;
    setState((prev) => {
      if (prev.whispers <= 0) return prev;
      consumed = true;
      return { ...prev, whispers: prev.whispers - 1 };
    });
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
  }, []);

  const reset = useCallback(async () => {
    setState(DEFAULT_STATE);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const stateValue = useMemo(() => ({
    tier: state.tier,
    tierProductId: state.tierProductId,
    spotlights: state.spotlights,
    superLikes: state.superLikes,
    whispers: state.whispers,
    coins: state.coins,
    purchaseInProgress,
    purchaseHistory: state.purchaseHistory,
    offerings,
    isDemoMode: PaymentService.isDemoMode,
    hasTier: (requiredTier) => hasTierAccess(state.tier, requiredTier),
    isSubscribed: () => checkSubscribed(state.tier),
    canSeeWhoLikesYou: () => canSeeWhoLikesYou(state.tier),
    hasUnlimitedLikes: () => hasUnlimitedLikes(state.tier),
    canUseAdvancedFilters: () => canUseAdvancedFilters(state.tier),
    canUseDiasporaConnect: () => canUseDiasporaConnect(state.tier),
  }), [state, purchaseInProgress, offerings]);

  const actionsValue = useMemo(() => ({
    purchase,
    restorePurchases,
    cancelSubscription,
    consumeSpotlight,
    consumeSuperLike,
    consumeWhisper,
    consumeCoins,
    addCoins,
    reset,
  }), [purchase, restorePurchases, cancelSubscription, consumeSpotlight, consumeSuperLike, consumeWhisper, consumeCoins, addCoins, reset]);

  if (!loaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#F56040" />
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
