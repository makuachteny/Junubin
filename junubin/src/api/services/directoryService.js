// JuNubin — Directory Service
//
// Client for the `directory` Edge Function: the searchable people
// directory that replaces the swipe deck as the primary way to find
// other Junubin. The function runs service-role because the `User`
// SELECT policy (00029/00047) hides strangers from direct client
// queries — there is no client-side equivalent of this call.
import { supabase } from '../../config/supabase';
import { normalizeProfile } from './profileService';
import { cacheGet, cacheSet } from '../../utils/offlineCache';

const OFFLINE_DIRECTORY_TTL = 300_000; // 5 min persistent cache

const EMPTY_RESULT = { people: [], nextCursor: null };

// Comma-join a facet the way the Edge Function parses it. Accepts an
// array or an already-joined string so callers can pass either.
function toCommaList(value) {
  if (Array.isArray(value)) {
    const parts = value.map((v) => String(v || '').trim()).filter(Boolean);
    return parts.length ? parts.join(',') : null;
  }
  const str = String(value || '').trim();
  return str || null;
}

// supabase-js wraps a non-2xx function response in a FunctionsHttpError
// whose `context` is the raw Response. A 404 means the function isn't
// deployed on this project yet — the migration/deploy is on the
// operator's todo — and the directory should render empty rather than
// throw an error banner at the user.
function isNotDeployed(err) {
  const status = err?.context?.status ?? err?.status;
  if (status === 404) return true;
  return /not\s*found/i.test(err?.message || '');
}

/**
 * Search the people directory.
 *
 * @param {object} filters
 * @param {string}          filters.query        free text over name / city / job / school
 * @param {string}          filters.city
 * @param {string}          filters.countryCode
 * @param {string}          filters.ethnicity
 * @param {string[]|string} filters.interests
 * @param {string[]|string} filters.languages
 * @param {string[]|string} filters.openTo
 * @param {string}          filters.profession
 * @param {string}          filters.school
 * @param {boolean}         filters.verifiedOnly
 * @param {string}          filters.cursor
 * @param {number}          filters.limit        default 24, max 50 server-side
 * @returns {Promise<{ people: Array<object>, nextCursor: string|null }>}
 */
export async function searchDirectory({
  query,
  city,
  countryCode,
  ethnicity,
  interests,
  languages,
  openTo,
  profession,
  school,
  verifiedOnly,
  cursor,
  limit,
} = {}) {
  const params = new URLSearchParams();
  if (query) params.set('q', String(query).trim());
  if (city) params.set('city', city);
  if (countryCode) params.set('countryCode', countryCode);
  if (ethnicity) params.set('ethnicity', ethnicity);
  if (profession) params.set('profession', profession);
  if (school) params.set('school', school);

  const interestList = toCommaList(interests);
  if (interestList) params.set('interests', interestList);
  const languageList = toCommaList(languages);
  if (languageList) params.set('languages', languageList);
  const openToList = toCommaList(openTo);
  if (openToList) params.set('openTo', openToList);

  if (verifiedOnly) params.set('verified', 'true');
  if (cursor) params.set('cursor', cursor);
  if (limit) params.set('limit', String(limit));

  const qs = params.toString();
  const offlineKey = `directory_${qs}`;

  try {
    const { data, error } = await supabase.functions.invoke(`directory${qs ? `?${qs}` : ''}`);
    if (error) throw error;

    const result = {
      people: (data?.people || []).map(normalizeProfile).filter(Boolean),
      nextCursor: data?.nextCursor || null,
    };

    // Only the first page is worth persisting — a cursor page out of
    // context is not something the offline view can render coherently.
    if (!cursor) cacheSet(offlineKey, result, OFFLINE_DIRECTORY_TTL);

    return result;
  } catch (err) {
    // Function not deployed yet → empty directory, no error surfaced.
    if (isNotDeployed(err)) {
      if (__DEV__) console.warn('[directory] function not deployed; returning empty');
      return EMPTY_RESULT;
    }

    // Network failure → serve the last good page, same fallback shape
    // discoverService.getProfiles uses.
    const offline = await cacheGet(offlineKey);
    if (offline) return offline;

    if (__DEV__) console.warn('[directory] search failed:', err?.message || err);
    return EMPTY_RESULT;
  }
}
