// useNearbyPeople — ONE people set for the whole Nearby tab.
//
// In the design the map pins and the list rows render the same
// `filteredPeople()` set, which is why a list row can read
// "1.2 km · Nurse". The first implementation fetched them separately —
// map from `discover-nearby`, list from the directory — so the two
// surfaces disagreed on membership and the rows lost their distance
// (the city was substituted under the design's distance label). Both
// surfaces now read this hook, and a missing distance is OMITTED, never
// swapped for a different datum.
//
// Privacy contract (mirrors the header of components/PeopleMap.js and
// utils/locationConsent.js): nothing in this file touches
// `expo-location` until `enabled` is true, and `enabled` is only ever
// true once the user has accepted the in-app disclosure. Declining is
// not a dead end — we fall back to the directory, which needs no
// location at all.
//
// Source resolution order:
//   1. `discover-nearby` around the device location — carries real
//      per-person distances and honours the server-side visibility,
//      block and radius rules.
//   2. The demo roster spread around that same location (seed builds
//      only), so an early-launch map is not blank. Distances are
//      computed client-side against the same center.
//   3. The directory, whenever there is no device location to measure
//      from: consent declined, OS permission denied, or the user is
//      browsing a city that isn't theirs. These rows have no distance,
//      so the meta line drops that segment.

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Location from 'expo-location';
import * as discoverService from '../api/services/discoverService';
import * as directoryService from '../api/services/directoryService';
import { DEMO_ROSTER } from '../data/__dev__/demoRoster';
import { DEMO_DATA_ENABLED } from '../config/demoData';
import { reportError } from '../utils/reportError';

const PAGE_SIZE = 24;

// Bucket lat/long to ~110m precision. The same function applied to a
// real user's coords rounds a Manhattan address to a city block.
const bucketCoord = (n) => Math.round(n * 1000) / 1000;

// Project a coordinate `distanceKm` away from `center` along
// `bearingDeg` (0 = north, 90 = east). Spherical rather than flat-earth
// because it costs nothing extra.
export const offsetCoord = (center, bearingDeg, distanceKm) => {
  const R = 6371;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (center.latitude * Math.PI) / 180;
  const lng1 = (center.longitude * Math.PI) / 180;
  const d = distanceKm / R;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing),
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
    Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
  );
  return { latitude: (lat2 * 180) / Math.PI, longitude: (lng2 * 180) / Math.PI };
};

