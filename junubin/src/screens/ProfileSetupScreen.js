import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FontFamily } from '../theme';
import { useAuth } from '../auth';
import { validateName } from '../utils/validators';
import * as profileService from '../api/services/profileService';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LogoMark from '../components/LogoMark';
import Blueprint from '../components/Blueprint';
import BirthdaySelects from '../components/BirthdaySelects';
import { ALL_TRIBE_KEYS } from '../data/tribes';
import { normalizeLocationVisibility } from '../data/profileOptions';
import { OPEN_TO_OPTIONS, normalizeOpenTo, openToLabels } from '../data/openTo';
import { LANGUAGE_OPTIONS, normalizeLanguages } from '../data/languages';
import { promptToOpenSettings } from '../utils/permissionAlert';
import { getProfileRecord } from '../utils/eligibility';

// ─── Step Definitions ───
// The Industry redesign collapses onboarding to 5 grouped steps
// (claude.ai/design "JuNubin Redesign" mock). Everything the old
// 16-step flow asked beyond these — pronouns, country, education,
// profession, interests, prompts, extra photos, the verify selfie —
// moved to EditProfile, surfaced by the Profile tab's strength
// checklist. `photo` is LAST and must stay last: it carries the
// locationVisibility privacy consent, and the user should have seen
// what the app is for before deciding whether to appear on the map.
const STEPS = [
  { key: 'name',       title: 'What should we call you?',   subtitle: 'Just the basics — this is how you appear on JuNubin.',           cta: 'CONTINUE',      skippable: false },
  { key: 'openTo',     title: 'What are you open to?',      subtitle: 'Pick everything that fits. This is how people find their people.', cta: 'CONTINUE',   skippable: false },
  { key: 'city',       title: 'Which city are you in?',     subtitle: 'It helps people nearby find you. City only — no exact address.', cta: 'CONTINUE',      skippable: true },
  { key: 'background', title: 'Your background & languages', subtitle: 'Optional — helps the diaspora find kin. Skip freely.',         cta: 'CONTINUE',      skippable: true },
  { key: 'photo',      title: 'Photo & visibility',         subtitle: 'Last step. You control exactly who sees where you are.',         cta: 'ENTER JUNUBIN', skippable: false },
];

// Suggested-city chips on the city step (from the design mock). The
// input stays free text — there is no canonical list that covers Juba,
// Kakuma, Omaha and Melbourne equally well.
const SUGGESTED_CITIES = ['Nairobi', 'Kampala', 'Juba', 'Cairo', 'Melbourne', 'Omaha'];

// One flag color per step — fills the progress segment for that step
// and the 8px kicker square (design's obSegs / obStepColor arrays).
// Resolved through the theme at render so dark mode gets its variants.
const STEP_COLOR_KEYS = ['ssBlue', 'ssGreen', 'ssGold', 'ssRed', 'ssBlue'];

// The design's "WHO CAN SEE WHERE YOU ARE?" radio cards, mapped onto
// the real Profile.locationVisibility values ('off' | 'city' |
// 'coarse'). Ordered most-visible first like the mock; the DEFAULT is
// still 'off' — order here is presentation only, never a default.
const VISIBILITY_OPTIONS = [
  { value: 'coarse', label: 'Everyone on JuNubin', sub: 'Your approximate area shows on the Nearby map — never your exact address.' },
  { value: 'city',   label: 'City only',           sub: 'People see your city, never a map pin.' },
  { value: 'off',    label: 'Nobody',              sub: 'You browse the map; you never appear on it.' },
];

// Every profile still carries accountPurpose: 'socialize'. The value is
// no longer a user choice — profile-completeness checks, AppNavigator's
// deep-link routing and AuthContext's mode resolution all still branch
// on it, so the flow keeps writing it rather than orphaning those call
// sites. What the user actually picks lands in Profile.openTo.
const ACCOUNT_PURPOSE = 'socialize';

// Profile.lookingFor predates the pivot; new signups get a neutral
// value derived from their first openTo pick.
const openToPrimaryLabel = (keys) => openToLabels(keys)[0] || 'Community';

