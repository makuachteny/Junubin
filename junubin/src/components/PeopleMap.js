// PeopleMap — Snap-Map-style overlay for the Connect / Home tab.
//
// Privacy contract (must stay in sync with 00032_share_location_optin.sql):
//   1. Users are visible on the map only if Profile.shareLocation === true.
//   2. Coordinates are bucketed to 3 decimal places (~110m precision)
//      client-side before rendering, so even an opted-in user never
//      reveals a precise apartment.
//   3. The map is read-only for tier 1 — tapping a pin opens a small
//      preview card that links to ProfileDetail. No DM-from-map yet
//      (would surface as a stalker vector before we have proper
//      "ghost mode" tooling).
//   4. Demo users from DEMO_ROSTER appear regardless of
//      shareLocation — they're seed data for testability, not real
//      people whose privacy could leak.

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Animated,
  ActivityIndicator,
  Modal,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, FontFamily, Typography } from '../theme';
import { imageSource } from '../utils/imageSource';
import { DEMO_ROSTER } from '../data/__dev__/demoRoster';
import { DEMO_DATA_ENABLED } from '../config/demoData';

// `react-native-maps` ships a native module. When the JS bundle is
// loaded by Expo Go (or by any client missing the linked native code —
// e.g. an older dev-client build), the require below throws at module
// init time and crashes the whole app. We swallow the error and fall
// back to a friendly placeholder so the rest of HomeScreen stays
// usable. Production builds (TestFlight / App Store) include the
// native module via EAS, so the require succeeds and the real map
// renders.
let MapView = null;
let Marker = null;
let PROVIDER_DEFAULT = null;
try {
  // eslint-disable-next-line global-require
  const Maps = require('react-native-maps');
  MapView = Maps.default;
  Marker = Maps.Marker;
  PROVIDER_DEFAULT = Maps.PROVIDER_DEFAULT;
} catch {
  // Native module unavailable — fallback view rendered below.
}

// Bucket lat/long to ~110m precision. Same function applied to real
// user coords would round Manhattan addresses to a city block.
const bucketCoord = (n) => Math.round(n * 1000) / 1000;

// Mode-case quirk: demo roster uses capitalized 'Dating' / 'Social' /
// 'Both' (matches the client's UI toggle vocabulary), but real users
// from the server carry lowercase 'dating' / 'social' (the 00025
// CHECK constraint). Normalize before comparing.
const norm = (v) => String(v || '').toLowerCase();

const matchesMode = (userMode, target) => {
  const m = norm(userMode);
  const t = norm(target);
  if (t === 'dating') return m === 'dating' || m === 'both';
  if (t === 'social') return m === 'social' || m === 'both';
  return true;
};

