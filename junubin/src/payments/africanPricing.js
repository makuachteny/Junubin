/**
 * African Localized Pricing
 *
 * Maps product IDs to prices in East African currencies.
 * Used by Flutterwave payment flow. Prices approximate USD equivalents
 * adjusted for purchasing power parity.
 *
 * Supported currencies:
 *   KES - Kenya Shilling
 *   UGX - Uganda Shilling
 *   TZS - Tanzania Shilling
 *   SSP - South Sudan Pound
 *   RWF - Rwanda Franc
 *   XAF - Central African CFA (Cameroon)
 *   GHS - Ghana Cedi
 *   NGN - Nigeria Naira
 *   USD - US Dollar (fallback)
 */

import { PRODUCT_IDS } from './products';

export const SUPPORTED_CURRENCIES = [
  // East Africa
  { code: 'KES', symbol: 'KSh', name: 'Kenya Shilling', country: 'KE' },
  { code: 'UGX', symbol: 'USh', name: 'Uganda Shilling', country: 'UG' },
  { code: 'TZS', symbol: 'TSh', name: 'Tanzania Shilling', country: 'TZ' },
  { code: 'SSP', symbol: 'SSP', name: 'South Sudan Pound', country: 'SS' },
  { code: 'RWF', symbol: 'FRw', name: 'Rwanda Franc', country: 'RW' },
  // West / Central Africa
  { code: 'XAF', symbol: 'FCFA', name: 'CFA Franc', country: 'CM' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghana Cedi', country: 'GH' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', country: 'NG' },
  // Diaspora (worldwide)
  { code: 'USD', symbol: '$', name: 'US Dollar', country: 'US' },
  { code: 'GBP', symbol: '£', name: 'British Pound', country: 'GB' },
  { code: 'EUR', symbol: '€', name: 'Euro', country: 'EU' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', country: 'CA' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', country: 'AU' },
];

/**
 * Localized prices per product per currency.
 * Server-side edge functions should have their own copy for verification.
 */
export const AFRICAN_PRICES = {
  // ── Subscriptions ──
  [PRODUCT_IDS.PLUS_MONTHLY]: {
    KES: 1500, UGX: 37000, TZS: 25000, SSP: 13000,
    RWF: 12000, XAF: 6000, GHS: 150, NGN: 15000,
    USD: 9.99, GBP: 7.99, EUR: 8.99, CAD: 12.99, AUD: 14.99,
  },
  [PRODUCT_IDS.PLUS_6MONTH]: {
    KES: 6000, UGX: 148000, TZS: 100000, SSP: 52000,
    RWF: 48000, XAF: 24000, GHS: 600, NGN: 60000,
    USD: 39.99, GBP: 31.99, EUR: 35.99, CAD: 49.99, AUD: 59.99,
  },
  [PRODUCT_IDS.JUNUB_MONTHLY]: {
    KES: 3000, UGX: 74000, TZS: 50000, SSP: 26000,
    RWF: 24000, XAF: 12000, GHS: 300, NGN: 30000,
    USD: 19.99, GBP: 15.99, EUR: 17.99, CAD: 25.99, AUD: 29.99,
  },
  [PRODUCT_IDS.JUNUB_6MONTH]: {
    KES: 12000, UGX: 296000, TZS: 200000, SSP: 104000,
    RWF: 96000, XAF: 48000, GHS: 1200, NGN: 120000,
    USD: 79.99, GBP: 63.99, EUR: 71.99, CAD: 99.99, AUD: 119.99,
  },

  // ── Spotlights ──
  [PRODUCT_IDS.SPOTLIGHT_1]: {
    KES: 900, UGX: 22000, TZS: 15000, SSP: 7800,
    RWF: 7200, XAF: 3600, GHS: 90, NGN: 9000,
    USD: 5.99, GBP: 4.99, EUR: 5.49, CAD: 7.99, AUD: 8.99,
  },
  [PRODUCT_IDS.SPOTLIGHT_5]: {
    KES: 3000, UGX: 74000, TZS: 50000, SSP: 26000,
    RWF: 24000, XAF: 12000, GHS: 300, NGN: 30000,
    USD: 19.99, GBP: 15.99, EUR: 17.99, CAD: 25.99, AUD: 29.99,
  },
  [PRODUCT_IDS.SPOTLIGHT_10]: {
    KES: 4500, UGX: 111000, TZS: 75000, SSP: 39000,
    RWF: 36000, XAF: 18000, GHS: 450, NGN: 45000,
    USD: 29.99, GBP: 23.99, EUR: 26.99, CAD: 39.99, AUD: 44.99,
  },

  // ── Super Likes ──
  [PRODUCT_IDS.SUPERLIKE_5]: {
    KES: 1200, UGX: 30000, TZS: 20000, SSP: 10400,
    RWF: 9600, XAF: 4800, GHS: 120, NGN: 12000,
    USD: 7.99, GBP: 6.49, EUR: 7.49, CAD: 10.99, AUD: 11.99,
  },
  [PRODUCT_IDS.SUPERLIKE_15]: {
    KES: 2700, UGX: 67000, TZS: 45000, SSP: 23400,
    RWF: 21600, XAF: 10800, GHS: 270, NGN: 27000,
    USD: 17.99, GBP: 14.49, EUR: 15.99, CAD: 23.99, AUD: 26.99,
  },
  [PRODUCT_IDS.SUPERLIKE_30]: {
    KES: 4500, UGX: 111000, TZS: 75000, SSP: 39000,
    RWF: 36000, XAF: 18000, GHS: 450, NGN: 45000,
    USD: 29.99, GBP: 23.99, EUR: 26.99, CAD: 39.99, AUD: 44.99,
  },
};

