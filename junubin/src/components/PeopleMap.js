// PeopleMap — the map surface of the Home tab: South Sudanese people
// near you who chose to be visible.
//
// Industry redesign: the map renders FULL-BLEED under HomeScreen's
// floating chrome (city pill, Map|List segments, quick chips). This
// component draws neither the chrome nor the data — HomeScreen owns
// both. In the design the pins and the list rows are the SAME filtered
// set, so the people, the device center and the map region all arrive
// as props from `hooks/useNearbyPeople`. Pins are square photo tiles
// ringed cream (flag gold when selected); the current user is a pulsing
// gold dot dead-center; the tapped pin's preview is a Blueprint card
// that rises from the bottom.
//
// Privacy contract (must stay in sync with 00032_share_location_optin.sql,
// 00047_social_pivot.sql and hooks/useNearbyPeople.js):
//   1. Users are visible on the map only if they set
//      Profile.locationVisibility to something other than 'off'
//      (enforced server-side by the discover-nearby function).
//   2. Coordinates are bucketed to 3 decimal places (~110m precision)
//      before they reach this component, so even an opted-in user never
//      reveals a precise apartment.
//   3. NOTHING in the Nearby tab asks the OS for location until the
//      user has read and accepted the in-app disclosure. This component
//      renders that disclosure and refuses to render anything else
//      until `disclosureAccepted` is true; the hook that would call
//      expo-location stays disabled until then. Google Play requires
//      prominent disclosure plus affirmative consent before collecting
//      location; Apple expects the system prompt to arrive with
//      context. Do not "simplify" this away.
//   4. The map is read-only — tapping a pin opens a preview card that
//      links to the profile. No DM-from-map (that would be a stalker
//      vector before we have proper hide-from-specific-people tooling).
//   5. City-only members get NO PIN, even though they are in the shared
//      set and do appear in the list. That is exactly what they
//      consented to.

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
import { Ionicons } from '@expo/vector-icons';
import { useTheme, FontFamily, Typography } from '../theme';
import { imageSource } from '../utils/imageSource';
import { nearbyCardMeta } from '../hooks/useNearbyPeople';
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

export default function PeopleMap({
  // The shared Nearby set, already quick-filtered by HomeScreen so the
  // map and the list can never disagree about what a chip means.
  people = [],
  // Map viewport and the device center, both from useNearbyPeople.
  region = null,
  loading = false,
  locationError = null,
  onPersonPress,
  // Height of the floating chrome HomeScreen draws over the map —
  // overlays rendered here must clear it.
  topInset = 12,
  // Lets HomeScreen's city pill show "N visible" for map mode.
  onVisibleCountChange,
  // Location consent gate. Until this is true we render the in-app
  // disclosure. See the privacy contract at the top of this file.
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
  const [selectedId, setSelectedId] = useState(null);

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

  // Pin-eligible subset. City-only members and anyone without coords
  // are dropped HERE, not from the shared set — they still belong in
  // the list, which is what they opted into (rule 5 above).
  const pinned = useMemo(
    () => people.filter((p) => p.coords && p.locationVisibility !== 'city'),
    [people],
  );

  useEffect(() => {
    onVisibleCountChange?.(pinned.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinned.length]);

  // Design's `hasMapCard`: the card shows only while the selected
  // person is still in the filtered set. Changing a quick chip out from
  // under the selection closes the card rather than leaving a stale one.
  const selected = useMemo(
    () => pinned.find((p) => p.id === selectedId) || null,
    [pinned, selectedId],
  );
  useEffect(() => {
    if (selectedId && !selected) {
      cardAnim.setValue(0);
      setSelectedId(null);
    }
  }, [selectedId, selected, cardAnim]);

  const openPreview = useCallback((person) => {
    setSelectedId(person.id);
    Animated.timing(cardAnim, {
      toValue: 1, duration: 250, useNativeDriver: true,
    }).start();
  }, [cardAnim]);

  const closePreview = useCallback(() => {
    Animated.timing(cardAnim, {
      toValue: 0, duration: 200, useNativeDriver: true,
    }).start(() => setSelectedId(null));
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

  if (loading && !region) {
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
        {pinned.map((p) => (
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
              <Image
                source={imageSource(p.photos?.[0] || p.images?.[0])}
                style={styles.pinPhoto}
              />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* "YOU" — pulsing gold dot dead-center with the label hung
          beneath it (design: dot at the exact center, label translated
          16px down). The map opens centered on the caller's bucketed
          location, so the screen center IS the user until they pan. */}
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
            <Image
              source={imageSource(selected.photos?.[0] || selected.images?.[0])}
              style={styles.cardPhoto}
            />
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
              <Text style={styles.cardMeta} numberOfLines={1}>
                {nearbyCardMeta(selected)}
              </Text>
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
  // Hung off the exact center so the dot itself stays on it — design
  // translates the label 16px below the center point.
  youLabel: {
    position: 'absolute',
    marginTop: 32,
    fontFamily: FontFamily.headingBold,
    fontSize: 10.5,
    letterSpacing: 1.5,
    color: colors.ssGoldDark,
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
    color: colors.gray500,
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
