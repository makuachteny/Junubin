// Location disclosure gate.
//
// Google Play requires prominent in-app disclosure and affirmative
// consent before collecting location; Apple's review guidance says the
// OS permission dialog must never be the first thing a user sees on the
// subject. So: nothing in this app may call
// `Location.requestForegroundPermissionsAsync()` until
// `getLocationDisclosureAccepted()` returns true.
//
// This flag records only that the user read and accepted the in-app
// explanation. It is NOT the same as the OS permission (which the user
// can still deny) and NOT the same as `Profile.locationVisibility`
// (which controls whether OTHER people can see them). Three separate
// concepts, deliberately:
//
//   disclosure accepted  → we are allowed to ask the OS
//   OS permission        → we can read this device's location
//   locationVisibility   → other users can see this person's location
//
// Declining is not sticky — we record the decline so the map can show
// the browse-only state, but the user can accept later from the same
// card or from Settings.

import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCEPTED_KEY = '@junubin/location_disclosure_accepted_v1';

export async function getLocationDisclosureAccepted() {
  try {
    return (await AsyncStorage.getItem(ACCEPTED_KEY)) === 'true';
  } catch {
    // Storage failure means we cannot prove consent — treat as not
    // accepted so we never ask the OS without a disclosure.
    return false;
  }
}

export async function setLocationDisclosureAccepted(accepted = true) {
  try {
    await AsyncStorage.setItem(ACCEPTED_KEY, accepted ? 'true' : 'false');
  } catch {
    // Best-effort. The card re-shows next launch if this fails.
  }
}

// Location visibility modes stored on `Profile.locationVisibility`
// (00047_social_pivot.sql). Kept here so the map, Settings, onboarding
// and the profile editor all speak the same vocabulary.
export const LOCATION_VISIBILITY = Object.freeze({
  OFF: 'off',
  CITY: 'city',
  COARSE: 'coarse',
});

export const LOCATION_VISIBILITY_OPTIONS = Object.freeze([
  {
    value: LOCATION_VISIBILITY.OFF,
    label: 'Hidden',
    description: 'You do not appear to anyone. You can still browse the map and directory.',
    icon: 'eye-off-outline',
  },
  {
    value: LOCATION_VISIBILITY.CITY,
    label: 'City only',
    description: 'People can see the city you are in. No pin on the map.',
    icon: 'business-outline',
  },
  {
    value: LOCATION_VISIBILITY.COARSE,
    label: 'Approximate area',
    description: 'You appear on the map at an approximate spot (about 1 km), never your exact address.',
    icon: 'map-outline',
  },
]);

export function locationVisibilityLabel(value) {
  const found = LOCATION_VISIBILITY_OPTIONS.find((o) => o.value === value);
  return found ? found.label : 'Hidden';
}
