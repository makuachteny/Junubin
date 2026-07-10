// ============================================================
// Phone-code picker source — the abbreviated list of countries
// the signup screen uses for phone-number entry. Profile country
// (User.countryCode) is picked from the full world list in
// `src/data/worldCountries.js`; `getFlag` below delegates to it
// so a flag lookup works for any ISO 3166-1 code on file.
// ============================================================

import { COUNTRY_BY_CODE, codeToFlag } from './worldCountries';

// Home country — South Sudan (where users are FROM)
export const HOME_COUNTRY = { code: 'SS', name: 'South Sudan', flag: '🇸🇸', phoneCode: '+211' };

// Diaspora countries — where South Sudanese diaspora currently live
export const DIASPORA_COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸', phoneCode: '+1' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', phoneCode: '+1' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', phoneCode: '+44' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', phoneCode: '+61' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', phoneCode: '+254' },
  { code: 'UG', name: 'Uganda', flag: '🇺🇬', phoneCode: '+256' },
  { code: 'ET', name: 'Ethiopia', flag: '🇪🇹', phoneCode: '+251' },
  { code: 'AE', name: 'UAE', flag: '🇦🇪', phoneCode: '+971' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', phoneCode: '+46' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴', phoneCode: '+47' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', phoneCode: '+49' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', phoneCode: '+20' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', phoneCode: '+27' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', phoneCode: '+31' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', phoneCode: '+64' },
];

// ============================================================
// Helpers
// ============================================================
// The signup phone picker shows the short ALL_COUNTRIES list (home +
// common diaspora). Profile flag lookups, however, can be for any of
// the 240+ world countries — so `getFlag` and `getCountryByCode` fall
// back to the world catalog when the short list misses.
export const ALL_COUNTRIES = [HOME_COUNTRY, ...DIASPORA_COUNTRIES];

export const getCountryByCode = (code) => {
  if (!code) return null;
  return ALL_COUNTRIES.find(c => c.code === code) || COUNTRY_BY_CODE[code.toUpperCase()] || null;
};

export const getFlag = (code) => {
  if (!code) return '🌍';
  const c = getCountryByCode(code);
  if (c) return c.flag;
  // Last-resort: derive the flag from the alpha-2 code directly so we
  // still render something for codes that aren't in either list.
  return codeToFlag(code) || '🌍';
};
