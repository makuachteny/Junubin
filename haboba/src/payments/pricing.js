// Pricing helpers for locale-safe currency rendering.
// Prefer numeric amounts + currency codes from store metadata.

const DEFAULT_CURRENCY = 'USD';

export function formatCurrency(amount, currencyCode = DEFAULT_CURRENCY, locale) {
  if (!Number.isFinite(amount)) return '';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode || DEFAULT_CURRENCY,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function formatFromProductValue(product, divisor, suffix, locale) {
  const amount = Number(product?.price);
  const currencyCode = product?.currencyCode || DEFAULT_CURRENCY;
  if (Number.isFinite(amount) && divisor > 0) {
    return `${formatCurrency(amount / divisor, currencyCode, locale)}${suffix}`;
  }
  if (product?.priceString) {
    return `${product.priceString}${suffix}`;
  }
  return '';
}

export function formatPerMonth(product, months = 1, locale) {
  return formatFromProductValue(product, months, '/mo', locale);
}

export function formatPerUnit(product, quantity = 1, locale) {
  return formatFromProductValue(product, quantity, '/each', locale);
}

