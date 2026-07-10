// ═══════════════════════════════════════════════════════════
// JuNubin — World countries (ISO 3166-1)
//
// Full list of internationally-recognized countries, used by the
// "Which country do you most identify with?" survey step and the
// matching field in EditProfile. The DB column is `User.countryCode`
// (TEXT, ISO 3166-1 alpha-2) — already provisioned in the original
// schema (00001), so this addition needs no migration.
//
// Flag emojis are derived from the alpha-2 code so the table stays
// terse and we don't have to embed 250 flag glyphs by hand. Every
// country's flag is two regional-indicator symbols whose code points
// equal 0x1F1E6 + (letter − 'A').
// ═══════════════════════════════════════════════════════════

/**
 * Convert an ISO 3166-1 alpha-2 code to its flag emoji.
 * Returns 🌍 for invalid input so callers never get a blank pill.
 *
 * Example: codeToFlag('KE') → '🇰🇪'
 */
export function codeToFlag(code) {
  if (typeof code !== 'string' || code.length !== 2) return '🌍';
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return '🌍';
  const base = 0x1F1E6;
  const A = 'A'.charCodeAt(0);
  return String.fromCodePoint(base + (upper.charCodeAt(0) - A))
    + String.fromCodePoint(base + (upper.charCodeAt(1) - A));
}

