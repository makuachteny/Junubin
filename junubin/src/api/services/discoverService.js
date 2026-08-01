import { supabase } from '../../config/supabase';

// Calls the discover-nearby Edge Function (see
// supabase/functions/discover-nearby/index.ts). Body shape:
//   { center: { latitude, longitude }, radiusKm, mode, activeOnly }
// Response:
//   { users: [{ id, name, age, photos, coords, activity, verified,
//              ethnicity, mode, distanceKm }] }
//
// The function does its own auth check, applies shareLocation +
// block + mode filters, and bucket-snaps coordinates server-side.
// If the function isn't deployed (404) or any network error fires,
// we swallow and return an empty list — PeopleMap's demo roster
// fallback covers the empty case, so the map never crashes.
export async function getNearbyUsers({ center, radiusKm, mode, activeOnly } = {}) {
  if (!center || !Number.isFinite(center.latitude) || !Number.isFinite(center.longitude)) {
    return { users: [] };
  }
  try {
    const { data, error } = await supabase.functions.invoke('discover-nearby', {
      body: {
        center: { latitude: center.latitude, longitude: center.longitude },
        radiusKm: radiusKm || undefined,
        mode: mode ? String(mode).toLowerCase() : undefined,
        activeOnly: !!activeOnly,
      },
    });
    if (error) throw error;
    return { users: Array.isArray(data?.users) ? data.users : [] };
  } catch (err) {
    if (__DEV__) console.warn('[discover-nearby] failed, falling back to empty:', err?.message || err);
    return { users: [] };
  }
}
