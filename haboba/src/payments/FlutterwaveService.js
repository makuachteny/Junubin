/**
 * Flutterwave Payment Service
 *
 * Handles mobile money (M-Pesa, MTN MoMo, Airtel Money),
 * bank transfers, and card payments for African markets.
 *
 * All Flutterwave API calls go through Supabase Edge Functions
 * to keep the secret key server-side. The flow is:
 *
 *   1. Client calls createPayment() -> edge function creates payment link
 *   2. User completes payment in WebView (Flutterwave hosted checkout)
 *   3. Flutterwave webhook -> edge function verifies & grants entitlement
 *   4. Client polls checkPaymentStatus() for confirmation
 *
 * For event tickets, the same flow applies with event-specific metadata.
 */

import { supabase } from '../config/supabase';

/** Payment method identifiers */
export const PAYMENT_METHODS = {
  APP_STORE: 'app_store',
  MPESA: 'mpesa',
  MTN_MOMO: 'momo',
  AIRTEL_MONEY: 'airtel',
  BANK_TRANSFER: 'bank_transfer',
  CARD: 'card',
};

/** Human-readable labels for each method */
export const PAYMENT_METHOD_LABELS = {
  [PAYMENT_METHODS.APP_STORE]: 'App Store',
  [PAYMENT_METHODS.MPESA]: 'M-Pesa',
  [PAYMENT_METHODS.MTN_MOMO]: 'MTN Mobile Money',
  [PAYMENT_METHODS.AIRTEL_MONEY]: 'Airtel Money',
  [PAYMENT_METHODS.BANK_TRANSFER]: 'Bank Transfer',
  [PAYMENT_METHODS.CARD]: 'Card Payment',
};

/** Icons for each payment method (Ionicons names) */
export const PAYMENT_METHOD_ICONS = {
  [PAYMENT_METHODS.APP_STORE]: 'logo-apple',
  [PAYMENT_METHODS.MPESA]: 'phone-portrait',
  [PAYMENT_METHODS.MTN_MOMO]: 'phone-portrait',
  [PAYMENT_METHODS.AIRTEL_MONEY]: 'phone-portrait',
  [PAYMENT_METHODS.BANK_TRANSFER]: 'business',
  [PAYMENT_METHODS.CARD]: 'card',
};

/** Brand colors for each method */
export const PAYMENT_METHOD_COLORS = {
  [PAYMENT_METHODS.APP_STORE]: '#000000',
  [PAYMENT_METHODS.MPESA]: '#4CAF50',
  [PAYMENT_METHODS.MTN_MOMO]: '#FFCC00',
  [PAYMENT_METHODS.AIRTEL_MONEY]: '#ED1C24',
  [PAYMENT_METHODS.BANK_TRANSFER]: '#0047AB',
  [PAYMENT_METHODS.CARD]: '#1A1A1A',
};

/**
 * Get available payment methods based on user's country/phone.
 * Card payments (Visa, Mastercard, Amex, Verve) are always available worldwide.
 * Mobile money methods are shown when the user is in a supported country.
 *
 * @param {string} countryCode - ISO country code (e.g. 'KE', 'UG', 'US', 'GB')
 * @param {string} platform - 'ios' or 'android'
 * @returns {string[]} Array of available PAYMENT_METHODS keys
 */