// ── ISO 3166-1 alpha-2 catalog ──
// Source: UN member states + commonly recognized territories.
// Sorted alphabetically by country name for the searchable picker.
// `phoneCode` is included for any future signup / verification flows;
// it's not used by the country-identity picker itself.
const RAW = [
  ['AF', 'Afghanistan', '+93'],
  ['AL', 'Albania', '+355'],
  ['DZ', 'Algeria', '+213'],
  ['AS', 'American Samoa', '+1-684'],
  ['AD', 'Andorra', '+376'],
  ['AO', 'Angola', '+244'],
  ['AI', 'Anguilla', '+1-264'],
  ['AG', 'Antigua and Barbuda', '+1-268'],
  ['AR', 'Argentina', '+54'],
  ['AM', 'Armenia', '+374'],
  ['AW', 'Aruba', '+297'],
  ['AU', 'Australia', '+61'],
  ['AT', 'Austria', '+43'],
  ['AZ', 'Azerbaijan', '+994'],
  ['BS', 'Bahamas', '+1-242'],
  ['BH', 'Bahrain', '+973'],
  ['BD', 'Bangladesh', '+880'],
  ['BB', 'Barbados', '+1-246'],
  ['BY', 'Belarus', '+375'],
  ['BE', 'Belgium', '+32'],
  ['BZ', 'Belize', '+501'],
  ['BJ', 'Benin', '+229'],
  ['BM', 'Bermuda', '+1-441'],
  ['BT', 'Bhutan', '+975'],
  ['BO', 'Bolivia', '+591'],
  ['BA', 'Bosnia and Herzegovina', '+387'],
  ['BW', 'Botswana', '+267'],
  ['BR', 'Brazil', '+55'],
  ['IO', 'British Indian Ocean Territory', '+246'],
  ['VG', 'British Virgin Islands', '+1-284'],
  ['BN', 'Brunei', '+673'],
  ['BG', 'Bulgaria', '+359'],
  ['BF', 'Burkina Faso', '+226'],
  ['BI', 'Burundi', '+257'],
  ['KH', 'Cambodia', '+855'],
  ['CM', 'Cameroon', '+237'],
  ['CA', 'Canada', '+1'],
  ['CV', 'Cape Verde', '+238'],
  ['KY', 'Cayman Islands', '+1-345'],
  ['CF', 'Central African Republic', '+236'],
  ['TD', 'Chad', '+235'],
  ['CL', 'Chile', '+56'],
  ['CN', 'China', '+86'],
  ['CX', 'Christmas Island', '+61'],
  ['CC', 'Cocos (Keeling) Islands', '+61'],
  ['CO', 'Colombia', '+57'],
  ['KM', 'Comoros', '+269'],
  ['CK', 'Cook Islands', '+682'],
  ['CR', 'Costa Rica', '+506'],
  ['HR', 'Croatia', '+385'],
  ['CU', 'Cuba', '+53'],
  ['CW', 'Curaçao', '+599'],
  ['CY', 'Cyprus', '+357'],
  ['CZ', 'Czechia', '+420'],
  ['CD', 'DR Congo', '+243'],
  ['DK', 'Denmark', '+45'],
  ['DJ', 'Djibouti', '+253'],
  ['DM', 'Dominica', '+1-767'],
  ['DO', 'Dominican Republic', '+1-809'],
  ['TL', 'East Timor', '+670'],
  ['EC', 'Ecuador', '+593'],
  ['EG', 'Egypt', '+20'],
  ['SV', 'El Salvador', '+503'],
  ['GQ', 'Equatorial Guinea', '+240'],
  ['ER', 'Eritrea', '+291'],
  ['EE', 'Estonia', '+372'],
  ['SZ', 'Eswatini', '+268'],
  ['ET', 'Ethiopia', '+251'],
  ['FK', 'Falkland Islands', '+500'],
  ['FO', 'Faroe Islands', '+298'],
  ['FJ', 'Fiji', '+679'],
  ['FI', 'Finland', '+358'],
  ['FR', 'France', '+33'],
  ['PF', 'French Polynesia', '+689'],
  ['GA', 'Gabon', '+241'],
  ['GM', 'Gambia', '+220'],
  ['GE', 'Georgia', '+995'],
  ['DE', 'Germany', '+49'],
  ['GH', 'Ghana', '+233'],
  ['GI', 'Gibraltar', '+350'],
  ['GR', 'Greece', '+30'],
  ['GL', 'Greenland', '+299'],
  ['GD', 'Grenada', '+1-473'],
  ['GU', 'Guam', '+1-671'],
  ['GT', 'Guatemala', '+502'],
  ['GG', 'Guernsey', '+44-1481'],
  ['GN', 'Guinea', '+224'],
  ['GW', 'Guinea-Bissau', '+245'],
  ['GY', 'Guyana', '+592'],
  ['HT', 'Haiti', '+509'],
  ['HN', 'Honduras', '+504'],
  ['HK', 'Hong Kong', '+852'],
  ['HU', 'Hungary', '+36'],
  ['IS', 'Iceland', '+354'],
  ['IN', 'India', '+91'],
  ['ID', 'Indonesia', '+62'],
  ['IR', 'Iran', '+98'],
  ['IQ', 'Iraq', '+964'],
  ['IE', 'Ireland', '+353'],
  ['IM', 'Isle of Man', '+44-1624'],
  ['IL', 'Israel', '+972'],
  ['IT', 'Italy', '+39'],
  ['CI', 'Ivory Coast', '+225'],
  ['JM', 'Jamaica', '+1-876'],
  ['JP', 'Japan', '+81'],
  ['JE', 'Jersey', '+44-1534'],
  ['JO', 'Jordan', '+962'],
  ['KZ', 'Kazakhstan', '+7'],
  ['KE', 'Kenya', '+254'],
  ['KI', 'Kiribati', '+686'],
  ['XK', 'Kosovo', '+383'],
  ['KW', 'Kuwait', '+965'],
  ['KG', 'Kyrgyzstan', '+996'],
  ['LA', 'Laos', '+856'],
  ['LV', 'Latvia', '+371'],
  ['LB', 'Lebanon', '+961'],
  ['LS', 'Lesotho', '+266'],
  ['LR', 'Liberia', '+231'],
  ['LY', 'Libya', '+218'],
  ['LI', 'Liechtenstein', '+423'],
  ['LT', 'Lithuania', '+370'],
  ['LU', 'Luxembourg', '+352'],
  ['MO', 'Macau', '+853'],
  ['MK', 'North Macedonia', '+389'],
  ['MG', 'Madagascar', '+261'],
  ['MW', 'Malawi', '+265'],
  ['MY', 'Malaysia', '+60'],
  ['MV', 'Maldives', '+960'],
  ['ML', 'Mali', '+223'],
  ['MT', 'Malta', '+356'],
  ['MH', 'Marshall Islands', '+692'],
  ['MR', 'Mauritania', '+222'],
  ['MU', 'Mauritius', '+230'],
  ['YT', 'Mayotte', '+262'],
  ['MX', 'Mexico', '+52'],
  ['FM', 'Micronesia', '+691'],
  ['MD', 'Moldova', '+373'],
  ['MC', 'Monaco', '+377'],
  ['MN', 'Mongolia', '+976'],
  ['ME', 'Montenegro', '+382'],
  ['MS', 'Montserrat', '+1-664'],
  ['MA', 'Morocco', '+212'],
  ['MZ', 'Mozambique', '+258'],
  ['MM', 'Myanmar', '+95'],
  ['NA', 'Namibia', '+264'],
  ['NR', 'Nauru', '+674'],
  ['NP', 'Nepal', '+977'],
  ['NL', 'Netherlands', '+31'],
  ['NC', 'New Caledonia', '+687'],
  ['NZ', 'New Zealand', '+64'],
  ['NI', 'Nicaragua', '+505'],
  ['NE', 'Niger', '+227'],
  ['NG', 'Nigeria', '+234'],
  ['NU', 'Niue', '+683'],
  ['NF', 'Norfolk Island', '+672'],
  ['KP', 'North Korea', '+850'],
  ['MP', 'Northern Mariana Islands', '+1-670'],
  ['NO', 'Norway', '+47'],
  ['OM', 'Oman', '+968'],
  ['PK', 'Pakistan', '+92'],
  ['PW', 'Palau', '+680'],
  ['PS', 'Palestine', '+970'],
  ['PA', 'Panama', '+507'],
  ['PG', 'Papua New Guinea', '+675'],
  ['PY', 'Paraguay', '+595'],
  ['PE', 'Peru', '+51'],
  ['PH', 'Philippines', '+63'],
  ['PL', 'Poland', '+48'],
  ['PT', 'Portugal', '+351'],
  ['PR', 'Puerto Rico', '+1-787'],
  ['QA', 'Qatar', '+974'],
  ['CG', 'Republic of the Congo', '+242'],
  ['RE', 'Réunion', '+262'],
  ['RO', 'Romania', '+40'],
  ['RU', 'Russia', '+7'],
  ['RW', 'Rwanda', '+250'],
  ['BL', 'Saint Barthélemy', '+590'],
  ['SH', 'Saint Helena', '+290'],
  ['KN', 'Saint Kitts and Nevis', '+1-869'],
  ['LC', 'Saint Lucia', '+1-758'],
  ['MF', 'Saint Martin', '+590'],
  ['PM', 'Saint Pierre and Miquelon', '+508'],
  ['VC', 'Saint Vincent and the Grenadines', '+1-784'],
  ['WS', 'Samoa', '+685'],
  ['SM', 'San Marino', '+378'],
  ['ST', 'São Tomé and Príncipe', '+239'],
  ['SA', 'Saudi Arabia', '+966'],
  ['SN', 'Senegal', '+221'],
  ['RS', 'Serbia', '+381'],
  ['SC', 'Seychelles', '+248'],
  ['SL', 'Sierra Leone', '+232'],
  ['SG', 'Singapore', '+65'],
  ['SX', 'Sint Maarten', '+1-721'],
  ['SK', 'Slovakia', '+421'],
  ['SI', 'Slovenia', '+386'],
  ['SB', 'Solomon Islands', '+677'],
  ['SO', 'Somalia', '+252'],
  ['ZA', 'South Africa', '+27'],
  ['KR', 'South Korea', '+82'],
  ['SS', 'South Sudan', '+211'],
  ['ES', 'Spain', '+34'],
  ['LK', 'Sri Lanka', '+94'],
  ['SD', 'Sudan', '+249'],
  ['SR', 'Suriname', '+597'],
  ['SE', 'Sweden', '+46'],
  ['CH', 'Switzerland', '+41'],
  ['SY', 'Syria', '+963'],
  ['TW', 'Taiwan', '+886'],
  ['TJ', 'Tajikistan', '+992'],
  ['TZ', 'Tanzania', '+255'],
  ['TH', 'Thailand', '+66'],
  ['TG', 'Togo', '+228'],
  ['TK', 'Tokelau', '+690'],
  ['TO', 'Tonga', '+676'],
  ['TT', 'Trinidad and Tobago', '+1-868'],
  ['TN', 'Tunisia', '+216'],
  ['TR', 'Turkey', '+90'],
  ['TM', 'Turkmenistan', '+993'],
  ['TC', 'Turks and Caicos Islands', '+1-649'],
  ['TV', 'Tuvalu', '+688'],
  ['UG', 'Uganda', '+256'],
  ['UA', 'Ukraine', '+380'],
  ['AE', 'United Arab Emirates', '+971'],
  ['GB', 'United Kingdom', '+44'],
  ['US', 'United States', '+1'],
  ['UY', 'Uruguay', '+598'],
  ['UZ', 'Uzbekistan', '+998'],
  ['VU', 'Vanuatu', '+678'],
  ['VA', 'Vatican City', '+39'],
  ['VE', 'Venezuela', '+58'],
  ['VN', 'Vietnam', '+84'],
  ['EH', 'Western Sahara', '+212'],
  ['YE', 'Yemen', '+967'],
  ['ZM', 'Zambia', '+260'],
  ['ZW', 'Zimbabwe', '+263'],
];