// Map eligibility step ids (and legacy step keys) → the 5 grouped
// steps. Used when a deep link (junubin://survey?step=<id>) or an
// in-app `resumeAt` opens this screen: we seek to the nearest
// surviving step.
// Ids for fields that are no longer collected in onboarding resolve to
// the closest sensible step — profile-detail ids (interests, prompts,
// education…) land on the final step so the user can finish and then
// polish via EditProfile; dating-era ids land on openTo.
const RESUME_KEY_BY_ELIGIBILITY_ID = {
  // step 1 — name + birthday
  displayName:      'name',
  dob:              'name',
  birthday:         'name',
  gender:           'name',
  // step 2 — open to
  purpose:          'openTo',
  openTo:           'openTo',
  // step 3 — city (country is no longer asked; city is the nearest)
  country:          'city',
  countryCode:      'city',
  city:             'city',
  // step 4 — background & languages
  ethnicity:        'background',
  languages:        'background',
  // step 5 — photo & visibility
  photos:           'photo',
  photo:            'photo',
  verify:           'photo',
  locationVisibility: 'photo',
  // ── moved to EditProfile — land on the last step so the user can
  //    complete onboarding, then polish from the strength checklist ──
  pronouns:         'photo',
  education:        'photo',
  profession:       'photo',
  interests:        'photo',
  prompts:          'photo',
  bio:              'photo',
  survey:           'photo',
  // ── legacy dating-era ids ──
  interestedIn:     'openTo',
  datingIntentions: 'openTo',
  sexuality:        'openTo',
  datePref:         'openTo',
  intention:        'openTo',
  children:         'openTo',
};