// Project a coordinate `distanceKm` away from `center` along
// `bearingDeg` (0 = north, 90 = east). Standard great-circle math; we
// only need ≤ ~5km accuracy so flat-earth approximation would also
// work but the spherical version costs nothing extra.
const offsetCoord = (center, bearingDeg, distanceKm) => {
  const R = 6371; // earth radius in km
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

// Haversine — straight-line distance (km) between two coords. Used to
// filter pins by the Nearby / 25mi / 50mi chips. Mirrors the formula
// that the server-side discover function will use once we have real
// location data.
const distanceKm = (a, b) => {
  if (!a || !b) return Infinity;
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const KM_PER_MILE = 1.609344;

// Distance filter presets. Values are radii in km; null = no cap.
// Matches the Distance dropdown in the swipe-deck FilterBar so a user
// who set "25 miles" there sees the same vocabulary on the map.
const DISTANCE_FILTERS = [
  { id: 'nearby', label: 'Nearby', maxKm: 5 * KM_PER_MILE },
  { id: '25mi',   label: '25 mi',  maxKm: 25 * KM_PER_MILE },
  { id: '50mi',   label: '50 mi',  maxKm: 50 * KM_PER_MILE },
  { id: 'any',    label: 'Anywhere', maxKm: null },
];

// Demo users are scattered around the caller's location instead of
// pinned to their bio cities. Without this, a tester opening the map
// from Toronto sees an empty viewport because Adau (Minneapolis),
// Abuk (Sydney) and the rest are all hundreds of km away. Each user
// gets a deterministic offset from `center` so the layout is stable
// across re-renders — Adau is always 0.4km north-east of you, Abuk
// is always 0.6km south, etc. — but the absolute position follows
// wherever the tester actually is. Distance distribution intentionally
// spans 0.3 → 60 km so the Nearby / 25mi / 50mi chips each reveal a
// distinct subset of the roster.
//
// `center === null` (location permission denied) falls back to the
// roster's static city coords so the map at least shows the demo
// users somewhere meaningful.
const peopleForMode = (mode, center) => {
  if (!DEMO_DATA_ENABLED) return [];
  return DEMO_ROSTER
    .filter((u) => matchesMode(u.mode, mode))
    .map((u, i) => {
      if (!center) {
        if (!u.coords) return null;
        return u;
      }
      // Stable per-user spread: even angle distribution (i * 36°),
      // and a step of distance bands so the chip filters reveal
      // genuinely different rosters: 0.3, 1.5, 6, 18, 45, 80km, ...
      const angle = (i * 36) % 360;
      const bands = [0.3, 1.5, 6, 18, 45, 80, 140, 240, 400, 700];
      const dist = bands[i % bands.length];
      return { ...u, coords: offsetCoord(center, angle, dist) };
    })
    .filter(Boolean);
};

export default function PeopleMap({ mode = 'Dating', onPersonPress, topInset = 12 }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { width: screenW } = useWindowDimensions();
  const mapRef = useRef(null);
  const previewAnim = useRef(new Animated.Value(0)).current;
  const [selected, setSelected] = useState(null);
  // Screen-space pixel anchor of the tapped marker. Captured once when
  // openPreview fires (via MapView.pointForCoordinate) so the preview
  // card can render directly above the pin. The card is dismissed on
  // region change so we don't need to re-project as the user pans.
  const [previewAnchor, setPreviewAnchor] = useState(null);
  const [region, setRegion] = useState(null);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState(null);
  // Filter state: distance band + Active-now toggle. Both default to
  // Anywhere / off so a fresh open shows the maximum roster.
  const [distanceFilter, setDistanceFilter] = useState('any');
  const [activeOnly, setActiveOnly] = useState(false);
  // Customize sheet — secondary filters tucked behind a "More" icon so
  // the chip row stays scannable. 'any' = no filter applied.
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [genderFilter, setGenderFilter] = useState('any');  // 'any' | 'man' | 'woman'

  // Pull the caller's current location once. If they decline the
  // permission, fall back to a centroid of the visible people so the
  // map opens on Adau's continent and not Antarctica.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (cancelled) return;
          setLocationError('Enable Location in Settings to center the map on you.');
          // Centroid fallback — average the static city coords.
          const fallback = peopleForMode(mode, null);
          if (fallback.length > 0) {
            const lat = fallback.reduce((s, p) => s + p.coords.latitude, 0) / fallback.length;
            const lng = fallback.reduce((s, p) => s + p.coords.longitude, 0) / fallback.length;
            setRegion({ latitude: lat, longitude: lng, latitudeDelta: 60, longitudeDelta: 60 });
          }
          setLocating(false);
          return;
        }
        const loc = await Location.getLastKnownPositionAsync({ maxAge: 60_000 })
          ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        setRegion({
          latitude: bucketCoord(loc.coords.latitude),
          longitude: bucketCoord(loc.coords.longitude),
          latitudeDelta: 0.5,
          longitudeDelta: 0.5,
        });
      } catch (err) {
        if (!cancelled) setLocationError(err?.message || 'Could not get location.');
      } finally {
        if (!cancelled) setLocating(false);
      }
    })();
    return () => { cancelled = true; };
    // We intentionally only run this on mount — the centroid fallback
    // uses the initial mode snapshot which is fine, the map's pan
    // gestures handle further navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolve the offset center from the current region (caller's
  // device location once Location resolves). When region is still
  // null we feed `null` so the roster falls back to its static city
  // coords.
  const center = region ? { latitude: region.latitude, longitude: region.longitude } : null;

  const allPeople = useMemo(
    () => peopleForMode(mode, center),
    // center is a fresh object each render so we depend on its
    // primitive parts to avoid useless recomputes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, center?.latitude, center?.longitude],
  );

  // Apply chip filters. `Nearby` / `25mi` / `50mi` cap by haversine
  // distance from the caller; `any` disables the cap. Active-now
  // intersects with `activity === 'active'`.
  const visiblePeople = useMemo(() => {
    const cfg = DISTANCE_FILTERS.find((d) => d.id === distanceFilter) || DISTANCE_FILTERS[3];
    return allPeople.filter((p) => {
      if (activeOnly && p.activity !== 'active') return false;
      if (verifiedOnly && !p.verified) return false;
      if (genderFilter !== 'any') {
        const g = String(p.gender || '').toLowerCase();
        if (genderFilter === 'man' && g !== 'man') return false;
        if (genderFilter === 'woman' && g !== 'woman') return false;
      }
      if (cfg.maxKm == null || !center) return true;
      return distanceKm(center, p.coords) <= cfg.maxKm;
    });
  }, [allPeople, distanceFilter, activeOnly, verifiedOnly, genderFilter, center]);

  const moreFiltersActive = verifiedOnly || genderFilter !== 'any';

  const openPreview = useCallback(async (person) => {
    setSelected(person);
    // Translate the tapped person's lat/lng into screen pixels so the
    // preview card can render directly above the marker. If the map
    // ref isn't ready or the projection fails (Android edge case),
    // fall back to a centered bottom-sheet style anchor below.
    if (mapRef.current && person?.coords) {
      try {
        const pt = await mapRef.current.pointForCoordinate(person.coords);
        if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
          setPreviewAnchor({ x: pt.x, y: pt.y });
        } else {
          setPreviewAnchor(null);
        }
      } catch {
        setPreviewAnchor(null);
      }
    } else {
      setPreviewAnchor(null);
    }
    Animated.spring(previewAnim, {
      toValue: 1, useNativeDriver: true, tension: 80, friction: 9,
    }).start();
  }, [previewAnim]);

  const closePreview = useCallback(() => {
    Animated.timing(previewAnim, {
      toValue: 0, duration: 180, useNativeDriver: true,
    }).start(() => {
      setSelected(null);
      setPreviewAnchor(null);
    });
  }, [previewAnim]);

  const handleViewProfile = useCallback(() => {
    if (selected && onPersonPress) onPersonPress(selected);
    closePreview();
  }, [selected, onPersonPress, closePreview]);

  const recenter = useCallback(() => {
    if (!region || !mapRef.current) return;
    mapRef.current.animateToRegion(region, 400);
  }, [region]);

  // Filter chips render above the map so they're always reachable
  // even when a marker is selected. Pulled into a sub-render so the
  // fallback view can reuse it.
  const renderFilters = () => (
    <View style={[styles.filterBar, { top: topInset }]} pointerEvents="box-none">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {DISTANCE_FILTERS.map((f) => {
          const active = distanceFilter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setDistanceFilter(f.id)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={`Filter ${f.label}`}
              accessibilityState={{ selected: active }}
            >
              {f.id === 'nearby' && (
                <Ionicons name="location" size={12} color={active ? '#FFF' : colors.black} style={{ marginRight: 4 }} />
              )}
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.chip, activeOnly && styles.chipActive]}
          onPress={() => setActiveOnly((v) => !v)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Active now"
          accessibilityState={{ selected: activeOnly }}
        >
          <View style={[styles.activeDot, activeOnly && styles.activeDotOn]} />
          <Text style={[styles.chipText, activeOnly && styles.chipTextActive]}>Active now</Text>
        </TouchableOpacity>

        {/* Customize sheet trigger — secondary filters (verified, gender)
            live behind here so the visible chip row stays scannable.
            Accent dot appears when one of the hidden filters is on. */}
        <TouchableOpacity
          style={styles.moreBtn}
          onPress={() => setShowMoreFilters(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Customize filters"
        >
          <Ionicons name="options-outline" size={16} color={colors.black} />
          {moreFiltersActive && <View style={styles.moreDot} />}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderMoreFiltersSheet = () => (
    <Modal
      visible={showMoreFilters}
      transparent
      animationType="slide"
      onRequestClose={() => setShowMoreFilters(false)}
    >
      <Pressable style={styles.sheetOverlay} onPress={() => setShowMoreFilters(false)}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <View style={styles.sheetGrabber} />
          <Text style={styles.sheetTitle}>Customize</Text>

          <Text style={styles.sheetSection}>Show me</Text>
          <View style={styles.sheetPillRow}>
            {[
              { id: 'any',   label: 'Everyone' },
              { id: 'man',   label: 'Men' },
              { id: 'woman', label: 'Women' },
            ].map((opt) => {
              const active = genderFilter === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.sheetPill, active && styles.sheetPillActive]}
                  onPress={() => setGenderFilter(opt.id)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.sheetPillText, active && styles.sheetPillTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sheetSection}>Trust</Text>
          <TouchableOpacity
            style={[styles.sheetRow, verifiedOnly && styles.sheetRowActive]}
            onPress={() => setVerifiedOnly((v) => !v)}
            activeOpacity={0.85}
            accessibilityRole="switch"
            accessibilityState={{ checked: verifiedOnly }}
          >
            <Ionicons
              name="shield-checkmark"
              size={18}
              color={verifiedOnly ? colors.accent : colors.gray500}
            />
            <Text style={styles.sheetRowText}>Verified profiles only</Text>
            <View style={[styles.toggleDot, verifiedOnly && styles.toggleDotOn]} />
          </TouchableOpacity>

          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={styles.sheetClearBtn}
              onPress={() => { setVerifiedOnly(false); setGenderFilter('any'); }}
              activeOpacity={0.8}
            >
              <Text style={styles.sheetClearText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sheetDoneBtn}
              onPress={() => setShowMoreFilters(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.sheetDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );

  // ── Fallback when react-native-maps native module is missing
  // (Expo Go, broken dev client). Render the same chrome — privacy
  // banner, filter chips, recenter shell — but with an explanatory
  // surface instead of a real map.
  if (!MapView) {
    return (
      <View style={styles.container}>
        <View style={styles.fallbackInner}>
          <Ionicons name="map-outline" size={48} color={colors.gray400} />
          <Text style={styles.fallbackTitle}>Map preview unavailable</Text>
          <Text style={styles.fallbackBody}>
            The map needs a native build. Open this view in TestFlight or a custom dev client.
          </Text>
        </View>
        <View style={[styles.banner, { top: topInset + 48 }]}>
          <Ionicons name="shield-checkmark" size={14} color="#FFF" />
          <Text style={styles.bannerText} numberOfLines={2}>
            You&apos;re hidden by default. Turn on &quot;Appear on map&quot; in Settings to share.
          </Text>
        </View>
        {renderFilters()}
        {renderMoreFiltersSheet()}
      </View>
    );
  }

  if (locating && !region) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={styles.loadingText}>Loading map…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        // Apple Maps on iOS (free, no API key). Google Maps on Android
        // would need a key wired in app.config.js; default provider
        // falls back to Google's free tier with a watermark, which is
        // acceptable for v1 launch.
        provider={PROVIDER_DEFAULT}
        initialRegion={region || {
          latitude: 39.5, longitude: -98.5,
          latitudeDelta: 60, longitudeDelta: 60,
        }}
        showsUserLocation
        showsCompass={false}
        showsScale={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        // Closing the preview when the user pans / zooms saves us from
        // re-projecting on every frame — the pixel anchor goes stale
        // the moment the region shifts. User can re-tap to re-open.
        onRegionChange={() => { if (selected) closePreview(); }}
      >
        {visiblePeople.map((p) => (
          <Marker
            key={p.id}
            coordinate={p.coords}
            // We render our own marker chrome — an Image inside a
            // ring — so the iOS-default red pin doesn't stomp on the
            // app's visual language.
            tracksViewChanges={false}
            onPress={() => openPreview(p)}
          >
            <View style={styles.marker}>
              <Image source={imageSource(p.photos?.[0])} style={styles.markerPhoto} />
              {p.activity === 'active' && <View style={styles.markerActiveDot} />}
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Privacy disclaimer overlays the top of the map so the rule is
          visible every time a user opens this view. */}
      <View style={styles.banner}>
        <Ionicons name="shield-checkmark" size={14} color="#FFF" />
        <Text style={styles.bannerText} numberOfLines={2}>
          You&apos;re hidden by default. Turn on &quot;Appear on map&quot; in Settings to share.
        </Text>
      </View>

      {renderFilters()}
      {renderMoreFiltersSheet()}

      {/* Result count pill — confirms the filter is doing something
          and gives an immediate sense of "is anyone near me?". */}
      <View style={[styles.countPill, { top: topInset + 92 }]}>
        <Text style={styles.countPillText}>
          {visiblePeople.length} {visiblePeople.length === 1 ? 'person' : 'people'}
        </Text>
      </View>

      {/* Recenter FAB — bottom-right, above the preview card slot. */}
      <TouchableOpacity style={styles.recenterBtn} onPress={recenter} activeOpacity={0.8}>
        <Ionicons name="locate" size={20} color={colors.black} />
      </TouchableOpacity>

      {locationError ? (
        <View style={styles.errorPill}>
          <Text style={styles.errorPillText} numberOfLines={1}>{locationError}</Text>
        </View>
      ) : null}

      {/* Tap-on-marker preview. Small card anchored just above the
          tapped pin — name + distance + verify check, with a CTA
          to open the full profile. Falls back to a centered bottom
          sheet when pointForCoordinate fails (rare Android case). */}
      {selected ? (() => {
        // Anchor math: card sits above the pin with a small tail.
        // The pin renders 44px tall, top-centered on the marker
        // coordinate, so the card needs ~28px clearance to leave room
        // for the avatar ring + the tail. Clamp left so the card
        // never escapes the screen edge.
        const CARD_W = 220;
        const MARKER_HALF = 22;
        const TAIL = 12;
        const SIDE_PADDING = 10;
        const anchored = !!previewAnchor;
        const left = anchored
          ? Math.max(SIDE_PADDING, Math.min(previewAnchor.x - CARD_W / 2, screenW - CARD_W - SIDE_PADDING))
          : null;
        return (
          <Animated.View
            pointerEvents="box-none"
            style={[
              anchored
                ? [
                    styles.previewAnchored,
                    {
                      left,
                      // y - card height - marker half - tail margin.
                      // The card height is dynamic; using a measured
                      // `previewBox` would be cleaner, but a fixed 96
                      // matches the compact layout below within a few
                      // px and avoids a measurement round trip.
                      top: previewAnchor.y - 96 - MARKER_HALF - TAIL,
                      width: CARD_W,
                    },
                  ]
                : styles.previewWrap,
              {
                opacity: previewAnim,
                transform: [{
                  translateY: previewAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: anchored ? [12, 0] : [80, 0],
                  }),
                }],
              },
            ]}
          >
            <View style={styles.previewCard}>
              <Image source={imageSource(selected.photos?.[0])} style={styles.previewAvatar} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.previewNameRow}>
                  <Text style={styles.previewName} numberOfLines={1}>
                    {selected.name}, {selected.age}
                  </Text>
                  {selected.verified ? (
                    <Ionicons name="checkmark-circle" size={12} color={colors.accent} style={{ marginLeft: 3 }} />
                  ) : null}
                </View>
                <Text style={styles.previewMeta} numberOfLines={1}>
                  {center && selected.coords
                    ? `${(distanceKm(center, selected.coords) / KM_PER_MILE).toFixed(1)} mi · ${selected.ethnicity || ''}`
                    : (selected.city || selected.ethnicity || '')}
                </Text>
              </View>
              <TouchableOpacity style={styles.previewClose} onPress={closePreview} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={14} color={colors.gray500} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.previewCta} onPress={handleViewProfile} activeOpacity={0.85}>
              <Text style={styles.previewCtaText}>View profile</Text>
            </TouchableOpacity>
            {anchored && (
              // Downward tail — a rotated square pulled half its height
              // out of the bottom of the card, centered over the pin.
              <View
                pointerEvents="none"
                style={[
                  styles.previewTail,
                  // Re-center the tail on the marker since the card
                  // itself may have been clamped against the screen edge.
                  { left: Math.max(8, Math.min(previewAnchor.x - left - 6, CARD_W - 20)) },
                ]}
              />
            )}
          </Animated.View>
        );
      })() : null}
    </View>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  loading: {
    flex: 1,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    gap: 8,
  },
  loadingText: {
    ...Typography.caption,
    color: colors.gray500,
  },
  banner: {
    position: 'absolute',
    left: 16, right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12,
  },
  bannerText: {
    flex: 1,
    color: '#FFF',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FontFamily.medium,
  },
  filterBar: {
    position: 'absolute',
    left: 0, right: 0,
  },
  filterRow: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  chipActive: {
    backgroundColor: colors.accent,
  },
  chipText: {
    fontSize: 12,
    color: colors.black,
    fontFamily: FontFamily.semibold,
  },
  chipTextActive: {
    color: '#FFF',
  },
  activeDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.gray400,
    marginRight: 6,
  },
  activeDotOn: {
    backgroundColor: '#22C55E',
  },
  moreBtn: {
    width: 36,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  moreDot: {
    position: 'absolute',
    top: 4,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },

  // ─── Customize sheet ───
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 32,
  },
  sheetGrabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray300,
    marginBottom: 12,
  },
  sheetTitle: {
    ...Typography.h3,
    color: colors.black,
    marginBottom: 6,
  },
  sheetSection: {
    fontSize: 13,
    fontFamily: FontFamily.semibold,
    color: colors.gray500,
    marginTop: 14,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sheetPillRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  sheetPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  sheetPillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  sheetPillText: {
    fontSize: 13,
    fontFamily: FontFamily.semibold,
    color: colors.black,
  },
  sheetPillTextActive: {
    color: '#FFFFFF',
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
  },
  sheetRowActive: {
    backgroundColor: isDark ? 'rgba(206,17,38,0.12)' : 'rgba(206,17,38,0.08)',
  },
  sheetRowText: {
    flex: 1,
    fontSize: 14,
    fontFamily: FontFamily.semibold,
    color: colors.black,
  },
  toggleDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.gray400,
    backgroundColor: 'transparent',
  },
  toggleDotOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  sheetClearBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
  },
  sheetClearText: {
    fontSize: 14,
    fontFamily: FontFamily.semibold,
    color: colors.gray700 || colors.black,
  },
  sheetDoneBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
  },
  sheetDoneText: {
    fontSize: 14,
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },
  countPill: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999,
  },
  countPillText: {
    color: '#FFF', fontSize: 11, fontFamily: FontFamily.semibold,
  },
  marker: {
    width: 44, height: 44, borderRadius: 22,
    padding: 2,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  markerPhoto: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.gray300,
  },
  markerActiveDot: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2, borderColor: '#FFF',
  },
  recenterBtn: {
    position: 'absolute',
    bottom: 24, right: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  errorPill: {
    position: 'absolute',
    bottom: 96, alignSelf: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  errorPillText: {
    color: '#FFF', fontSize: 12, fontFamily: FontFamily.medium,
  },
  // Fallback: bottom-sheet style anchor used when pointForCoordinate
  // didn't return a valid pixel. Still compact.
  previewWrap: {
    position: 'absolute',
    bottom: 80, left: 16, right: 16,
    gap: 6,
  },
  // Anchored above a specific marker via openPreview. Width is set
  // inline (CARD_W = 220), position too.
  previewAnchored: {
    position: 'absolute',
    gap: 6,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  previewAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.gray300,
  },
  previewNameRow: {
    flexDirection: 'row', alignItems: 'center',
  },
  previewName: {
    fontSize: 13, fontFamily: FontFamily.semibold, color: colors.black,
    flexShrink: 1,
  },
  previewMeta: {
    fontSize: 11, fontFamily: FontFamily.medium, color: colors.gray500, marginTop: 1,
  },
  previewClose: {
    padding: 2,
  },
  previewCta: {
    backgroundColor: colors.accent,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  previewCtaText: {
    color: '#FFF', fontSize: 12, fontFamily: FontFamily.semibold,
  },
  previewTail: {
    position: 'absolute',
    // Sit half-buried at the bottom edge of the CTA so the diamond
    // reads as a downward arrow pointing at the marker.
    bottom: -5,
    width: 12, height: 12,
    backgroundColor: colors.accent,
    transform: [{ rotate: '45deg' }],
    borderRadius: 2,
  },
  fallbackInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  fallbackTitle: {
    ...Typography.h3,
    color: colors.black,
    marginTop: 8,
  },
  fallbackBody: {
    fontSize: 13,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: FontFamily.medium,
  },
});
