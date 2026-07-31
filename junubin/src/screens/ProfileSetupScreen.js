import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Alert,
  Image,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import { useAuth } from '../auth';
import { validateName } from '../utils/validators';
import * as profileService from '../api/services/profileService';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LogoMark from '../components/LogoMark';
import DateWheelPicker from '../components/DateWheelPicker';
import SearchablePicker from '../components/SearchablePicker';
import { getEthnicIdentity } from '../utils/ethnicIdentity';
import { ALL_TRIBE_KEYS } from '../data/tribes';
import { GENDER_OPTIONS, toDbGender, toUiGender } from '../data/gender';
import {
  PRONOUN_OPTIONS,
  EDUCATION_OPTIONS,
  INTEREST_OPTIONS,
  PROMPT_OPTIONS,
  LOCATION_VISIBILITY_OPTIONS,
  normalizeLocationVisibility,
} from '../data/profileOptions';
import { OPEN_TO_OPTIONS, normalizeOpenTo, openToLabels } from '../data/openTo';
import { LANGUAGE_OPTIONS, normalizeLanguages } from '../data/languages';
import { COUNTRY_PICKER_OPTIONS, COUNTRY_BY_CODE } from '../data/worldCountries';
import { promptToOpenSettings } from '../utils/permissionAlert';
import { getProfileRecord } from '../utils/eligibility';

const { width } = Dimensions.get('window');

// ─── Step Definitions ───
// One flat list, walked start to finish. JuNubin pivoted from a dating
// app to a South Sudanese social/community platform, which removed the
// four dating-only steps (sexuality, datePref, children, intention) and
// with them the whole `datingOnly` / `isSocialOnly` branching mechanism
// — there is no longer a mode that reshapes the step list, so STEPS is
// simply ALL_STEPS.
//
// Step 1 is `openTo` ("What are you open to?"), the multi-select that
// replaced the Dating/Socialize purpose cards. `locationVisibility` is
// LAST and must stay last: it's the privacy consent gate, and the user
// should have seen what the app is for before deciding whether to
// appear on the map.
const ALL_STEPS = [
  { key: 'openTo',    title: 'What are you open to?',         icon: 'sparkles',           subtitle: 'Pick everything that fits. This is how people find their people.' },
  { key: 'name',      title: "What's your first name?",       icon: 'person',             subtitle: 'This is how you\'ll appear on JuNubin.' },
  { key: 'birthday',  title: 'When were you born?',           icon: 'calendar',           subtitle: 'Your age will be shown on your profile.' },
  { key: 'gender',    title: 'What\'s your gender?',          icon: 'body',               subtitle: 'Optional — skip it if you\'d rather not say.' },
  { key: 'pronouns',  title: 'What are your pronouns?',       icon: 'chatbubbles',        subtitle: 'Select up to 4. This will be visible on your profile.' },
  { key: 'country',   title: 'Which country do you most identify with?', icon: 'earth',     subtitle: 'Pick the country that best represents who you are.' },
  { key: 'city',      title: 'Which city are you in?',        icon: 'business',           subtitle: 'Optional — it helps people nearby find you. No exact address.' },
  { key: 'ethnicity', title: 'What\'s your background?',      icon: 'flag',               subtitle: 'Optional — help others learn more about you.' },
  { key: 'languages', title: 'Which languages do you speak?', icon: 'language',           subtitle: 'Optional — pick as many as you like.' },
  { key: 'education', title: 'Education level',               icon: 'school',             subtitle: 'Optional — visible on your profile.' },
  { key: 'profession', title: 'What do you do?',              icon: 'briefcase',          subtitle: 'Optional — your work and where you studied.' },
  { key: 'photos',    title: 'Add your best photos',          icon: 'camera',             subtitle: 'Add at least 3 photos. The more, the better!' },
  { key: 'verify',    title: 'Verify your identity',          icon: 'shield-checkmark',   subtitle: 'Take a quick selfie to prove you\'re real.' },
  { key: 'interests', title: 'What do you love?',             icon: 'star',               subtitle: 'Pick at least 3 interests.' },
  { key: 'prompts',   title: 'Answer a profile prompt',       icon: 'chatbox-ellipses',   subtitle: 'Show off your personality.' },
  { key: 'locationVisibility', title: 'Who can see where you are?', icon: 'map',          subtitle: 'You\'re in control. Location sharing is off unless you turn it on.' },
];

// ─── Options Data ───
// GENDER_OPTIONS imported from src/data/gender.js (UI ↔ DB enum mapping).
// The survey vocabularies — PRONOUN_OPTIONS, EDUCATION_OPTIONS,
// INTEREST_OPTIONS, PROMPT_OPTIONS, LOCATION_VISIBILITY_OPTIONS — live
// in the shared src/data/profileOptions.js, and the two long ones
// (OPEN_TO_OPTIONS, LANGUAGE_OPTIONS) in their own files, so this
// screen and EditProfile can't drift out of sync. (Previously each
// screen defined its own copy with a "mirror this in the other file"
// comment — exactly the pattern that produces "saved value doesn't
// match a chip" bugs.)
// ETHNICITY_OPTIONS is kept local because it's just a thin alias over
// ALL_TRIBE_KEYS from src/data/tribes.js — no list values to maintain.
const ETHNICITY_OPTIONS = ALL_TRIBE_KEYS;

// Every profile still carries accountPurpose: 'socialize'. The value is
// no longer a user choice — the Dating/Socialize cards are gone — but
// profile-completeness checks, AppNavigator's deep-link routing and
// AuthContext's mode resolution all still branch on it, so the pivot
// keeps writing it rather than orphaning those call sites. What the
// user actually picks now lands in Profile.openTo.
const ACCOUNT_PURPOSE = 'socialize';

// Profile.lookingFor predates the pivot and still carried dating copy
// ('Something serious', 'Marriage-minded'). New signups get a neutral
// value derived from their first openTo pick instead of a dating
// default, so no card or preview surface has to special-case it.
const openToPrimaryLabel = (keys) => openToLabels(keys)[0] || 'Community';

