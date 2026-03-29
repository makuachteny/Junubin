// ============================================================
// Home country — South Sudan (where users are FROM)
// ============================================================
export const HOME_COUNTRY = { code: 'SS', name: 'South Sudan', flag: '🇸🇸', phoneCode: '+211' };

// ============================================================
// Diaspora countries — where South Sudanese diaspora currently live
// ============================================================
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
export const ALL_COUNTRIES = [HOME_COUNTRY, ...DIASPORA_COUNTRIES];

export const getCountryByCode = (code) => ALL_COUNTRIES.find(c => c.code === code);
export const getFlag = (code) => getCountryByCode(code)?.flag || '🌍';