// Haversine in km. Mirrors the formula the discover-nearby Edge
// Function uses, so a client-computed distance and a server-supplied
// one agree to within rounding error.
export const haversineKm = (a, b) => {
  if (!a || !b) return NaN;
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// Demo users are scattered around the caller's location instead of
// pinned to their bio cities. Without this, a tester opening the map
// from Toronto sees an empty viewport because the whole roster lives
// hundreds of km away. Each user gets a deterministic offset so the
// layout is stable across re-renders, but follows wherever the tester
// actually is.
const demoPeople = (center) => {
  if (!DEMO_DATA_ENABLED) return [];
  return DEMO_ROSTER
    .map((u, i) => {
      if (!center) return u.coords ? u : null;
      const angle = (i * 36) % 360;
      const bands = [0.3, 1.5, 6, 18, 45, 80, 140, 240, 400, 700];
      return { ...u, coords: offsetCoord(center, angle, bands[i % bands.length]) };
    })
    .filter(Boolean);
};

// Server-supplied distance wins; otherwise measure against the center
// we already have. People with neither keep no distance at all.
const withDistance = (list, center) => list.map((p) => {
  if (Number.isFinite(p.distanceKm)) return p;
  const km = center && p.coords ? haversineKm(center, p.coords) : NaN;
  return Number.isFinite(km) ? { ...p, distanceKm: km } : p;
});

// The legacy profile column is `job`; the social-pivot one is
// `profession` (00047). Same datum, two names.
export const personProfession = (person) => person?.profession || person?.job || '';

// Design writes distances as "1.2 km" under 10km and "24 km" above.
// Returns null when there is nothing real to state.
export function distanceLabel(person) {
  const km = person?.distanceKm;
  if (!Number.isFinite(km)) return null;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

// List row meta — design: "1.2 km · Nurse".
export function nearbyMeta(person) {
  return [distanceLabel(person), personProfession(person)].filter(Boolean).join(' · ');
}

// Selected-pin card meta — design: "1.2 km away · Nurse".
export function nearbyCardMeta(person) {
  const dist = distanceLabel(person);
  return [dist ? `${dist} away` : null, personProfession(person)]
    .filter(Boolean).join(' · ');
}

export const isActiveThisWeek = (person) => {
  if (!person?.lastActiveAt) return false;
  const days = (Date.now() - new Date(person.lastActiveAt).getTime()) / 8.64e7;
  return Number.isFinite(days) && days <= 7;
};

// The design's quick chips filter the shared set client-side, so map
// and list can never disagree about what a chip means.
export function filterNearby(people, quickFilter) {
  if (quickFilter === 'verified') return people.filter((p) => p.verified);
  if (quickFilter === 'active') {
    return people.filter((p) => p.activity === 'active' || isActiveThisWeek(p));
  }
  return people;
}

export function useNearbyPeople({ enabled = false, cityQuery = null, quickFilter = 'all' } = {}) {
  const [region, setRegion] = useState(null);
  const [center, setCenter] = useState(null);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState(null);
  // null = not resolved yet; an array = resolved (possibly empty).
  const [nearby, setNearby] = useState(null);
  const [directory, setDirectory] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((n) => n + 1), []);

  // ── Device location. Gated on `enabled`; see the privacy contract. ──
  useEffect(() => {
    if (!enabled) {
      setLocating(false);
      setCenter(null);
      setRegion(null);
      setLocationError(null);
      return undefined;
    }
    let cancelled = false;
    setLocating(true);
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          setLocationError('Enable Location in Settings to center the map on you.');
          setCenter(null);
          setLocating(false);
          return;
        }
        const loc = await Location.getLastKnownPositionAsync({ maxAge: 60_000 })
          ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const next = {
          latitude: bucketCoord(loc.coords.latitude),
          longitude: bucketCoord(loc.coords.longitude),
        };
        setCenter(next);
        setRegion({ ...next, latitudeDelta: 0.5, longitudeDelta: 0.5 });
        setLocationError(null);
      } catch (err) {
        if (!cancelled) setLocationError(err?.message || 'Could not get location.');
      } finally {
        if (!cancelled) setLocating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, reloadKey]);

  // `center` is a fresh object each render, so depend on its primitives.
  const lat = center?.latitude;
  const lng = center?.longitude;
  const hasCenter = Number.isFinite(lat) && Number.isFinite(lng);

  // ── Source 1/2: nearby discovery around the device location. ──
  useEffect(() => {
    if (cityQuery || !hasCenter) { setNearby(null); return undefined; }
    let cancelled = false;
    setFetching(true);
    setError(false);
    discoverService.getNearbyUsers({ center: { latitude: lat, longitude: lng } })
      .then(({ users }) => { if (!cancelled) setNearby(users || []); })
      .catch((err) => {
        if (cancelled) return;
        reportError('useNearbyPeople.nearby', err);
        setNearby([]);
        setError(true);
      })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, [lat, lng, hasCenter, cityQuery, reloadKey]);

  // ── Source 3: directory, whenever there is no center to measure from
  // (declined consent, denied OS permission) or the user asked for a
  // specific city. Rows from here carry no distance by construction.
  const usesDirectory = !!cityQuery || (!enabled) || (!locating && !hasCenter);

  useEffect(() => {
    if (!usesDirectory) {
      setDirectory(null);
      setNextCursor(null);
      return undefined;
    }
    let cancelled = false;
    setFetching(true);
    setError(false);
    directoryService.searchDirectory({
      city: cityQuery || undefined,
      verifiedOnly: quickFilter === 'verified' || undefined,
      limit: PAGE_SIZE,
    })
      .then(({ people: results, nextCursor: cursor }) => {
        if (cancelled) return;
        setDirectory(results || []);
        setNextCursor(cursor || null);
      })
      .catch((err) => {
        if (cancelled) return;
        reportError('useNearbyPeople.directory', err, { city: cityQuery });
        setDirectory([]);
        setNextCursor(null);
        setError(true);
      })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, [usesDirectory, cityQuery, quickFilter, reloadKey]);

  const loadMore = useCallback(() => {
    if (!usesDirectory || !nextCursor || fetching) return;
    setFetching(true);
    directoryService.searchDirectory({
      city: cityQuery || undefined,
      verifiedOnly: quickFilter === 'verified' || undefined,
      cursor: nextCursor,
      limit: PAGE_SIZE,
    })
      .then(({ people: results, nextCursor: cursor }) => {
        setDirectory((prev) => [...(prev || []), ...(results || [])]);
        setNextCursor(cursor || null);
      })
      .catch((err) => { reportError('useNearbyPeople.loadMore', err); })
      .finally(() => setFetching(false));
  }, [usesDirectory, nextCursor, fetching, cityQuery, quickFilter]);

  const people = useMemo(() => {
    if (!cityQuery && hasCenter && Array.isArray(nearby)) {
      const measuredFrom = { latitude: lat, longitude: lng };
      if (nearby.length > 0) return withDistance(nearby, measuredFrom);
      const demo = demoPeople(measuredFrom);
      if (demo.length > 0) return withDistance(demo, measuredFrom);
      return [];
    }
    return Array.isArray(directory) ? directory : [];
  }, [cityQuery, hasCenter, lat, lng, nearby, directory]);

  const filtered = useMemo(() => filterNearby(people, quickFilter), [people, quickFilter]);

  // We are still "loading" while location is resolving, otherwise the
  // list flashes an empty state before the first fetch lands.
  const loading = fetching
    || (enabled && !cityQuery && locating)
    || (usesDirectory ? directory === null : nearby === null && hasCenter);

  return {
    people: filtered,
    allPeople: people,
    center: hasCenter ? { latitude: lat, longitude: lng } : null,
    region,
    locating,
    locationError,
    loading,
    error,
    // True when rows can state a real distance. False for the directory
    // fallback, where the meta line drops the distance segment.
    hasDistances: !cityQuery && hasCenter,
    canLoadMore: usesDirectory && !!nextCursor,
    loadMore,
    reload,
  };
}

export default useNearbyPeople;
