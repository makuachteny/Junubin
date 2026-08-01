// PeopleMap — the map surface of the Home tab: South Sudanese people
// near you who chose to be visible.
//
// Industry redesign: the map renders FULL-BLEED under HomeScreen's
// floating chrome (city pill, Map|List segments, quick chips). This
// component no longer draws its own filter row — HomeScreen passes the
// active quick filter down via `quickFilter`. Pins are square photo
// tiles ringed cream (flag gold when selected); the current user is a
// pulsing gold dot dead-center; the tapped pin's preview is a
// Blueprint card that rises from the bottom.
//
// Privacy contract (must stay in sync with 00032_share_location_optin.sql
// and 00047_social_pivot.sql):
//   1. Users are visible on the map only if they set
//      Profile.locationVisibility to something other than 'off'
//      (mirrored onto the legacy Profile.shareLocation boolean).
//   2. Coordinates are bucketed to 3 decimal places (~110m precision)
//      client-side before rendering, so even an opted-in user never
//      reveals a precise apartment.
//   3. This component NEVER asks the OS for location until the caller
//      passes `disclosureAccepted`, which is set only after the user
//      has read the in-app disclosure (components/LocationDisclosure).
//      Google Play requires prominent disclosure plus affirmative
//      consent before collecting location; Apple expects the system
//      prompt to arrive with context. Do not "simplify" this away.
//   4. The map is read-only — tapping a pin opens a preview card that
//      links to the profile. No DM-from-map (that would be a stalker
//      vector before we have proper hide-from-specific-people tooling).
//   5. Demo users from DEMO_ROSTER appear regardless of visibility —
//      they're seed data for testability, not real people whose
//      privacy could leak.

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, FontFamily, Typography } from '../theme';
import { imageSource } from '../utils/imageSource';
import { DEMO_ROSTER } from '../data/__dev__/demoRoster';
import { DEMO_DATA_ENABLED } from '../config/demoData';
import * as discoverService from '../api/services/discoverService';
import LocationDisclosure from './LocationDisclosure';
import Blueprint from './Blueprint';

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

// Haversine — straight-line distance (km) between two coords. Used for
// the "X km away" meta on the selected-pin card. Mirrors the formula
// that the server-side discover function uses.
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

// "Active this week" — matches HomeScreen's list-side definition so the
// chip means the same thing on both surfaces.
const isActiveThisWeek = (person) => {
  if (!person?.lastActiveAt) return false;
  const days = (Date.now() - new Date(person.lastActiveAt).getTime()) / 8.64e7;
  return Number.isFinite(days) && days <= 7;
};

// Demo users are scattered around the caller's location instead of
// pinned to their bio cities. Without this, a tester opening the map
// from Toronto sees an empty viewport because Adau (Minneapolis),
// Abuk (Sydney) and the rest are all hundreds of km away. Each user
// gets a deterministic offset from `center` so the layout is stable
// across re-renders — Adau is always 0.4km north-east of you, Abuk
// is always 0.6km south, etc. — but the absolute position follows
// wherever the tester actually is.
//
// `center === null` (location permission denied) falls back to the
// roster's static city coords so the map at least shows the demo
// users somewhere meaningful.
const demoPeople = (center) => {
  if (!DEMO_DATA_ENABLED) return [];
  return DEMO_ROSTER
    .map((u, i) => {
      if (!center) {
        if (!u.coords) return null;
        return u;
      }
      // Stable per-user spread: even angle distribution (i * 36°) and
      // stepped distance bands so the roster fans out around the
      // tester instead of stacking on one block.
      const angle = (i * 36) % 360;
      const bands = [0.3, 1.5, 6, 18, 45, 80, 140, 240, 400, 700];
      const dist = bands[i % bands.length];
      return { ...u, coords: offsetCoord(center, angle, dist) };
    })
    .filter(Boolean);
};

