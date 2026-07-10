// JuNubin — App Store / Play Store IAP rail via RevenueCat.
//
// On iOS this is the ONLY purchase rail App Review allows for digital
// goods (see getAvailableMethods in paymentMethods.js). On Android it
// sits behind Stripe in the method picker. Stripe lives in its own
// service (StripeService).
//
// Demo-mode fallback: when EXPO_PUBLIC_REVENUECAT_IOS_KEY /
// EXPO_PUBLIC_REVENUECAT_ANDROID_KEY are unset (dev machines, EAS
// preview builds without the env block) every purchase simulates a
// successful round-trip. Set the SDK keys in eas.json's production
// `env` block before flipping live IAP — without them, real users
// would receive entitlements without ever being charged.

import { Platform } from 'react-native';
import { OFFERING_ID, tierFromEntitlements, PRODUCTS } from './products';
import { reportError } from '../utils/reportError';

const RC_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '';
const RC_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '';

let Purchases = null;
let _initialized = false;
let _demoMode = false;

// Lazy-load RevenueCat SDK — avoids crash when not installed (Expo Go)
async function loadRC() {
  try {
    const mod = await import('react-native-purchases');
    return mod.default || mod;
  } catch (err) {
    reportError('PaymentService.loadRC', err);
    return null;
  }
}

function generateTransactionId() {
  return 'demo_txn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

const PaymentService = {
  /** True when RevenueCat is not available and we're using demo mode */
  get isDemoMode() {
    return _demoMode;
  },

  /**
   * Initialize payment service.
   * Configures RevenueCat if API keys are set, otherwise enables demo mode.
   */
  async initialize(appUserId) {
    if (_initialized) return;
    _initialized = true;

    const apiKey = Platform.OS === 'ios' ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;

    if (!apiKey) {
      _demoMode = true;
      return;
    }

    Purchases = await loadRC();
    if (!Purchases) {
      _demoMode = true;
      return;
    }

    try {
      Purchases.configure({ apiKey, appUserID: appUserId || null });
    } catch (err) {
      reportError('PaymentService.configure', err);
      _demoMode = true;
    }
  },

  /**
   * Fetch available offerings with localized prices from the stores.
   * Returns null in demo mode (screens use fallback prices from products.js).
   */
  async getOfferings() {
    if (_demoMode || !Purchases) return null;

    try {
      const offerings = await Purchases.getOfferings();
      return offerings?.current || null;
    } catch (err) {
      reportError('PaymentService.getOfferings', err);
      return null;
    }
  },

  /**
   * Purchase a RevenueCat package (subscription or consumable).
   * In demo mode, simulates the purchase.
   *
   * @param {object|string} packageOrProductId - RevenueCat Package object, or product ID string (demo mode)
   * @returns {{ success, transactionId, customerInfo, error }}
   */
  async purchaseProduct(packageOrProductId) {
    if (_demoMode || !Purchases) {
      // Demo mode — simulate purchase
      await new Promise((r) => setTimeout(r, 1000 + Math.random() * 1000));
      const productId = typeof packageOrProductId === 'string'
        ? packageOrProductId
        : packageOrProductId?.product?.identifier;
      return {
        success: true,
        transactionId: generateTransactionId(),
        productId,
        customerInfo: null,
        error: null,
      };
    }

    try {
      const result = typeof packageOrProductId === 'string'
        ? await Purchases.purchaseProduct(packageOrProductId)
        : await Purchases.purchasePackage(packageOrProductId);

      return {
        success: true,
        transactionId: result?.transaction?.transactionIdentifier || generateTransactionId(),
        productId: result?.productIdentifier || packageOrProductId?.product?.identifier,
        customerInfo: result?.customerInfo || null,
        error: null,
      };
    } catch (err) {
      // User cancelled — not an error
      if (err.userCancelled) {
        return { success: false, transactionId: null, productId: null, customerInfo: null, error: 'cancelled' };
      }
      return { success: false, transactionId: null, productId: null, customerInfo: null, error: err.message || 'Purchase failed' };
    }
  },

  /**
   * Restore previous purchases (e.g. after reinstall or device switch).
   */
  async restorePurchases() {
    if (_demoMode || !Purchases) {
      await new Promise((r) => setTimeout(r, 800));
      return { success: true, customerInfo: null, error: null };
    }

    try {
      const customerInfo = await Purchases.restorePurchases();
      return { success: true, customerInfo, error: null };
    } catch (err) {
      return { success: false, customerInfo: null, error: err.message || 'Restore failed' };
    }
  },

  /**
   * Get current customer info (entitlements, tier).
   */
  async getCustomerInfo() {
    if (_demoMode || !Purchases) {
      return { success: true, customerInfo: null, tier: null, error: null };
    }

    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const tier = tierFromEntitlements(customerInfo?.entitlements?.active);
      return { success: true, customerInfo, tier, error: null };
    } catch (err) {
      return { success: false, customerInfo: null, tier: null, error: err.message };
    }
  },

  /**
   * Listen for customer info changes (e.g. subscription renewal/expiry).
   * Returns an unsubscribe function.
   */
  onCustomerInfoUpdate(callback) {
    if (_demoMode || !Purchases) return () => {};

    try {
      const listener = (info) => {
        const tier = tierFromEntitlements(info?.entitlements?.active);
        callback({ customerInfo: info, tier });
      };
      Purchases.addCustomerInfoUpdateListener(listener);
      return () => {
        try { Purchases.removeCustomerInfoUpdateListener(listener); }
        catch (err) { reportError('PaymentService.removeListener', err); }
      };
    } catch (err) {
      reportError('PaymentService.addListener', err);
      return () => {};
    }
  },

  /**
   * Associate a Supabase user ID with RevenueCat for cross-device sync.
   */
  async identify(appUserId) {
    if (_demoMode || !Purchases || !appUserId) return;

    try {
      await Purchases.logIn(appUserId);
    } catch (err) {
      reportError('PaymentService.identify', err);
    }
  },

  /**
   * Log out (anonymous mode) when user signs out.
   */
  async logout() {
    if (_demoMode || !Purchases) return;

    try {
      await Purchases.logOut();
    } catch (err) {
      reportError('PaymentService.logout', err);
    }
  },
};

export default PaymentService;