// ── Hydrated catalog ──
export const WORLD_COUNTRIES = RAW.map(([code, name, phoneCode]) => ({
  code,
  name,
  flag: codeToFlag(code),
  phoneCode,
}));

// ── Lookup maps ──
export const COUNTRY_BY_CODE = WORLD_COUNTRIES.reduce((acc, c) => {
  acc[c.code] = c;
  return acc;
}, {});

// Case-insensitive name lookup so legacy ethnicity strings ("Kenya")
// resolve to the right record when migrating display logic over.
const COUNTRY_BY_NAME = WORLD_COUNTRIES.reduce((acc, c) => {
  acc[c.name.toLowerCase()] = c;
  return acc;
}, {});

/**
 * Resolve a country record from a code or name. Returns null if not found —
 * callers should provide a safe fallback (e.g. the 🌍 emoji).
 */
export function getCountry(value) {
  if (!value || typeof value !== 'string') return null;
  const upper = value.toUpperCase();
  if (COUNTRY_BY_CODE[upper]) return COUNTRY_BY_CODE[upper];
  return COUNTRY_BY_NAME[value.toLowerCase()] || null;
}

/**
 * Searchable-picker option shape — `{ label, value, description? }`.
 * Used by EditProfileScreen's country dropdown and ProfileSetup's
 * country step. `value` is the ISO alpha-2 code (what we persist to
 * User.countryCode); `label` is what the user reads in the list.
 */
export const COUNTRY_PICKER_OPTIONS = WORLD_COUNTRIES.map((c) => ({
  label: `${c.flag}  ${c.name}`,
  value: c.code,
}));

export default WORLD_COUNTRIES;