/**
 * Event ticket pricing tiers (for paid events).
 * Event creators set a tier; the actual amount is currency-dependent.
 */
export const EVENT_TICKET_TIERS = {
  basic: { KES: 500, UGX: 12000, TZS: 8000, SSP: 4000, USD: 5 },
  standard: { KES: 1500, UGX: 37000, TZS: 25000, SSP: 13000, USD: 10 },
  premium: { KES: 3000, UGX: 74000, TZS: 50000, SSP: 26000, USD: 25 },
  vip: { KES: 5000, UGX: 120000, TZS: 80000, SSP: 40000, USD: 50 },
};

/**
 * Get localized price for a product.
 * @param {string} productId - Product identifier from PRODUCT_IDS
 * @param {string} currency - ISO currency code (e.g. 'KES')
 * @returns {number|null} Price in the specified currency, or null if not found
 */
export function getLocalizedPrice(productId, currency = 'USD') {
  return AFRICAN_PRICES[productId]?.[currency] ?? null;
}

/**
 * Format a price with the appropriate currency symbol.
 * @param {number} amount - The numeric amount
 * @param {string} currencyCode - ISO currency code
 * @returns {string} Formatted price string
 */
export function formatAfricanPrice(amount, currencyCode = 'USD') {
  if (!Number.isFinite(amount)) return '';
  const currency = SUPPORTED_CURRENCIES.find((c) => c.code === currencyCode);
  const symbol = currency?.symbol || currencyCode;

  // No decimals for large-denomination currencies
  const noDecimals = ['UGX', 'TZS', 'SSP', 'RWF', 'XAF', 'NGN'];
  if (noDecimals.includes(currencyCode)) {
    return `${symbol} ${Math.round(amount).toLocaleString()}`;
  }
  return `${symbol} ${amount.toFixed(2)}`;
}

/**
 * Detect the likely currency based on phone prefix or country code.
 * @param {string} phoneOrCountry - Phone number (with country code) or ISO country code
 * @returns {string} Best-guess currency code
 */
export function detectCurrency(phoneOrCountry) {
  const input = (phoneOrCountry || '').trim();
  const map = {
    // East Africa
    '+254': 'KES', KE: 'KES',
    '+256': 'UGX', UG: 'UGX',
    '+255': 'TZS', TZ: 'TZS',
    '+211': 'SSP', SS: 'SSP',
    '+250': 'RWF', RW: 'RWF',
    // West / Central Africa
    '+237': 'XAF', CM: 'XAF',
    '+233': 'GHS', GH: 'GHS',
    '+234': 'NGN', NG: 'NGN',
    // Diaspora
    '+1': 'USD', US: 'USD', CA: 'CAD',
    '+44': 'GBP', GB: 'GBP',
    '+61': 'AUD', AU: 'AUD',
    // European countries default to EUR
    '+49': 'EUR', DE: 'EUR', '+33': 'EUR', FR: 'EUR',
    '+31': 'EUR', NL: 'EUR', '+47': 'EUR', NO: 'EUR',
    '+46': 'EUR', SE: 'EUR',
  };

  // Check country code first
  if (map[input.toUpperCase()]) return map[input.toUpperCase()];

  // Check phone prefix
  for (const [prefix, currency] of Object.entries(map)) {
    if (prefix.startsWith('+') && input.startsWith(prefix)) return currency;
  }

  return 'USD';
}