const ProfileSetupScreen = ({ navigation, route }) => {
  // `resumeAt` comes from in-app navigation; `step` is the
  // junubin://survey?step=<id> deep-link param (App.js linking config
  // parses it as `step`). Both feed the same seek.
  const resumeAtParam = route?.params?.resumeAt || route?.params?.step || null;

  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Seek to the requested step when ProfileSetup is opened with a
  // resume target (in-app or deep link). Tracked via a ref so the seek
  // only fires once per (resumeAtParam, mount) — once the user manually
  // advances or goes back, we never bounce them back here.
  const didSeekResumeRef = useRef(false);
  useEffect(() => {
    if (!resumeAtParam || didSeekResumeRef.current) return;
    const targetKey = RESUME_KEY_BY_ELIGIBILITY_ID[resumeAtParam] || resumeAtParam;
    const idx = STEPS.findIndex((s) => s.key === targetKey);
    if (idx < 0) return;
    if (idx !== currentStep) {
      setCurrentStep(idx);
      didSeekResumeRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeAtParam]);

  const savingFade = useRef(new Animated.Value(0)).current;
  const savingPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!saving) { savingFade.setValue(0); return; }
    Animated.timing(savingFade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(savingPulse, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(savingPulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [saving, savingFade, savingPulse]);

  const insets = useSafeAreaInsets();
  const { session, user: authUser, updateUser } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  // ─── Form state — only what the 5 steps collect ───
  const [firstName, setFirstName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  // City = free text on User.city.
  const [city, setCity] = useState('');
  // openTo → Profile.openTo (array of keys from src/data/openTo.js).
  const [selectedOpenTo, setSelectedOpenTo] = useState([]);
  // ethnicity → Profile.ethnicity (single tribe key).
  const [selectedEthnicity, setSelectedEthnicity] = useState('');
  // languages → Profile.languages (array of labels).
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  // locationVisibility → Profile.locationVisibility. 'off' by default,
  // for everyone, always. Nothing on this screen may change that
  // without an explicit tap.
  const [locationVisibility, setLocationVisibility] = useState('off');
  // Photos grid persists as 6 cells (matches the Photo rows / upload
  // flow); onboarding surfaces only cell 0 as the single square tile.
  const [photos, setPhotos] = useState(Array(6).fill(null));

  // Hydrate form fields from the existing User/Profile row so a
  // returning user lands with their prior answers already filled in.
  // Runs once per authUser.id so user-typed edits aren't clobbered if
  // AuthContext refetches the row in the background. Fields the flow
  // no longer collects (pronouns, country, education, interests,
  // prompts…) are neither hydrated nor written — updateProfile is a
  // partial patch, so existing values on the server stay untouched.
  const hydratedForUserRef = useRef(null);
  useEffect(() => {
    if (!authUser?.id) return;
    if (hydratedForUserRef.current === authUser.id) return;
    hydratedForUserRef.current = authUser.id;

    const profile = getProfileRecord(authUser) || {};

    if (authUser.displayName) setFirstName(authUser.displayName);

    if (authUser.dateOfBirth) {
      const d = new Date(authUser.dateOfBirth);
      if (!Number.isNaN(d.getTime())) {
        const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(d.getUTCDate()).padStart(2, '0');
        const yyyy = String(d.getUTCFullYear());
        setBirthDate(`${mm}/${dd}/${yyyy}`);
      }
    }

    if (typeof authUser.city === 'string' && authUser.city.trim()) setCity(authUser.city);
    if (profile.ethnicity) setSelectedEthnicity(profile.ethnicity);

    // The pivot columns may not exist yet on an un-migrated backend —
    // the normalizers collapse anything unexpected to the safe default
    // ([] / [] / 'off') rather than letting a null reach the render
    // path.
    const hydratedOpenTo = normalizeOpenTo(profile.openTo);
    if (hydratedOpenTo.length) setSelectedOpenTo(hydratedOpenTo);
    const hydratedLanguages = normalizeLanguages(profile.languages);
    if (hydratedLanguages.length) setSelectedLanguages(hydratedLanguages);
    setLocationVisibility(normalizeLocationVisibility(profile.locationVisibility));

    // Pre-fill the photo tile from already-uploaded Photo rows. The
    // hydrated cells hold http(s) URLs pointing at Supabase Storage
    // and are skipped on save, so no duplicate uploads.
    const uploaded = Array.isArray(authUser.photos)
      ? authUser.photos
          .slice()
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
          .map((p) => p?.url)
          .filter(Boolean)
      : [];
    if (uploaded.length) {
      setPhotos((prev) => {
        const next = [...prev];
        for (let i = 0; i < Math.min(uploaded.length, next.length); i++) {
          next[i] = uploaded[i];
        }
        return next;
      });
    }
  }, [authUser]);

  const totalSteps = STEPS.length;
  const step = STEPS[currentStep];

  const saveProfileToApi = async () => {
    if (!session) {
      Alert.alert('Sign in required', 'Please sign in before completing your profile.');
      return;
    }
    // Final validation before save. Mirrors validateStep() for every
    // required field so a user cannot land in the app with an
    // incomplete profile via deep-link resume, race condition, or a
    // future bug that bypasses per-step gating. Only the fields the
    // 5-step flow actually requires are checked — everything else is
    // optional-skippable, and requiring a field the Skip button lets
    // the user bypass produces an "incomplete profile" alert with no
    // way to satisfy it.
    const trimmedName = firstName.trim();
    const missing = [];

    if (!trimmedName || trimmedName.length < 2) missing.push('first name (at least 2 characters)');
    if (!selectedOpenTo || selectedOpenTo.length === 0) missing.push('at least one thing you\'re open to');

    // Birthday — full MM/DD/YYYY + 18+ age check (mirrors validateStep)
    let birthdayValid = false;
    if (birthDate.length === 10) {
      const [mm, dd, yyyy] = birthDate.split('/').map(Number);
      if (mm >= 1 && mm <= 12) {
        const daysInMonth = new Date(yyyy, mm, 0).getDate();
        if (dd >= 1 && dd <= daysInMonth && yyyy >= 1900 && yyyy <= new Date().getFullYear()) {
          const dob = new Date(yyyy, mm - 1, dd);
          const today = new Date();
          let age = today.getFullYear() - dob.getFullYear();
          const monthDiff = today.getMonth() - dob.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
          if (age >= 18 && age <= 120) birthdayValid = true;
        }
      }
    }
    if (!birthdayValid) missing.push('date of birth (must be 18+)');

    if (photos.filter(Boolean).length < 1) missing.push('a profile photo');

    if (missing.length > 0) {
      Alert.alert(
        'Profile not ready',
        `Please complete these required fields:\n\n• ${missing.join('\n• ')}`,
      );
      return;
    }
    setSaving(true);
    try {
      // Parse birthDate MM/DD/YYYY → ISO
      let dateOfBirth;
      if (birthDate.length === 10) {
        const [mm, dd, yyyy] = birthDate.split('/');
        dateOfBirth = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`).toISOString();
      }

      const updates = {
        displayName: firstName.trim(),
        ...(dateOfBirth ? { dateOfBirth } : {}),
        city: city.trim(),
        // ethnicity only when picked — never overwrite an existing
        // value with an empty string on a resumed run.
        ...(selectedEthnicity ? { ethnicity: selectedEthnicity } : {}),
        languages: selectedLanguages,
        openTo: selectedOpenTo,
        // Privacy: whatever the user picked on the final consent step,
        // defaulting to 'off'. Never inferred, never defaulted to a
        // more-visible value.
        locationVisibility,
        // Neutral, community-flavoured "here for" derived from the
        // first openTo pick.
        lookingFor: openToPrimaryLabel(selectedOpenTo),
        accountPurpose: ACCOUNT_PURPOSE,
        profileComplete: true,
        // Mark the survey as complete here — the flow this user just
        // finished IS the survey; nothing else asks these questions.
        surveyCompletedAt: new Date().toISOString(),
        // EULA acceptance was checked on the SignupScreen before the
        // user reached this point. Stamp it on the Profile now that we
        // have a row to write to.
        eulaAcceptedAt: new Date().toISOString(),
        eulaVersion: '2026-05-06',
      };

      // Upload photos FIRST — confirm the user actually has a photo in
      // Supabase before we stamp surveyCompletedAt and let them in.
      // Skip cells that already hold an http(s) URL — those were
      // hydrated from existing Photo rows and are already stored.
      const isRemoteUrl = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);
      const photoUris = photos.filter((u) => u && !isRemoteUrl(u));
      const photoFailures = [];
      for (const uri of photoUris) {
        try {
          await profileService.uploadPhoto(uri);
        } catch (e) {
          photoFailures.push(e?.message || String(e));
          if (__DEV__) console.warn('Photo upload failed:', e?.message, e?.cause);
        }
      }

      // Enforce the 1-photo floor on the server-side count: already-
      // remote photos + freshly uploaded ones that succeeded. Under 1,
      // bail without stamping surveyCompletedAt — the user's form
      // state stays intact so they can retry from this screen.
      const remoteCount = photos.filter((u) => u && isRemoteUrl(u)).length;
      const successfulNewCount = photoUris.length - photoFailures.length;
      if (remoteCount + successfulNewCount < 1) {
        Alert.alert(
          'Photo required',
          `You need at least one photo. ${photoFailures.length > 0 ? 'The upload failed — please try again.' : ''}`,
        );
        return; // do NOT stamp surveyCompletedAt
      }

      const user = await profileService.updateProfile(updates);
      updateUser(user);

      // Keep the local mode fallback in step with the persisted
      // accountPurpose. Best-effort — a storage failure must not undo
      // a saved profile.
      try {
        await AsyncStorage.setItem('@junubin_mode', 'Social');
        await AsyncStorage.setItem('@junubin_purpose', ACCOUNT_PURPOSE);
      } catch (e) {
        if (__DEV__) console.warn('[ProfileSetup] mode cache write failed:', e?.message);
      }

      if (photoFailures.length > 0) {
        Alert.alert(
          'Some photos didn\'t upload',
          `${photoFailures.length} photo upload(s) failed. Your profile was saved — you can re-add photos from Edit Profile.\n\nFirst error: ${photoFailures[0]}`,
        );
      }

      // ProfileSetup completion → straight to Main. surveyCompletedAt
      // was set above, so the eligibility gate is satisfied.
      const routeNames = navigation.getState?.()?.routeNames || [];
      if (routeNames.includes('Main')) {
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      }
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleNext = (skip = false) => {
    if (!skip) {
      const error = validateStep();
      if (error) {
        setFieldError(error);
        return;
      }
    }
    setFieldError(null);
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      saveProfileToApi();
    }
  };

  // On step 0 there may be nothing to go back to — for a fresh signup
  // this screen is MainNavigator's initial route, so the chevron only
  // renders when goBack can actually do something.
  const canLeaveBack = navigation?.canGoBack?.() ?? false;
  const showBackButton = currentStep > 0 || canLeaveBack;
  const handleBack = () => {
    setFieldError(null);
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else if (canLeaveBack) {
      navigation.goBack();
    }
  };

  const handleNameChange = (text) => {
    // Strip anything that isn't a Unicode letter / combining mark /
    // space / hyphen / apostrophe, so diacritics and Dinka/Nuer letters
    // survive as the user types.
    const clean = text.replace(/[^\p{L}\p{M}\s'-]/gu, '').slice(0, 30);
    setFirstName(clean);
  };

  const toggleOpenTo = (key) => {
    setSelectedOpenTo((prev) => (
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    ));
  };

  const toggleLanguage = (lang) => {
    setSelectedLanguages((prev) => (
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    ));
  };

  const handlePhotoTap = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      promptToOpenSettings({
        title: 'Photo access needed',
        message: 'JuNubin needs photo access to add profile photos. Enable it in Settings.',
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setPhotos((prev) => {
        const updated = [...prev];
        updated[0] = result.assets[0].uri;
        return updated;
      });
    }
  };

  // Returns null if valid, or an error message string if invalid
  const validateStep = () => {
    switch (step.key) {
      case 'name': {
        const nameError = validateName(firstName);
        if (nameError) return nameError;
        if (birthDate.length < 10) return 'Please enter your full date of birth.';
        const [mm, dd, yyyy] = birthDate.split('/').map(Number);
        if (mm < 1 || mm > 12) return 'Invalid month. Please enter a value between 01 and 12.';
        const daysInMonth = new Date(yyyy, mm, 0).getDate();
        if (dd < 1 || dd > daysInMonth) return `Invalid day. ${mm}/${yyyy} only has ${daysInMonth} days.`;
        if (yyyy < 1900 || yyyy > new Date().getFullYear()) return 'Please enter a valid year.';
        const dob = new Date(yyyy, mm - 1, dd);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
        if (age < 18) return 'You must be at least 18 years old to use JuNubin.';
        if (age > 120) return 'Please enter a valid date of birth.';
        return null;
      }
      case 'openTo':
        return selectedOpenTo.length > 0 ? null : 'Pick at least one thing you\'re open to.';
      // Optional steps — Skip bypasses them, and Continue saves as-is.
      case 'city':
      case 'background':
        return null;
      case 'photo':
        // The photo is required; locationVisibility is always valid —
        // 'off' is a legitimate (and the default) answer. Requiring a
        // visibility choice would turn a privacy decision into a toll
        // gate on finishing signup.
        if (photos.filter(Boolean).length < 1) return 'Please add one clear photo of your face.';
        return null;
      default:
        return null;
    }
  };

  const [fieldError, setFieldError] = useState(null);

  // Clear error whenever the user changes input for the current step
  const stepInputKey = step.key === 'name' ? `${firstName}|${birthDate}`
    : step.key === 'openTo' ? selectedOpenTo.length
    : step.key === 'city' ? city
    : step.key === 'background' ? `${selectedEthnicity}|${selectedLanguages.length}`
    : step.key === 'photo' ? `${photos.filter(Boolean).length}|${locationVisibility}`
    : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (fieldError) setFieldError(null); }, [stepInputKey]);

  const canSkip = step.skippable;

  // ─── Shared chip renderer (Industry chip spec) ───
  // The mock scales chip text with chip height: 44px chips → 14.5,
  // 40px chips → 14, 38px city chips → 13.5.
  const renderChip = ({ key, label, selected, onPress, testID, role = 'checkbox', height = 40, fontSize = 14 }) => (
    <TouchableOpacity
      key={key}
      testID={testID}
      style={[styles.chip, { height }, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole={role}
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      // Chips below 44pt tall (38/40 per the mock) get hitSlop so the
      // effective touch target still clears the 44pt accessibility floor.
      hitSlop={{ top: Math.max(0, Math.ceil((44 - height) / 2)), bottom: Math.max(0, Math.ceil((44 - height) / 2)) }}
    >
      <Text style={[styles.chipText, { fontSize }, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );

  // ─── Step Content ───
  const renderStepContent = () => {
    switch (step.key) {
      case 'name':
        return (
          <View style={styles.stepContent}>
            <View>
              <Text style={styles.fieldLabel}>FIRST NAME</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Your first name"
                placeholderTextColor={colors.gray400}
                value={firstName}
                onChangeText={handleNameChange}
                maxLength={30}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                accessibilityLabel="First name"
              />
            </View>
            <View style={{ marginTop: 18 }}>
              <Text style={styles.fieldLabel}>
                BIRTHDAY <Text style={styles.fieldLabelHint}>— only your age is shown</Text>
              </Text>
              <BirthdaySelects
                testID="setup-dob"
                value={birthDate}
                onChange={(payload) => setBirthDate(payload.mmddyyyy)}
              />
            </View>
          </View>
        );

      case 'openTo':
        return (
          <View style={styles.stepContent}>
            <View style={styles.chipGrid}>
              {OPEN_TO_OPTIONS.map((opt) => renderChip({
                key: opt.key,
                label: opt.label,
                selected: selectedOpenTo.includes(opt.key),
                onPress: () => toggleOpenTo(opt.key),
                testID: `open-to-${opt.key}`,
                height: 44,
                fontSize: 14.5,
              }))}
            </View>
          </View>
        );

      case 'city':
        return (
          <View style={styles.stepContent}>
            <View>
              <Text style={styles.fieldLabel}>CITY</Text>
              <TextInput
                style={styles.textInput}
                testID="setup-city"
                placeholder="Search any city"
                placeholderTextColor={colors.gray400}
                value={city}
                onChangeText={(t) => setCity(t.slice(0, 60))}
                maxLength={60}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
                accessibilityLabel="City"
              />
              <View style={[styles.chipGrid, { marginTop: 10 }]}>
                {SUGGESTED_CITIES.map((c) => renderChip({
                  key: c,
                  label: c,
                  selected: city === c,
                  onPress: () => setCity(c),
                  testID: `setup-city-${c}`,
                  role: 'radio',
                  height: 38,
                  fontSize: 13.5,
                }))}
              </View>
            </View>
            <View style={styles.footnoteRule}>
              <Text style={styles.footnoteText}>
                City only — never your exact address. You choose who sees it in
                the last step.
              </Text>
            </View>
          </View>
        );

      case 'background':
        return (
          <View style={styles.stepContent}>
            <View>
              <Text style={styles.fieldLabel}>BACKGROUND</Text>
              <View style={styles.chipGrid}>
                {ALL_TRIBE_KEYS.map((tribe) => renderChip({
                  key: tribe,
                  label: tribe,
                  // Profile.ethnicity is a single value — chips behave
                  // as a radio group; tapping the selection clears it.
                  selected: selectedEthnicity === tribe,
                  onPress: () => setSelectedEthnicity((prev) => (prev === tribe ? '' : tribe)),
                  testID: `tribe-${tribe}`,
                  role: 'radio',
                }))}
              </View>
            </View>
            <View style={{ marginTop: 20 }}>
              <Text style={styles.fieldLabel}>LANGUAGES</Text>
              <View style={styles.chipGrid}>
                {LANGUAGE_OPTIONS.map((lang) => renderChip({
                  key: lang,
                  label: lang,
                  selected: selectedLanguages.includes(lang),
                  onPress: () => toggleLanguage(lang),
                  testID: `language-${lang}`,
                }))}
              </View>
            </View>
          </View>
        );

      case 'photo':
        return (
          <View style={styles.stepContent}>
            <View style={styles.photoRow}>
              <Blueprint style={styles.photoTileFrame}>
                <TouchableOpacity
                  testID="setup-photo-tile"
                  style={styles.photoTile}
                  onPress={handlePhotoTap}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={photos[0] ? 'Change your photo' : 'Add photo'}
                >
                  {photos[0] ? (
                    <Image source={{ uri: photos[0] }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  ) : (
                    <View style={styles.photoTileEmpty}>
                      <Ionicons name="camera-outline" size={22} color={colors.gray500} />
                      <Text style={styles.photoTileHint}>Add photo</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Blueprint>
              <Text style={styles.photoCaption}>
                One clear photo of your face. Add more later — profiles with
                photos get 4× more follows.
              </Text>
            </View>

            <Text style={[styles.fieldLabel, { marginTop: 20, marginBottom: 8 }]}>
              WHO CAN SEE WHERE YOU ARE?
            </Text>
            <View style={{ gap: 8 }}>
              {VISIBILITY_OPTIONS.map((opt) => {
                const isActive = locationVisibility === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    testID={`location-visibility-${opt.value}`}
                    style={[styles.visCard, isActive && styles.visCardActive]}
                    onPress={() => setLocationVisibility(opt.value)}
                    activeOpacity={0.8}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isActive }}
                    accessibilityLabel={`${opt.label}. ${opt.sub}`}
                  >
                    <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
                      {isActive && <View style={styles.radioInner} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.visLabel}>{opt.label}</Text>
                      <Text style={styles.visSub}>{opt.sub}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <>
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + 12 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
          {/* ── Chrome: back + segment progress + skip ── */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Back"
              disabled={!showBackButton}
            >
              {showBackButton && (
                <Ionicons name="chevron-back" size={22} color={colors.black} />
              )}
            </TouchableOpacity>

            <View style={styles.progressTrack}>
              {STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressSeg,
                    // Filled segments each keep their OWN step color
                    // (blue, green, gold, red, blue) — the design's
                    // flag-stripe progress, not a single accent fill.
                    { backgroundColor: i <= currentStep ? colors[STEP_COLOR_KEYS[i]] : colors.separator },
                  ]}
                />
              ))}
            </View>

            {canSkip ? (
              <TouchableOpacity
                onPress={() => handleNext(true)}
                style={styles.skipBtn}
                accessibilityRole="button"
                accessibilityLabel="Skip this step"
              >
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.skipBtn} />
            )}
          </View>

          {/* ── Kicker + title + sub ── */}
          <View style={styles.titleSection}>
            <View style={styles.kickerRow}>
              <View style={[styles.kickerSquare, { backgroundColor: colors[STEP_COLOR_KEYS[currentStep]] }]} />
              <Text style={styles.kicker}>STEP {currentStep + 1} OF {totalSteps}</Text>
            </View>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepSubtitle}>{step.subtitle}</Text>
          </View>

          {/* ── Content ── */}
          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContentInner}
          >
            {renderStepContent()}
          </ScrollView>

          {/* ── Error ── */}
          {fieldError && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errorText}>{fieldError}</Text>
            </View>
          )}

          {/* ── CTA ── */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <Blueprint>
              <TouchableOpacity
                style={styles.ctaBtn}
                onPress={() => handleNext()}
                disabled={saving}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={step.cta === 'ENTER JUNUBIN' ? 'Enter JuNubin' : 'Continue'}
              >
                {saving ? (
                  <ActivityIndicator color={colors.cream} />
                ) : (
                  <Text style={styles.ctaText}>{step.cta}</Text>
                )}
              </TouchableOpacity>
            </Blueprint>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
    {saving && (
      <Animated.View style={[styles.savingOverlay, { opacity: savingFade }]}>
        <Animated.View style={{ transform: [{ scale: savingPulse }] }}>
          <LogoMark size={80} light />
        </Animated.View>
        <Text style={styles.savingText}>Creating your profile...</Text>
        <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" style={{ marginTop: 16 }} />
      </Animated.View>
    )}
    </>
  );
};

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },

  // ─── Chrome ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 44,
    paddingHorizontal: 22,
  },
  backBtn: {
    width: 44,
    height: 44,
    marginLeft: -12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressTrack: {
    flex: 1,
    flexDirection: 'row',
    gap: 5,
  },
  progressSeg: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  skipBtn: {
    minWidth: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.accentDark,
  },

  // ─── Kicker / title / sub ───
  titleSection: {
    paddingHorizontal: 22,
  },
  kicker: {
    marginTop: 16,
    fontSize: 12,
    fontFamily: FontFamily.heading,
    letterSpacing: 2,
    color: colors.accentDark,
  },
  stepTitle: {
    marginTop: 6,
    fontSize: 32,
    lineHeight: 35,
    fontFamily: FontFamily.heading,
    color: colors.black,
  },
  stepSubtitle: {
    marginTop: 6,
    marginBottom: 20,
    fontSize: 14.5,
    lineHeight: 21,
    fontFamily: FontFamily.regular,
    color: colors.gray600,
  },

  // ─── Content ───
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    paddingHorizontal: 22,
    paddingBottom: 24,
    paddingTop: 2,
  },
  stepContent: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    letterSpacing: 1,
    color: colors.gray600,
    marginBottom: 7,
  },
  fieldLabelHint: {
    fontWeight: '400',
    fontFamily: FontFamily.regular,
    letterSpacing: 0,
    color: colors.gray500,
  },
  textInput: {
    height: 54,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.cardBg,
    borderRadius: 4,
    paddingHorizontal: 16,
    fontSize: 18,
    fontFamily: FontFamily.regular,
    color: colors.black,
  },
  helperText: {
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: FontFamily.regular,
    color: colors.gray500,
    marginTop: 12,
  },

  // ─── Chips ───
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: 'transparent',
  },
  chipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentTint15,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: FontFamily.medium,
    color: colors.black,
  },
  chipTextSelected: {
    color: colors.accentDark,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },

  // ─── City footnote ───
  footnoteRule: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  footnoteText: {
    fontSize: 12.5,
    lineHeight: 19,
    fontFamily: FontFamily.regular,
    color: colors.gray500,
  },

  // ─── Photo tile ───
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  photoTileFrame: {
    width: 96,
    height: 96,
  },
  photoTile: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.cardBg,
    overflow: 'hidden',
  },
  photoTileEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  photoTileHint: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    color: colors.gray500,
  },
  photoCaption: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FontFamily.regular,
    color: colors.gray600,
  },

  // ─── Visibility radios ───
  visCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  visCardActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentTint08,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.gray400,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  radioOuterActive: {
    borderColor: colors.accent,
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.accent,
  },
  visLabel: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.black,
  },
  visSub: {
    marginTop: 2,
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: FontFamily.regular,
    color: colors.gray600,
  },

  // ─── Error ───
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  errorText: {
    fontSize: 12.5,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.error,
    flex: 1,
  },

  // ─── CTA ───
  footer: {
    paddingHorizontal: 22,
    paddingTop: 14,
  },
  ctaBtn: {
    height: 54,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 18,
    fontFamily: FontFamily.heading,
    letterSpacing: 1,
    color: colors.cream,
    textTransform: 'uppercase',
  },

  // ── Saving overlay ──
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#111111',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  savingText: {
    marginTop: 20,
    fontSize: 17,
    fontFamily: FontFamily.medium,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.3,
  },
});

export default ProfileSetupScreen;
