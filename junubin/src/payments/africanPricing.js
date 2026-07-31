/**
 * African Localized Pricing — currency utilities only.
 *
 * JuNubin is free and sells nothing, so the product price tables that
 * used to live here (subscriptions, spotlight packs, super-like packs,
 * coin packs, event tickets) are gone along with the surfaces that
 * displayed them. `AFRICAN_PRICES` is intentionally empty and
 * `getLocalizedPrice` therefore always returns null.
 *
 * What remains is genuinely reusable: the supported-currency list, the
 * price formatter, and `detectCurrency`. The server-side table in
 * supabase/functions/_shared/flw-products.ts is kept (deprecated) so
 * anything already live stays resolvable.
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
 * Product price table — intentionally empty.
 *
 * Nothing is sold, so there is no product to price. Kept as an export
 * (rather than deleted) so any straggling import resolves instead of
 * throwing, and so `getLocalizedPrice` has a table to miss against.
 */
export const AFRICAN_PRICES = Object.freeze({});

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
