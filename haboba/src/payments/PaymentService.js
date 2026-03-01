// AnaJunubin — Payment Service (Demo Implementation)
// This is the ONLY file that changes for real IAP integration.
// Replace internals with RevenueCat / StoreKit while keeping the same function signatures.

let _initialized = false;

function randomDelay() {
  return 1000 + Math.random() * 1000; // 1-2 seconds
}

function generateTransactionId() {
  return 'demo_txn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

const PaymentService = {
  // Initialize the payment service
  // Real: Purchases.configure({ apiKey })
  async initialize() {
    if (_initialized) return;
    _initialized = true;
  },

  // Purchase a product by ID
  // Real: Purchases.purchaseProduct(productId)
  async purchaseProduct(productId) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          transactionId: generateTransactionId(),
          productId,
          error: null,
        });
      }, randomDelay());
    });
  },

  // Restore previous purchases
  // Real: Purchases.restorePurchases()
  async restorePurchases() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          restoredProducts: [],
          error: null,
        });
      }, randomDelay());
    });
  },

  // Get current subscription status
  // Real: Purchases.getCustomerInfo()
  async getSubscriptionStatus() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          tier: null, // null = use local state; real impl would return actual tier
          error: null,
        });
      }, 500);
    });
  },
};

export default PaymentService;
