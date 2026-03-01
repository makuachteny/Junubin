import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PaymentService from './PaymentService';
import { PRODUCTS, TIER_RANK } from './products';
import { hasTierAccess, canSeeWhoLikesYou, hasUnlimitedLikes, canUseAdvancedFilters, canUseDiasporaConnect, isSubscribed as checkSubscribed } from './entitlements';

const STORAGE_KEY = '@haboba_subscription';

const DEFAULT_STATE = {
  tier: 'free',
  tierProductId: null,
  spotlights: 3,
  superLikes: 5,
  whispers: 2,
  purchaseHistory: [],
};

const SubscriptionContext = createContext(null);

export function SubscriptionProvider({ children }) {
  const [state, setState] = useState(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);

  // Load persisted state on mount
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
      setLoaded(true);
    })();
  }, []);

  // Persist state on change
  useEffect(() => {
    if (loaded) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, loaded]);

  const purchase = useCallback(async (productId) => {
    const product = PRODUCTS[productId];
    if (!product) return { success: false, error: 'Unknown product' };

    setPurchaseInProgress(true);
    try {
      const result = await PaymentService.purchaseProduct(productId);
      if (!result.success) {
        return { success: false, error: result.error || 'Purchase failed' };
      }

      setState((prev) => {
        const next = { ...prev };
        const historyEntry = {
          productId,
          transactionId: result.transactionId,
          timestamp: Date.now(),
        };
        next.purchaseHistory = [...prev.purchaseHistory, historyEntry];

        if (product.type === 'subscription') {
          next.tier = product.tier;
          next.tierProductId = productId;
        } else if (product.type === 'consumable') {
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
      // In demo mode, restore just confirms current state persists
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

  const reset = useCallback(async () => {
    setState(DEFAULT_STATE);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(() => ({
    // State
    tier: state.tier,
    tierProductId: state.tierProductId,
    spotlights: state.spotlights,
    superLikes: state.superLikes,
    whispers: state.whispers,
    purchaseInProgress,
    purchaseHistory: state.purchaseHistory,

    // Actions
    purchase,
    restorePurchases,
    cancelSubscription,
    consumeSpotlight,
    consumeSuperLike,
    consumeWhisper,
    reset,

    // Checks
    hasTier: (requiredTier) => hasTierAccess(state.tier, requiredTier),
    isSubscribed: () => checkSubscribed(state.tier),
    canSeeWhoLikesYou: () => canSeeWhoLikesYou(state.tier),
    hasUnlimitedLikes: () => hasUnlimitedLikes(state.tier),
    canUseAdvancedFilters: () => canUseAdvancedFilters(state.tier),
    canUseDiasporaConnect: () => canUseDiasporaConnect(state.tier),
  }), [state, purchaseInProgress, purchase, restorePurchases, cancelSubscription, consumeSpotlight, consumeSuperLike, consumeWhisper, reset]);

  if (!loaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#C4956A" />
      </View>
    );
  }

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1612',
  },
});