// Map eligibility step ids → ProfileSetup step keys. Used when the
// SurveyNudgeModal opens this screen with `resumeAt` set: we seek to
// the matching step in STEPS rather than starting from the top. Kept
// in lockstep with STEP_ORDER in src/utils/eligibility.js.
//
// The bottom block is defensive aliases for ids that no longer exist
// in STEP_ORDER but may still be in flight in a push notification, a
// deep link, or a stored AsyncStorage value written before the
// community pivot / before the `bio` → `prompts` rename. They resolve
// to the nearest surviving step so a stale resumeAt lands somewhere
// sensible instead of falling through to `resumeAt` itself and
// silently no-op'ing the seek.
const RESUME_KEY_BY_ELIGIBILITY_ID = {
  purpose:          'openTo',
  openTo:           'openTo',
  displayName:      'name',
  dob:              'birthday',
  gender:           'gender',
  country:          'country',
  countryCode:      'country',
  city:             'city',
  languages:        'languages',
  profession:       'profession',
  locationVisibility: 'locationVisibility',
  photos:           'photos',
  prompts:          'prompts',
  interests:        'interests',
  // ── legacy / removed ids ──
  bio:              'prompts',
  interestedIn:     'openTo',
  datingIntentions: 'openTo',
  sexuality:        'openTo',
  datePref:         'openTo',
  intention:        'openTo',
  children:         'openTo',
  survey:           'prompts',
};