export default function PeopleMap({
  onPersonPress,
  // Height of the floating chrome HomeScreen draws over the map —
  // overlays rendered here must clear it.
  topInset = 12,
  // Quick filter from HomeScreen's floating chips:
  // 'all' | 'verified' | 'active'.
  quickFilter = 'all',
  // Lets HomeScreen's city pill show "N visible".
  onVisibleCountChange,
  // Location consent gate. Until this is true we render the in-app
  // disclosure and do NOT touch expo-location. See the privacy contract
  // at the top of this file.
  disclosureAccepted = false,
  onDisclosureAccept,
  onDisclosureDecline,
  // Lets the disclosure's "Not now" path hand the user to the list view
  // instead of stranding them on an empty map.
  onBrowseList,
}) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const mapRef = useRef(null);
  const cardAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const [selected, setSelected] = useState(null);
  const [region, setRegion] = useState(null);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState(null);

  // Pull the caller's current location once, but ONLY after the user
  // has accepted the in-app disclosure. If they decline the OS
  // permission, fall back to a centroid of the visible people so the
  // map opens on a populated continent rather than Antarctica.
  useEffect(() => {
    if (!disclosureAccepted) {
      // Nothing to do yet — the disclosure card is what's rendered.
      // Clear the spinner so flipping consent doesn't flash "Loading".
      setLocating(false);
      return undefined;
    }
    let cancelled = false;
    setLocating(true);
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (cancelled) return;
          setLocationError('Enable Location in Settings to center the map on you.');
          // Centroid fallback — average the static city coords.
          const fallback = demoPeople(null);
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
    // Runs on mount and again the moment consent flips to true.
  }, [disclosureAccepted]);

  // The "YOU" dot pulses forever — a slow accent ring expanding out of
  // the dot. Runs on the native driver; cheap.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Resolve the offset center from the current region (caller's
  // device location once Location resolves). When region is still
  // null we feed `null` so the roster falls back to its static city
  // coords.
  const center = region ? { latitude: region.latitude, longitude: region.longitude } : null;

  // Live opted-in users from the discover-nearby Edge Function.
  // Failures (function not deployed, network) silently fall back to an
  // empty list and the DEMO_ROSTER pattern takes over below.
  const [livePeople, setLivePeople] = useState([]);
  useEffect(() => {
    if (!center) return;
    let cancelled = false;
    discoverService.getNearbyUsers({ center }).then(({ users }) => {
      if (cancelled) return;
      setLivePeople(users || []);
    }).catch(() => {
      if (!cancelled) setLivePeople([]);
    });
    return () => { cancelled = true; };
    // center is a fresh object each render so we depend on its
    // primitive parts to avoid useless refetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.latitude, center?.longitude]);

  const allPeople = useMemo(() => {
    // Real users hide the demo roster entirely — same hide-when-real
    // pattern used by Community and Stories. Demo pins ONLY appear
    // when discover-nearby returns zero opted-in users near the
    // caller (early-launch state). The moment one real user opts
    // into shareLocation within range, the demo disappears.
    if (livePeople.length > 0) return livePeople;
    return demoPeople(center);
  },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [center?.latitude, center?.longitude, livePeople],
  );

  // Apply the quick filter from HomeScreen's floating chips.
  //
  // City-only users are dropped here, not server-side. `discover-nearby`
  // returns everyone whose visibility is not 'off' so the list surfaces
  // can show them, but we promised city-only members "no pin on the
  // map" — putting one down anyway would break that promise even
  // though the coordinate is coarse. They still appear in the Home list
  // and the Directory, which is what they consented to.
  const visiblePeople = useMemo(() => allPeople.filter((p) => {
    if (p.locationVisibility === 'city') return false;
    if (!p.coords) return false;
    if (quickFilter === 'verified' && !p.verified) return false;
    if (quickFilter === 'active' && !(p.activity === 'active' || isActiveThisWeek(p))) return false;
    return true;
  }), [allPeople, quickFilter]);

  useEffect(() => {
    onVisibleCountChange?.(visiblePeople.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePeople.length]);

  const openPreview = useCallback((person) => {
    setSelected(person);
    Animated.timing(cardAnim, {
      toValue: 1, duration: 250, useNativeDriver: true,
    }).start();
  }, [cardAnim]);

  const closePreview = useCallback(() => {
    Animated.timing(cardAnim, {
      toValue: 0, duration: 200, useNativeDriver: true,
    }).start(() => setSelected(null));
  }, [cardAnim]);

  const handleViewProfile = useCallback(() => {
    if (selected && onPersonPress) onPersonPress(selected);
    closePreview();
  }, [selected, onPersonPress, closePreview]);

  const recenter = useCallback(() => {
    if (!region || !mapRef.current) return;
    mapRef.current.animateToRegion(region, 400);
  }, [region]);

  // ── Location disclosure gate ──
  // Rendered BEFORE anything that could touch expo-location. Until the
  // user accepts, we have not asked the OS for anything and we do not
  // know where they are. "Not now" hands them to the list view, which
  // needs no location at all.
  if (!disclosureAccepted) {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <LocationDisclosure
          onAccept={() => onDisclosureAccept?.()}
          onDecline={() => {
            onDisclosureDecline?.();
            onBrowseList?.();
          }}
          declineLabel={onBrowseList ? 'Not now — browse the list' : 'Not now'}
        />
      </View>
    );
  }

  // ── Fallback when react-native-maps native module is missing
  // (Expo Go, broken dev client). HomeScreen's floating chrome still
  // renders above this, so keep the explanation clear of it.
  if (!MapView) {
    return (
      <View style={[styles.container, { paddingTop: topInset }]}>
        <View style={styles.fallbackInner}>
          <Ionicons name="map-outline" size={48} color={colors.gray400} />
          <Text style={styles.fallbackTitle}>Map preview unavailable</Text>
          <Text style={styles.fallbackBody}>
            The map needs a native build. Open this view in TestFlight or a custom dev client.
          </Text>
        </View>
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

  const selectedMeta = selected ? (() => {
    const km = center && selected.coords ? distanceKm(center, selected.coords) : null;
    const dist = Number.isFinite(km)
      ? `${km < 10 ? km.toFixed(1) : Math.round(km)} km away`
      : selected.city || null;
    return [dist, selected.profession || selected.ethnicity].filter(Boolean).join(' · ');
  })() : '';

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
        // We draw our own "YOU" marker dead-center; the OS blue dot
        // would double it up.
        showsUserLocation={false}
        showsCompass={false}
        showsScale={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        // Close the card when the user pans away or taps empty map.
        // onPanDrag (not onRegionChange) so the programmatic
        // animateToRegion after recenter doesn't kill the card.
        onPanDrag={() => { if (selected) closePreview(); }}
        onPress={() => { if (selected) closePreview(); }}
      >
        {visiblePeople.map((p) => (
          <Marker
            key={p.id}
            coordinate={p.coords}
            // Rasterized markers (tracksViewChanges=false) are cheap but
            // won't repaint the selection ring, so track only while a
            // selection is in play.
            tracksViewChanges={selected != null}
            onPress={() => openPreview(p)}
          >
            <View
              style={[styles.pin, selected?.id === p.id && styles.pinSelected]}
              testID={`map-pin-${p.id}`}
              accessibilityLabel={p.name}
            >
              <Image source={imageSource(p.photos?.[0])} style={styles.pinPhoto} />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* "YOU" — pulsing accent dot dead-center. The map opens centered
          on the caller's bucketed location, so the screen center IS the
          user until they pan. */}
      {region && !locationError ? (
        <View style={styles.youWrap} pointerEvents="none">
          <Animated.View
            style={[
              styles.youPulse,
              {
                opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                transform: [{
                  scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }),
                }],
              },
            ]}
          />
          <View style={styles.youDot} />
          <Text style={styles.youLabel}>YOU</Text>
        </View>
      ) : null}

      {/* Recenter FAB — bottom-right; lifts above the selected card. */}
      <TouchableOpacity
        style={[styles.recenterBtn, selected && styles.recenterBtnRaised]}
        onPress={recenter}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Recenter map on you"
      >
        <Ionicons name="locate" size={20} color={colors.black} />
      </TouchableOpacity>

      {locationError ? (
        <View style={styles.errorPill}>
          <Text style={styles.errorPillText} numberOfLines={1}>{locationError}</Text>
        </View>
      ) : null}

      {/* Selected-pin card — Blueprint card rising from the bottom. */}
      {selected ? (
        <Animated.View
          style={[
            styles.cardWrap,
            {
              opacity: cardAnim,
              transform: [{
                translateY: cardAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }),
              }],
            },
          ]}
        >
          <Blueprint style={styles.card}>
            <Image source={imageSource(selected.photos?.[0])} style={styles.cardPhoto} />
            <View style={styles.cardBody}>
              <View style={styles.cardNameRow}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {selected.age ? `${selected.name}, ${selected.age}` : selected.name}
                </Text>
                {selected.verified ? (
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={15}
                    color={colors.accentDark}
                    accessibilityLabel="Verified"
                  />
                ) : null}
              </View>
              <Text style={styles.cardMeta} numberOfLines={1}>{selectedMeta}</Text>
            </View>
            <TouchableOpacity
              style={styles.cardCta}
              onPress={handleViewProfile}
              activeOpacity={0.85}
              hitSlop={{ top: 6, bottom: 6 }}
              accessibilityRole="button"
              accessibilityLabel={`View ${selected.name}'s profile`}
              testID="map-card-view"
            >
              <Text style={styles.cardCtaText}>View</Text>
            </TouchableOpacity>
          </Blueprint>
        </Animated.View>
      ) : null}
    </View>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.creamDark },
  loading: {
    flex: 1,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.creamDark,
    gap: 8,
  },
  loadingText: {
    ...Typography.caption,
    color: colors.gray500,
  },

  // ─── Pins — square 46px photo tiles ───
  pin: {
    width: 46,
    height: 46,
    borderRadius: 0,
    borderWidth: 2,
    borderColor: colors.cream,
    backgroundColor: colors.cream,
    shadowColor: '#000',
    shadowOpacity: isDark ? 0.4 : 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  pinSelected: {
    borderColor: colors.ssGold,
  },
  pinPhoto: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.gray300,
  },

  // ─── "YOU" — pulsing dot dead-center ───
  youWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  youPulse: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.ssGold,
  },
  youDot: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: colors.ssGold,
    borderWidth: 3,
    borderColor: colors.cream,
  },
  youLabel: {
    fontFamily: FontFamily.headingBold,
    fontSize: 10.5,
    letterSpacing: 1.5,
    color: colors.ssGoldDark,
    marginTop: 4,
  },

  recenterBtn: {
    position: 'absolute',
    bottom: 24, right: 16,
    width: 44, height: 44,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    backgroundColor: colors.cream,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  recenterBtnRaised: {
    bottom: 116,
  },
  errorPill: {
    position: 'absolute',
    bottom: 96, alignSelf: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 4,
    backgroundColor: colors.overlay,
  },
  errorPillText: {
    color: colors.cream, fontSize: 12, fontFamily: FontFamily.medium,
  },

  // ─── Selected-pin card ───
  cardWrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: colors.cream,
    shadowColor: '#000',
    shadowOpacity: isDark ? 0.5 : 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  cardPhoto: {
    width: 58,
    height: 58,
    borderRadius: 0,
    backgroundColor: colors.gray300,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardName: {
    fontFamily: FontFamily.heading,
    fontSize: 19,
    color: colors.black,
    flexShrink: 1,
  },
  cardMeta: {
    fontFamily: FontFamily.regular,
    fontSize: 12.5,
    color: colors.gray600,
    marginTop: 2,
  },
  cardCta: {
    height: 38,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  cardCtaText: {
    fontFamily: FontFamily.semibold,
    fontSize: 13.5,
    color: colors.cream,
  },

  // ─── Native-module fallback ───
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