export function getAvailableMethods(countryCode, platform) {
  const methods = [];

  // App Store / Google Play — always first option
  methods.push(PAYMENT_METHODS.APP_STORE);

  // M-Pesa: Kenya, Tanzania
  if (['KE', 'TZ'].includes(countryCode)) {
    methods.push(PAYMENT_METHODS.MPESA);
  }

  // MTN MoMo: Uganda, South Sudan, Rwanda, Cameroon, Ghana, Nigeria
  if (['UG', 'SS', 'RW', 'CM', 'GH', 'NG'].includes(countryCode)) {
    methods.push(PAYMENT_METHODS.MTN_MOMO);
  }

  // Airtel Money: Kenya, Uganda, Tanzania, Rwanda
  if (['KE', 'UG', 'TZ', 'RW'].includes(countryCode)) {
    methods.push(PAYMENT_METHODS.AIRTEL_MONEY);
  }

  // Bank transfer: African markets
  if (['KE', 'UG', 'TZ', 'SS', 'RW', 'CM', 'GH', 'NG', 'ET', 'SO'].includes(countryCode)) {
    methods.push(PAYMENT_METHODS.BANK_TRANSFER);
  }

  // Card (Visa, Mastercard, Amex, Verve) — always available worldwide
  methods.push(PAYMENT_METHODS.CARD);

  return methods;
}

/**
 * Generate a unique transaction reference.
 * @param {string} userId - Supabase auth user ID
 * @param {string} productId - Product being purchased
 * @returns {string} Unique tx_ref for Flutterwave
 */
function generateTxRef(userId, productId) {
  const short = (userId || 'anon').slice(0, 8);
  const product = (productId || 'unknown').replace(/\./g, '_').slice(-20);
  return `hab_${short}_${product}_${Date.now()}`;
}

const FlutterwaveService = {
  /**
   * Create a payment via the server-side edge function.
   * Returns a payment link URL for the Flutterwave hosted checkout.
   *
   * @param {object} params
   * @param {string} params.productId - Product ID from PRODUCT_IDS
   * @param {string} params.paymentMethod - One of PAYMENT_METHODS
   * @param {string} params.currency - ISO currency code (e.g. 'KES')
   * @param {string} [params.phoneNumber] - Required for M-Pesa/MoMo
   * @param {object} [params.eventMeta] - For event ticket purchases { eventId, eventTitle, ticketTier }
   * @returns {Promise<{ paymentLink: string, txRef: string }>}
   */
  async createPayment({ productId, paymentMethod, currency, phoneNumber, eventMeta }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const txRef = generateTxRef(user.id, productId);

    const { data, error } = await supabase.functions.invoke('flw-create-payment', {
      body: {
        productId,
        paymentMethod,
        currency,
        phoneNumber,
        txRef,
        eventMeta: eventMeta || null,
      },
    });

    if (error) throw new Error(error.message || 'Failed to create payment');
    if (!data?.paymentLink) throw new Error('No payment link returned');

    return {
      paymentLink: data.paymentLink,
      txRef: data.txRef || txRef,
    };
  },

  /**
   * Check the status of a pending payment.
   * Used to poll after the user returns from the Flutterwave checkout.
   *
   * @param {string} txRef - The transaction reference from createPayment()
   * @returns {Promise<{ status: string, productId: string|null }>}
   *   status: 'pending' | 'successful' | 'failed' | 'cancelled'
   */
  async checkPaymentStatus(txRef) {
    const { data, error } = await supabase.functions.invoke('flw-check-status', {
      body: { txRef },
    });

    if (error) throw new Error(error.message || 'Failed to check payment status');

    return {
      status: data?.status || 'pending',
      productId: data?.productId || null,
    };
  },

  /**
   * Create a payment for an event ticket.
   * Wraps createPayment with event-specific metadata.
   *
   * @param {object} params
   * @param {object} params.event - Event object with id, title, ticketPrice
   * @param {string} params.ticketTier - Ticket tier (basic, standard, premium, vip)
   * @param {string} params.paymentMethod - Payment method
   * @param {string} params.currency - Currency code
   * @param {string} [params.phoneNumber] - For mobile money
   * @returns {Promise<{ paymentLink: string, txRef: string }>}
   */
  async createEventTicketPayment({ event, ticketTier, paymentMethod, currency, phoneNumber }) {
    return this.createPayment({
      productId: `event_ticket_${event.id}`,
      paymentMethod,
      currency,
      phoneNumber,
      eventMeta: {
        eventId: event.id,
        eventTitle: event.title,
        ticketTier,
      },
    });
  },
};

export default FlutterwaveService;