const ProfileSetupScreen = ({ navigation, route }) => {
  const resumeAtParam = route?.params?.resumeAt || null;

  // The step list is fixed now. It used to reshape around `purpose`
  // (dating vs socialize), which meant `currentStep` was an index into
  // a list that could grow mid-flow. With the dating branch gone STEPS
  // is a stable constant, so a resumeAt index resolved on mount stays
  // valid for the whole run.
  const STEPS = ALL_STEPS;

  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Seek to the requested step when ProfileSetup is opened from the
  // SurveyNudgeModal (or a deep link).
  //
  // Tracked via a ref so the seek only fires once per (resumeAtParam,
  // mount) — once the user manually advances or goes back, we never
  // bounce them back here.
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

  // Form state
  const [firstName, setFirstName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [selectedGender, setSelectedGender] = useState('');
  const [selectedPronouns, setSelectedPronouns] = useState([]);
  const [selectedEthnicity, setSelectedEthnicity] = useState('');
  // Country = ISO 3166-1 alpha-2 code stored on User.countryCode. The
  // step uses a searchable modal picker (240+ entries) instead of a
  // radio list — too long to scroll inline.
  const [selectedCountry, setSelectedCountry] = useState('');
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  // City = free text on User.city. Deliberately not a picker: there is
  // no canonical list that covers Juba, Kakuma, Omaha and Melbourne
  // equally well, and a wrong-but-close pick is worse than what people
  // type themselves.
  const [city, setCity] = useState('');
  const [selectedEducation, setSelectedEducation] = useState('');
  // Profession → Profile.profession (free text). `job` and `school`
  // are the pre-existing columns and keep being written from the same
  // step so nothing that already reads them regresses.
  const [profession, setProfession] = useState('');
  const [school, setSchool] = useState('');
  // openTo → Profile.openTo (array of keys from src/data/openTo.js).
  const [selectedOpenTo, setSelectedOpenTo] = useState([]);
  // languages → Profile.languages (array of labels).
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  // locationVisibility → Profile.locationVisibility. 'off' by default,
  // for everyone, always. Nothing on this screen may change that
  // without an explicit tap.
  const [locationVisibility, setLocationVisibility] = useState('off');
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [promptAnswer, setPromptAnswer] = useState('');
  const [photos, setPhotos] = useState(Array(6).fill(null));
  const [verificationPhoto, setVerificationPhoto] = useState(null);

  // Visibility toggles (BLK feature) — see renderVisibilityToggle below;
  // these are declared-but-inert until per-field visibility ships.
  const [showGender, setShowGender] = useState(true);
  const [showPronouns, setShowPronouns] = useState(true);
  const [showEthnicity, setShowEthnicity] = useState(true);

  // Hydrate form fields from the existing User/Profile row so a returning
  // user lands on the right step *with their prior answers already filled
  // in*. Without this, a user who completes 5 of 8 steps, exits, and
  // re-enters via the SurveyNudgeModal sees every field blank and has to
  // re-answer them. We run this once per `authUser.id` (tracked via the
  // ref) so user-typed edits aren't clobbered if AuthContext later
  // refetches the row in the background.
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

    // DB stores 'man' / 'woman' / 'non_binary' / 'other'; UI uses
    // capitalized strings. 'other' has no matching option, so leave
    // it unset and the user picks again — but every other value
    // round-trips losslessly.
    if (authUser.gender && toUiGender(authUser.gender)) {
      setSelectedGender(toUiGender(authUser.gender));
    }

    // Pronouns serialize to a comma-separated string in updateProfile;
    // split back into the array the UI expects.
    if (typeof profile.pronouns === 'string' && profile.pronouns.trim()) {
      const arr = profile.pronouns.split(',').map((s) => s.trim()).filter(Boolean);
      if (arr.length) setSelectedPronouns(arr);
    } else if (Array.isArray(profile.pronouns)) {
      setSelectedPronouns(profile.pronouns);
    }

    // countryCode / city live on User (not Profile), so hydrate from
    // the outer record. countryCode is uppercase ISO 3166-1 alpha-2
    // (e.g. 'KE'); city is free text.
    if (authUser.countryCode) setSelectedCountry(authUser.countryCode);
    if (typeof authUser.city === 'string' && authUser.city.trim()) setCity(authUser.city);
    if (profile.ethnicity) setSelectedEthnicity(profile.ethnicity);
    if (profile.education) setSelectedEducation(profile.education);
    if (profile.profession) setProfession(profile.profession);
    else if (profile.job) setProfession(profile.job);
    if (profile.school) setSchool(profile.school);

    // The three pivot columns may not exist yet on an un-migrated
    // backend, in which case they arrive as undefined/null. The
    // normalizers below collapse anything unexpected to the safe
    // default ([] / [] / 'off') rather than letting a null reach a
    // .map() or a comparison in the render path.
    const hydratedOpenTo = normalizeOpenTo(profile.openTo);
    if (hydratedOpenTo.length) setSelectedOpenTo(hydratedOpenTo);
    const hydratedLanguages = normalizeLanguages(profile.languages);
    if (hydratedLanguages.length) setSelectedLanguages(hydratedLanguages);
    setLocationVisibility(normalizeLocationVisibility(profile.locationVisibility));

    if (Array.isArray(profile.interests) && profile.interests.length) {
      setSelectedInterests(profile.interests);
    }
    if (profile.promptQuestion) setSelectedPrompt(profile.promptQuestion);
    if (profile.promptAnswer) setPromptAnswer(profile.promptAnswer);

    // Pre-fill the photos grid from already-uploaded Photo rows. The
    // photos step's "Continue" still works because validateStep counts
    // any non-null cell, and saveProfileToApi only re-uploads cells
    // that hold a *local* URI (the hydrated cells hold http(s) URLs
    // pointing at Supabase Storage and are skipped on save).
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
    // required field so a user cannot land in the app with an incomplete
    // profile via deep-link resume, race condition, or future bug that
    // bypasses per-step gating. Build a human-readable list of missing
    // fields and short-circuit before touching the API.
    const trimmedName = firstName.trim();
    const trimmedPromptAnswer = promptAnswer.trim();
    const missing = [];

    if (!trimmedName || trimmedName.length < 2) missing.push('first name (at least 2 characters)');
    if (!selectedOpenTo || selectedOpenTo.length === 0) missing.push('at least one thing you\'re open to');

    // Birthday — full MM/DD/YYYY + 18+ age check (mirrors validateStep 'birthday')
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

    // Gender, city, ethnicity, languages, education, profession and
    // locationVisibility are all optional-skippable steps, so they are
    // deliberately absent from this list. Requiring a field here that
    // the Skip pill lets the user bypass produces an "incomplete
    // profile" alert with no way to satisfy it.
    if (!selectedPronouns || selectedPronouns.length === 0) missing.push('pronouns');
    if (!selectedCountry) missing.push('country');
    if (!selectedInterests || selectedInterests.length < 3) missing.push('at least 3 interests');
    if (!selectedPrompt) missing.push('a profile prompt');
    if (!trimmedPromptAnswer || trimmedPromptAnswer.length < 10) missing.push('prompt answer (at least 10 characters)');
    if (photos.filter(Boolean).length < 3) missing.push('at least 3 photos');

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
        ...(selectedGender ? { gender: toDbGender(selectedGender) || 'other' } : {}),
        pronouns: selectedPronouns.join(', '),
        ethnicity: selectedEthnicity,
        // User.countryCode — ISO 3166-1 alpha-2. profileService routes
        // this to the User table (USER_KEYS) so it persists alongside
        // displayName, dateOfBirth, gender, city.
        countryCode: selectedCountry,
        city: city.trim(),
        education: selectedEducation,
        // Profession is the new canonical column; job/school keep being
        // written so the profile surfaces that already read them (card
        // pills, preview sheet) don't go blank for new signups.
        profession: profession.trim(),
        job: profession.trim(),
        school: school.trim(),
        languages: selectedLanguages,
        openTo: selectedOpenTo,
        // Privacy: whatever the user picked on the final consent step,
        // defaulting to 'off'. Never inferred, never defaulted to a
        // more-visible value.
        locationVisibility,
        interests: selectedInterests,
        promptQuestion: selectedPrompt,
        promptAnswer: promptAnswer.trim(),
        // Neutral, community-flavoured "here for" derived from the
        // first openTo pick, so the existing Profile.lookingFor column
        // stops carrying dating copy for new signups.
        lookingFor: openToPrimaryLabel(selectedOpenTo),
        accountPurpose: ACCOUNT_PURPOSE,
        profileComplete: true,
        // Mark the survey as complete here — the flow this user just
        // finished IS the survey. Previously this flag only flipped
        // inside AccessibilitySurvey, which meant the eligibility gate
        // kept re-nudging users to a second screen after they'd already
        // answered every question. AccessibilitySurvey remains reachable
        // from Settings for users who want to tune accessibility
        // preferences (contrast / motion / non-color cues).
        surveyCompletedAt: new Date().toISOString(),
        // EULA acceptance was checked on the SignupScreen before the
        // user reached this point. Stamp it on the Profile now that
        // we have a row to write to — App Review wants an auditable
        // timestamp + version string per user, not just a checkbox.
        eulaAcceptedAt: new Date().toISOString(),
        eulaVersion: '2026-05-06',
      };

      // Upload photos FIRST — we must confirm the user actually has at
      // least 3 photos in Supabase before we stamp surveyCompletedAt
      // and let them into the app. Previously the profile was marked
      // complete before uploads ran, so if every upload failed (network
      // drop, storage error) the user landed in the app with zero
      // photos and a "complete" flag, and the eligibility gate had no
      // way to re-nudge them.
      //
      // Skip cells that already hold an http(s) URL — those are photos
      // we hydrated from the existing Photo rows on mount, so they're
      // already stored in Supabase. Re-uploading them would create
      // duplicate Photo rows on every save when a returning user lands
      // here via the SurveyNudgeModal.
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

      // Enforce 3-photo floor on the server-side count: already-remote
      // photos (hydrated from existing Photo rows) + freshly uploaded
      // ones that succeeded. If we're under 3, bail without stamping
      // surveyCompletedAt — the user's form state stays intact so they
      // can retry from this screen.
      const remoteCount = photos.filter((u) => u && isRemoteUrl(u)).length;
      const successfulNewCount = photoUris.length - photoFailures.length;
      if (remoteCount + successfulNewCount < 3) {
        Alert.alert(
          'Photos required',
          `You must have at least 3 photos. ${photoFailures.length > 0 ? `${photoFailures.length} upload(s) failed — please try again.` : ''}`,
        );
        return; // do NOT stamp surveyCompletedAt
      }

      const user = await profileService.updateProfile(updates);
      updateUser(user);

      // Keep the local mode fallback in step with the persisted
      // accountPurpose. useCurrentUser falls back to @junubin_mode for
      // legacy installs; the old purpose cards used to write it, and
      // leaving it unset after the pivot would make those installs
      // resolve to 'unset'. Best-effort — a storage failure must not
      // undo a saved profile.
      try {
        await AsyncStorage.setItem('@junubin_mode', 'Social');
        await AsyncStorage.setItem('@junubin_purpose', ACCOUNT_PURPOSE);
      } catch (e) {
        if (__DEV__) console.warn('[ProfileSetup] mode cache write failed:', e?.message);
      }

      // Verification photo is optional — upload after the profile is
      // committed so a failure here doesn't undo a complete profile.
      if (verificationPhoto) {
        try {
          await profileService.uploadPhoto(verificationPhoto);
        } catch (e) {
          photoFailures.push(`Verification: ${e?.message || String(e)}`);
          if (__DEV__) console.warn('Verification photo upload failed:', e?.message, e?.cause);
        }
      }

      if (photoFailures.length > 0) {
        Alert.alert(
          'Some photos didn\'t upload',
          `${photoFailures.length} of ${photoUris.length + (verificationPhoto ? 1 : 0)} photos failed. Your profile was saved — you can re-add photos from Edit Profile.\n\nFirst error: ${photoFailures[0]}`,
        );
      }

      // ProfileSetup completion → straight to Main. surveyCompletedAt
      // was set in the updates above, so the eligibility gate is
      // satisfied for whichever mode the user picked. If they toggle
      // modes later and have dating-only fields unfilled (Social user
      // → Dating mode), the gate will catch it on the next dating
      // action and route them back here with a `resumeAt` pointing
      // at the specific missing question — they won't have to redo
      // anything they've already answered.
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

  const handleBack = () => {
    setFieldError(null);
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleNameChange = (text) => {
    // Strip anything that isn't a Unicode letter / combining mark / space /
    // hyphen / apostrophe. The earlier [a-zA-Z] filter silently dropped
    // diacritics and Dinka/Nuer letters as the user typed — the validate
    // step would then accept the cleaned string, so people couldn't even
    // see why "Aŋany" became "Aany".
    const clean = text.replace(/[^\p{L}\p{M}\s'-]/gu, '').slice(0, 30);
    setFirstName(clean);
  };

  const handleDateChange = (text) => {
    const digits = text.replace(/\D/g, '');
    let formatted = '';
    if (digits.length <= 2) {
      formatted = digits;
    } else if (digits.length <= 4) {
      formatted = digits.slice(0, 2) + '/' + digits.slice(2);
    } else {
      formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
    }
    setBirthDate(formatted);

    // Show inline error as soon as the full date is entered
    if (formatted.length === 10) {
      const [mm, dd, yyyy] = formatted.split('/').map(Number);
      if (mm < 1 || mm > 12) {
        setFieldError('Invalid month. Please enter a value between 01 and 12.');
      } else {
        const daysInMonth = new Date(yyyy, mm, 0).getDate();
        if (dd < 1 || dd > daysInMonth) {
          setFieldError(`Invalid day. ${mm}/${yyyy} only has ${daysInMonth} days.`);
        } else if (yyyy < 1900 || yyyy > new Date().getFullYear()) {
          setFieldError('Please enter a valid year.');
        } else {
          const dob = new Date(yyyy, mm - 1, dd);
          const today = new Date();
          let age = today.getFullYear() - dob.getFullYear();
          const md = today.getMonth() - dob.getMonth();
          if (md < 0 || (md === 0 && today.getDate() < dob.getDate())) age--;
          if (age < 18) {
            setFieldError('You must be at least 18 years old to use JuNubin.');
          } else if (age > 120) {
            setFieldError('Please enter a valid date of birth.');
          }
        }
      }
    }
  };

  const togglePronoun = (p) => {
    if (selectedPronouns.includes(p)) {
      setSelectedPronouns(selectedPronouns.filter((x) => x !== p));
    } else if (selectedPronouns.length < 4) {
      setSelectedPronouns([...selectedPronouns, p]);
    }
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

  const toggleInterest = (interest) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const handlePhotoTap = async (index) => {
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
      aspect: [3, 4],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setPhotos((prev) => {
        const updated = [...prev];
        updated[index] = result.assets[0].uri;
        return updated;
      });
    }
  };

  // Returns null if valid, or an error message string if invalid
  const validateStep = () => {
    switch (step.key) {
      case 'name':
        return validateName(firstName);
      case 'birthday': {
        if (birthDate.length < 10) return 'Please enter your full date of birth (MM/DD/YYYY).';
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
      case 'gender':
        // Optional — some people simply don't want to answer, and the
        // pivot doesn't need this field to connect anyone. Skippable
        // via the top-right pill and also fine to Continue past empty.
        return null;
      case 'pronouns':
        return selectedPronouns.length > 0 ? null : 'Please select at least one pronoun.';
      case 'openTo':
        return selectedOpenTo.length > 0 ? null : 'Pick at least one thing you\'re open to.';
      case 'country':
        return selectedCountry ? null : 'Please choose the country you most identify with.';
      // Optional steps — the user can bypass them with the Skip pill,
      // and reaching this validator via Continue saves them as-is.
      case 'city':
      case 'ethnicity':
      case 'languages':
      case 'education':
      case 'profession':
        return null;
      case 'locationVisibility':
        // Always valid: 'off' is a legitimate (and the default) answer.
        // A required choice here would be a dark pattern — it turns a
        // privacy decision into a toll gate on finishing signup.
        return null;
      case 'photos': {
        const count = photos.filter(Boolean).length;
        if (count < 3) return `Please add at least 3 photos. You've added ${count}.`;
        return null;
      }
      case 'verify':
        return null; // Skippable — no hard requirement
      case 'prompts': {
        if (!selectedPrompt) return 'Please choose a prompt.';
        const answer = promptAnswer.trim();
        if (answer.length === 0) return 'Please write an answer to your prompt.';
        if (answer.length < 10) return 'Your answer is too short. Write at least 10 characters.';
        return null;
      }
      case 'interests':
        if (selectedInterests.length < 3) return `Pick at least 3 interests. You've selected ${selectedInterests.length}.`;
        return null;
      default:
        return null;
    }
  };

  const isStepValid = () => validateStep() === null;

  const [fieldError, setFieldError] = useState(null);

  // Clear error whenever the user changes input for the current step
  const stepInputKey = step.key === 'name' ? firstName
    : step.key === 'birthday' ? birthDate
    : step.key === 'gender' ? selectedGender
    : step.key === 'pronouns' ? selectedPronouns.length
    : step.key === 'openTo' ? selectedOpenTo.length
    : step.key === 'country' ? selectedCountry
    : step.key === 'city' ? city
    : step.key === 'ethnicity' ? selectedEthnicity
    : step.key === 'languages' ? selectedLanguages.length
    : step.key === 'education' ? selectedEducation
    : step.key === 'profession' ? `${profession}${school}`
    : step.key === 'locationVisibility' ? locationVisibility
    : step.key === 'photos' ? photos.filter(Boolean).length
    : step.key === 'prompts' ? `${selectedPrompt}${promptAnswer}`
    : step.key === 'interests' ? selectedInterests.length
    : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => { if (fieldError) setFieldError(null); }, [stepInputKey]);

  // Steps the user can bypass with the top-right Skip pill. These are
  // the genuinely optional fields — anything that's also required by
  // validateStep MUST NOT appear here, or the Skip becomes a free
  // bypass around the validator. The previous list included `photos`
  // and `prompts` despite validateStep requiring them, so users could
  // exit setup with zero photos and no prompt and the eligibility
  // check would never fire for those particular fields.
  //
  // Legitimately optional today. Every key here returns null from
  // validateStep, so Skip and Continue do the same thing — Skip just
  // makes "you may leave this blank" visible instead of implied.
  //   - gender             (explicitly optional after the pivot)
  //   - city               (people in transit shouldn't be forced)
  //   - ethnicity          (sensitive; opt-in)
  //   - languages          (nice-to-have signal)
  //   - education          (no profile/eligibility surface requires it)
  //   - profession         (nice-to-have signal)
  //   - verify             (selfie ID — encouraged but not blocking)
  //   - locationVisibility (privacy consent; skipping keeps the 'off'
  //                         default, which is the safe outcome)
  const OPTIONAL_STEPS = new Set([
    'gender', 'city', 'ethnicity', 'languages', 'education', 'profession',
    'verify', 'locationVisibility',
  ]);
  const canSkip = OPTIONAL_STEPS.has(step.key);

  // ─── Render Helpers ───
  const renderRadioOption = (option, selected, onSelect) => (
    <TouchableOpacity
      key={option}
      style={[styles.radioRow, selected === option && styles.radioRowActive]}
      onPress={() => onSelect(option)}
      activeOpacity={0.7}
    >
      <Text style={[styles.radioText, selected === option && styles.radioTextActive]}>
        {option}
      </Text>
      <View style={[styles.radioCircle, selected === option && styles.radioCircleActive]}>
        {selected === option && <View style={styles.radioCircleInner} />}
      </View>
    </TouchableOpacity>
  );

  const renderCheckOption = (option, selectedArr, onToggle) => {
    const isSelected = selectedArr.includes(option);
    return (
      <TouchableOpacity
        key={option}
        style={[styles.radioRow, isSelected && styles.radioRowActive]}
        onPress={() => onToggle(option)}
        activeOpacity={0.7}
      >
        <Text style={[styles.radioText, isSelected && styles.radioTextActive]}>
          {option}
        </Text>
        <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
          {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
        </View>
      </TouchableOpacity>
    );
  };

  // ── Visibility toggles removed ──
  // The four "Visible on profile" switches (gender / pronouns /
  // sexuality / ethnicity) were UI-only scaffolding — they flipped
  // local state but were never included in the save payload and no
  // display code read them, so the toggles did nothing. Removed from
  // the render path so the survey only surfaces inputs that actually
  // persist. The show* state vars remain in the file as dead-but-safe
  // declarations until a future PR brings real per-field visibility
  // (would need a Profile.fieldVisibility JSONB column).
  const renderVisibilityToggle = () => null;

  // ─── Step Content ───
  const renderStepContent = () => {
    switch (step.key) {
      case 'name':
        return (
          <View style={styles.stepContent}>
            <TextInput
              style={styles.textInput}
              placeholder="Your first name"
              placeholderTextColor={colors.gray400}
              value={firstName}
              onChangeText={handleNameChange}
              maxLength={30}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              autoFocus
            />
            <Text style={styles.helperText}>This cannot be changed later.</Text>
          </View>
        );

      case 'birthday':
        return (
          <View style={styles.stepContent}>
            <DateWheelPicker
              testID="setup-dob"
              value={birthDate}
              placeholder="Tap to pick your birth date"
              onChange={(payload) => setBirthDate(payload.mmddyyyy)}
            />
            <Text style={styles.helperText}>You must be 18 or older to use JuNubin.</Text>
          </View>
        );

      case 'gender':
        return (
          <View style={styles.stepContent}>
            {GENDER_OPTIONS.map((opt) => renderRadioOption(opt, selectedGender, setSelectedGender))}
            {renderVisibilityToggle('Visible on profile', showGender, setShowGender)}
          </View>
        );

      case 'pronouns':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.selectHint}>Select up to 4</Text>
            {PRONOUN_OPTIONS.map((opt) => renderCheckOption(opt, selectedPronouns, togglePronoun))}
            {renderVisibilityToggle('Visible on profile', showPronouns, setShowPronouns)}
          </View>
        );

      case 'openTo':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.selectHint}>
              {selectedOpenTo.length === 0
                ? 'Select at least 1'
                : `${selectedOpenTo.length} selected`}
            </Text>
            <View style={styles.badgeGrid}>
              {OPEN_TO_OPTIONS.map((opt) => {
                const isActive = selectedOpenTo.includes(opt.key);
                return (
                  <TouchableOpacity
                    key={opt.key}
                    testID={`open-to-${opt.key}`}
                    style={[styles.badge, isActive && styles.badgeActive]}
                    onPress={() => toggleOpenTo(opt.key)}
                    activeOpacity={0.7}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isActive }}
                    accessibilityLabel={opt.label}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={15}
                      color={isActive ? colors.accent : colors.gray500}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>
                      {opt.label}
                    </Text>
                    {isActive && (
                      <Ionicons name="checkmark" size={14} color={colors.accent} style={{ marginLeft: 6 }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.helperText}>
              You can change these any time in Settings.
            </Text>
          </View>
        );

      case 'city':
        return (
          <View style={styles.stepContent}>
            <TextInput
              style={styles.textInput}
              testID="setup-city"
              placeholder="e.g. Juba, Nairobi, Omaha"
              placeholderTextColor={colors.gray400}
              value={city}
              onChangeText={(t) => setCity(t.slice(0, 60))}
              maxLength={60}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              accessibilityLabel="City"
            />
            <Text style={styles.helperText}>
              Just the city name — never your street or exact address. Leave it
              blank if you'd rather not say.
            </Text>
          </View>
        );

      case 'languages':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.selectHint}>
              {selectedLanguages.length === 0
                ? 'Optional'
                : `${selectedLanguages.length} selected`}
            </Text>
            <View style={styles.badgeGrid}>
              {LANGUAGE_OPTIONS.map((lang) => {
                const isActive = selectedLanguages.includes(lang);
                return (
                  <TouchableOpacity
                    key={lang}
                    testID={`language-${lang}`}
                    style={[styles.badge, isActive && styles.badgeActive]}
                    onPress={() => toggleLanguage(lang)}
                    activeOpacity={0.7}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isActive }}
                    accessibilityLabel={lang}
                  >
                    <Text style={[styles.badgeText, isActive && styles.badgeTextActive]}>
                      {lang}
                    </Text>
                    {isActive && (
                      <Ionicons name="checkmark" size={14} color={colors.accent} style={{ marginLeft: 6 }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      case 'profession':
        return (
          <View style={styles.stepContent}>
            <TextInput
              style={styles.textInput}
              testID="setup-profession"
              placeholder="e.g. Nurse, student, driver, engineer"
              placeholderTextColor={colors.gray400}
              value={profession}
              onChangeText={(t) => setProfession(t.slice(0, 80))}
              maxLength={80}
              returnKeyType="next"
              accessibilityLabel="What you do"
            />
            <View style={{ height: 12 }} />
            <TextInput
              style={styles.textInput}
              testID="setup-school"
              placeholder="School or university (optional)"
              placeholderTextColor={colors.gray400}
              value={school}
              onChangeText={(t) => setSchool(t.slice(0, 80))}
              maxLength={80}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              accessibilityLabel="School or university"
            />
            <Text style={styles.helperText}>
              Both are optional — they just help people find others doing
              similar things.
            </Text>
          </View>
        );

      case 'locationVisibility':
        return (
          <View style={styles.stepContent}>
            {/* Plain-language explanation FIRST. Nothing on this screen
                touches expo-location or triggers an OS dialog — this is
                purely "what do other people get to see", asked before
                the app ever asks the system for a position. */}
            <View style={styles.privacyNote}>
              <Ionicons name="lock-closed" size={16} color={colors.accent} style={{ marginTop: 2 }} />
              <Text style={styles.privacyNoteText}>
                Location sharing is <Text style={styles.privacyNoteStrong}>off by default</Text>.
                If you turn it on, other members can see roughly where you are so
                you can find each other. We never show your exact address, we never
                sell your location, and we never use it for ad targeting.
              </Text>
            </View>

            <View style={{ gap: 12 }}>
              {LOCATION_VISIBILITY_OPTIONS.map((opt) => {
                const isActive = locationVisibility === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    testID={`location-visibility-${opt.key}`}
                    style={[styles.choiceCard, isActive && styles.choiceCardActive]}
                    onPress={() => setLocationVisibility(opt.key)}
                    activeOpacity={0.8}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isActive }}
                    accessibilityLabel={`${opt.label}. ${opt.description}`}
                  >
                    <View style={[styles.choiceIconCircle, isActive && { backgroundColor: colors.accent }]}>
                      <Ionicons name={opt.icon} size={22} color={isActive ? '#FFFFFF' : colors.gray500} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.choiceTitle, isActive && styles.choiceTitleActive]}>
                        {opt.label}
                        {opt.key === 'off' ? '  ·  Default' : ''}
                      </Text>
                      <Text style={[styles.choiceSubtitle, isActive && styles.choiceSubtitleActive]}>
                        {opt.description}
                      </Text>
                    </View>
                    <View style={[styles.radioCircle, isActive && styles.radioCircleActive]}>
                      {isActive && <View style={styles.radioCircleInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.helperText}>
              You can change this any time in Settings → Privacy.
            </Text>
          </View>
        );

      case 'country': {
        // 240+ countries → a single tap opens the SearchablePicker
        // modal instead of trying to render an inline radio list.
        // Mirrors the EditProfile pattern for the ethnicity row.
        const country = selectedCountry ? COUNTRY_BY_CODE[selectedCountry] : null;
        return (
          <View style={styles.stepContent}>
            <TouchableOpacity
              style={[
                styles.radioRow,
                selectedCountry && { borderColor: colors.accent, backgroundColor: 'rgba(206,17,38,0.06)' },
              ]}
              onPress={() => setCountryPickerOpen(true)}
              activeOpacity={0.7}
              testID="setup-country-row"
            >
              <Text style={{ fontSize: 22, marginRight: 6 }}>
                {country ? country.flag : '🌍'}
              </Text>
              <Text style={[
                styles.radioText,
                selectedCountry && { color: colors.black, fontWeight: '600', fontFamily: FontFamily.semibold },
              ]}>
                {country ? country.name : 'Tap to choose a country'}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.gray400}
                style={{ marginLeft: 'auto' }}
              />
            </TouchableOpacity>
          </View>
        );
      }

      case 'ethnicity':
        return (
          <View style={styles.stepContent}>
            {ETHNICITY_OPTIONS.map((opt) => {
              const eth = getEthnicIdentity(opt);
              const isActive = selectedEthnicity === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.radioRow,
                    isActive && { borderColor: eth.color, backgroundColor: eth.tint },
                  ]}
                  onPress={() => setSelectedEthnicity(opt)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 20, marginRight: 4 }}>{eth.emoji}</Text>
                  <Text style={[
                    styles.radioText,
                    isActive && { color: eth.color, fontWeight: '600', fontFamily: FontFamily.semibold },
                  ]}>
                    {opt}
                  </Text>
                  <View style={[styles.radioCircle, isActive && { borderColor: eth.color }]}>
                    {isActive && <View style={[styles.radioCircleInner, { backgroundColor: eth.color }]} />}
                  </View>
                </TouchableOpacity>
              );
            })}
            {renderVisibilityToggle('Visible on profile', showEthnicity, setShowEthnicity)}
          </View>
        );

      case 'education':
        return (
          <View style={styles.stepContent}>
            {EDUCATION_OPTIONS.map((opt) => renderRadioOption(opt, selectedEducation, setSelectedEducation))}
          </View>
        );

      case 'photos':
        return (
          <View style={styles.stepContent}>
            <View style={styles.photoGrid}>
              {photos.map((photo, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.photoSlot, index === 0 && styles.photoSlotPrimary]}
                  onPress={() => handlePhotoTap(index)}
                  activeOpacity={0.7}
                >
                  {photo ? (
                    <Image source={{ uri: photo }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  ) : (
                    <View style={styles.photoAddCircle}>
                      <Ionicons name="add" size={28} color={colors.accent} />
                    </View>
                  )}
                  {index === 0 && (
                    <View style={styles.photoPrimaryBadge}>
                      <Text style={styles.photoPrimaryText}>Main</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.helperText}>
              Tip: profiles with 4+ photos get noticed 3x more often.
            </Text>
          </View>
        );

      case 'verify':
        return (
          <View style={styles.stepContent}>
            {!verificationPhoto ? (
              <>
                <View style={styles.verifyIconCircle}>
                  <Ionicons name="camera" size={48} color={colors.accent} />
                </View>
                <View style={styles.verifyGuidelines}>
                  {[
                    'Face the camera directly',
                    'Good lighting, no filters',
                    'Match your profile photos',
                  ].map((guide, i) => (
                    <View key={i} style={styles.verifyGuideRow}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.black} />
                      <Text style={styles.verifyGuideText}>{guide}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.verifyCaptureBtn}
                  activeOpacity={0.85}
                  onPress={async () => {
                    const { status } = await ImagePicker.requestCameraPermissionsAsync();
                    if (status !== 'granted') {
                      promptToOpenSettings({
                        title: 'Camera access needed',
                        message: 'JuNubin needs camera access to verify your profile. Enable it in Settings.',
                      });
                      return;
                    }
                    const result = await ImagePicker.launchCameraAsync({
                      cameraType: ImagePicker.CameraType.front,
                      quality: 0.8,
                      allowsEditing: false,
                    });
                    if (!result.canceled && result.assets?.[0]?.uri) {
                      setVerificationPhoto(result.assets[0].uri);
                    }
                  }}
                >
                  <Ionicons name="camera" size={20} color="#FFFFFF" />
                  <Text style={styles.verifyCaptureBtnText}>Take Selfie</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Image source={{ uri: verificationPhoto }} style={styles.verifyPreview} />
                <Text style={styles.verifyPreviewHint}>Does this photo clearly show your face?</Text>
                <View style={styles.verifyActions}>
                  <TouchableOpacity
                    style={styles.verifyRetakeBtn}
                    onPress={() => setVerificationPhoto(null)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="refresh" size={18} color={colors.accent} />
                    <Text style={[styles.verifyActionText, { color: colors.accent }]}>Retake</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        );

      case 'prompts':
        return (
          <View style={styles.stepContent}>
            {!selectedPrompt ? (
              <>
                <Text style={styles.selectHint}>Choose a prompt</Text>
                {PROMPT_OPTIONS.map((prompt) => (
                  <TouchableOpacity
                    key={prompt}
                    style={styles.promptOption}
                    onPress={() => setSelectedPrompt(prompt)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.promptOptionText}>{prompt}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.selectedPromptHeader}
                  onPress={() => { setSelectedPrompt(''); setPromptAnswer(''); }}
                >
                  <Text style={styles.selectedPromptText}>{selectedPrompt}</Text>
                  <Ionicons name="close-circle" size={20} color={colors.gray400} />
                </TouchableOpacity>
                <TextInput
                  style={styles.promptInput}
                  placeholder="Write your answer..."
                  placeholderTextColor={colors.gray400}
                  value={promptAnswer}
                  onChangeText={setPromptAnswer}
                  multiline
                  maxLength={250}
                  textAlignVertical="top"
                  autoFocus
                />
                <Text style={styles.charCount}>{promptAnswer.length}/250</Text>
              </>
            )}
          </View>
        );

      case 'interests':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.selectHint}>
              {selectedInterests.length}/3 minimum selected
            </Text>
            <View style={styles.chipGrid}>
              {INTEREST_OPTIONS.map((interest) => {
                const isActive = selectedInterests.includes(interest);
                return (
                  <TouchableOpacity
                    key={interest}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => toggleInterest(interest)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {interest}
                    </Text>
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
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={colors.black} />
            </TouchableOpacity>

            {/* Progress Dots */}
            <View style={styles.progressDots}>
              {STEPS.map((_, i) => {
                const isActive = i <= currentStep;
                const isCurrent = i === currentStep;
                return (
                  <View
                    key={i}
                    style={[
                      styles.progressDot,
                      isActive && styles.progressDotActive,
                      isCurrent && styles.progressDotCurrent,
                    ]}
                  />
                );
              })}
            </View>

            {canSkip ? (
              <TouchableOpacity onPress={() => handleNext(true)}>
                <Text style={styles.skipBtn}>Skip</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>

          {/* ── Step Icon ── */}
          <View style={styles.stepIconWrap}>
            <View style={styles.stepIconCircle}>
              <Ionicons name={step.icon} size={28} color={colors.accent} />
            </View>
          </View>

          {/* ── Title ── */}
          <View style={styles.titleSection}>
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
              <Ionicons name="alert-circle" size={16} color={colors.rose || '#E53935'} />
              <Text style={styles.errorText}>{fieldError}</Text>
            </View>
          )}

          {/* ── Footer ── */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.footerLeft}>
              <Text style={styles.stepCounter}>
                {currentStep + 1} of {totalSteps}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.nextCircle, (fieldError || saving) && styles.nextCircleDisabled]}
              onPress={handleNext}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Ionicons
                  name={currentStep === totalSteps - 1 ? 'checkmark' : 'arrow-forward'}
                  size={28}
                  color="#FFFFFF"
                />
              )}
            </TouchableOpacity>
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
    {/* Country picker — modal opened from the `country` survey step.
        Lives at the screen root so it can render above the step content
        regardless of which step is active. */}
    <SearchablePicker
      visible={countryPickerOpen}
      onClose={() => setCountryPickerOpen(false)}
      title="Choose your country"
      searchPlaceholder="Search countries…"
      options={COUNTRY_PICKER_OPTIONS}
      selectedValue={selectedCountry}
      onSelect={(value) => setSelectedCountry(value)}
    />
    </>
  );
};

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gray200,
  },
  progressDotActive: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#E0E0E4',
    width: 8,
    height: 8,
  },
  progressDotCurrent: {
    backgroundColor: colors.accent,
    width: 24,
    height: 8,
    borderRadius: 4,
  },
  skipBtn: {
    ...Typography.label,
    color: colors.accent,
    width: 40,
    textAlign: 'right',
  },

  // ─── Step Icon ───
  stepIconWrap: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  stepIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F4F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E8E8EC',
  },

  // ─── Title ───
  titleSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: colors.black,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  stepSubtitle: {
    ...Typography.bodySmall,
    color: colors.gray500,
    lineHeight: 22,
  },

  // ─── Scroll Content ───
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  stepContent: {
    flex: 1,
  },

  // ─── Text Input ───
  textInput: {
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 18,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.black,
  },
  helperText: {
    ...Typography.caption,
    color: colors.gray400,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  selectHint: {
    ...Typography.caption,
    color: colors.accent,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    marginBottom: 12,
  },

  // ─── Radio Options ───
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.inputBg,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
  },
  radioRowActive: {
    borderColor: colors.accent,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F4F4F6',
  },
  radioText: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: FontFamily.medium,
    color: colors.gray600,
    flex: 1,
  },
  radioTextActive: {
    color: colors.black,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.gray300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleActive: {
    borderColor: colors.accent,
  },
  radioCircleInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },

  // ─── Checkbox ───
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.gray300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },

  // ─── Visibility Toggle ───
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
  },
  visibilityLabel: {
    ...Typography.bodySmallMedium,
    color: colors.gray500,
  },

  // ─── Photo Grid ───
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoSlot: {
    width: (width - 48 - 24) / 3,
    aspectRatio: 3 / 4,
    backgroundColor: colors.inputBg,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.inputBorder,
    borderStyle: 'dashed',
  },
  photoSlotPrimary: {
    width: (width - 48 - 12) / 2,
    borderColor: colors.accent,
    borderWidth: 2,
  },
  photoAddCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F4F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPrimaryBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  photoPrimaryText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },

  // ─── Prompts ───
  promptOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.inputBg,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  promptOptionText: {
    fontSize: 15,
    fontWeight: '500',
    fontFamily: FontFamily.medium,
    color: colors.gray600,
    flex: 1,
    marginRight: 8,
  },
  selectedPromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8F8FA',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E8E8EC',
  },
  selectedPromptText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.accent,
    flex: 1,
  },
  promptInput: {
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    fontSize: 16,
    color: colors.black,
    minHeight: 120,
    lineHeight: 24,
  },
  charCount: {
    ...Typography.caption,
    color: colors.gray400,
    textAlign: 'right',
    marginTop: 8,
  },

  // ─── Interest Chips ───
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.cardBg,
  },
  chipActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.gray500,
  },
  chipTextActive: {
    color: isDark ? colors.gray900 : '#FFFFFF',
  },

  // ─── Inline Error ───
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  errorText: {
    ...Typography.caption,
    color: colors.rose || '#E53935',
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    flex: 1,
  },

  // ─── Multi-select Badges (openTo / languages) ───
  // Same visual language as the interest chips, but with an accent
  // tint + checkmark instead of a solid fill so a screen full of
  // selected badges stays readable.
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    // 12pt vertical padding + ~20pt line box clears the 44pt minimum
    // touch target from ACCESSIBILITY_QA_MATRIX.md.
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.cardBg,
  },
  badgeActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSurface || (isDark ? 'rgba(206,17,38,0.16)' : '#FDE7E1'),
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.gray500,
  },
  badgeTextActive: {
    color: colors.accent,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },

  // ─── Choice Cards (location visibility) ───
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    borderRadius: 16,
    backgroundColor: colors.inputBg,
    borderWidth: 2,
    borderColor: colors.inputBorder,
  },
  choiceCardActive: {
    borderColor: colors.accent,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F4F4F6',
  },
  choiceIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  choiceTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.gray600,
    marginBottom: 2,
  },
  choiceTitleActive: {
    color: colors.black,
  },
  choiceSubtitle: {
    ...Typography.caption,
    color: colors.gray400,
    lineHeight: 17,
  },
  choiceSubtitleActive: {
    color: colors.gray500,
  },

  // ─── Privacy explainer ───
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    marginBottom: 20,
    borderRadius: 14,
    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F4F4F6',
    borderWidth: 1,
    borderColor: colors.separator,
  },
  privacyNoteText: {
    ...Typography.caption,
    color: colors.gray600,
    lineHeight: 18,
    flex: 1,
  },
  privacyNoteStrong: {
    color: colors.black,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },

  // ─── Footer ───
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
  },
  footerLeft: {
    flex: 1,
  },
  stepCounter: {
    ...Typography.caption,
    color: colors.gray400,
    fontWeight: '600',
  },
  nextCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  nextCircleDisabled: {
    opacity: 0.3,
  },

  // ── Verify step ──
  verifyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F4F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  verifyGuidelines: {
    gap: 12,
    marginBottom: 28,
  },
  verifyGuideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  verifyGuideText: {
    ...Typography.bodySmall,
    color: colors.black,
  },
  verifyCaptureBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
  },
  verifyCaptureBtnText: {
    ...Typography.bodySemibold,
    color: '#FFFFFF',
  },
  verifyPreview: {
    width: 200,
    height: 260,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 16,
    backgroundColor: colors.gray300,
  },
  verifyPreviewHint: {
    ...Typography.bodySmall,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: 20,
  },
  verifyActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  verifyRetakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  verifyActionText: {
    ...Typography.bodySemibold,
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
