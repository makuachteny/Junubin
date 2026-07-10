// useEligibility — wraps checkActionAllowed + the SurveyNudgeModal
// so each action site can do:
//
//   const { gate, nudge } = useEligibility();
//   ...
//   if (!gate('swipe_like')) return;     // shows nudge automatically
//   recordSwipe(...);
//   ...
//   {nudge}    // <-- render at the bottom of the screen JSX
//
// The hook owns the modal state so individual screens don't have to.
// Other failure reasons (tier_required, balance_required, etc.) bubble
// back via the gate() return value as null, with the verdict on the ref
// for callers that want to render their own paywall/coin sheet.

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Alert } from 'react-native';
import { checkActionAllowed, REASON_COPY } from '../utils/eligibility';
import { useAuth } from '../auth';
import SurveyNudgeModal from '../components/SurveyNudgeModal';

// Eligibility step ids that can ONLY be resolved by the dedicated
// onboarding survey screens — everything else routes to EditProfile.
//
// Previously this set was inverted (a tiny allow-list of fields
// editable in EditProfile, everything else fell through to the
// multi-step ProfileSetup survey). That meant a returning user who
// was missing, say, their date of birth or "interested in" got
// bounced into the first-launch onboarding flow on every dating
// action — exactly the regression the user reported. ProfileSetup
// is a first-launch-only flow now; the survey is for accessibility
// questions only, and AccessibilitySurveyScreen owns that surface.
const SURVEY_ONLY_STEPS = new Set(['survey']);

// Session-scoped dismissal memory. Keyed by `resumeAt` so the nudge
// only fires once per missing-step per app session: dismiss it for
// "photos" and you won't see it again until you actually add the
// photos (or until the next cold start). Module scope is intentional —
// every screen sharing this hook reads the same set, otherwise the
// nudge would refire on each screen change.
//
// `dismissedForUserId` tracks whose dismissals are stored so we can
// drop the set when a different user signs in (otherwise account B
// would inherit account A's "stop nagging me" choices).
const dismissedSteps = new Set();
let dismissedForUserId = null;

export function useEligibility() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const [nudgeState, setNudgeState] = useState({ visible: false, from: 'default', resumeAt: null });
  const lastVerdictRef = useRef(null);

  // Wipe the session-scoped dismissal set when the signed-in user
  // changes (sign out → sign in as someone else). Without this, a
  // second account would inherit the first account's "stop nagging"
  // choices and never see the survey nudge.
  useEffect(() => {
    const uid = user?.id ?? null;
    if (uid !== dismissedForUserId) {
      dismissedSteps.clear();
      dismissedForUserId = uid;
    }
  }, [user?.id]);

  // Recovery: when the profile updates, drop any step from the
  // dismissed set that the user has now actually completed.
  //
  // Sequence we are fixing:
  //   1. User taps Like → nudge appears → user dismisses
  //   2. User goes through ProfileSetup and finishes
  //   3. AuthContext refetches → user.profile.surveyCompletedAt is set
  //   4. (Old behavior) dismissedSteps still has 'survey' → next Like
  //      SILENTLY blocks because gate() returns false but the dismissal
  //      memory suppresses the nudge — the user gets no feedback at
  //      all on why their like did nothing.
  //
  // Now: once the underlying field becomes filled, the step is
  // removed from the dismiss set so subsequent gate() calls return
  // ok:true cleanly. Mirrors STEP_ORDER in utils/eligibility.js —
  // keep in sync when STEP_ORDER changes.
  useEffect(() => {
    if (!user?.profile) return;
    const profile = user.profile;
    const u = user;
    const isFilled = {
      purpose:          !!profile.accountPurpose,
      displayName:      !!u.displayName,
      dob:              !!u.dateOfBirth,
      gender:           !!u.gender,
      photos:           (u.photos?.length || 0) >= 3,
      interestedIn:     !!profile.lookingForGender,
      datingIntentions: !!profile.datingIntentions,
      prompts:          (profile.promptAnswer?.length || 0) >= 10,
      interests:        Array.isArray(profile.interests) && profile.interests.length >= 3,
      survey:           !!profile.surveyCompletedAt,
    };
    for (const stepId of Array.from(dismissedSteps)) {
      if (isFilled[stepId]) dismissedSteps.delete(stepId);
    }
  }, [user]);

  const closeNudge = useCallback(() => {
    setNudgeState((s) => {
      if (s.resumeAt) dismissedSteps.add(s.resumeAt);
      return { ...s, visible: false };
    });
  }, []);

  // Auto-close the nudge if the user satisfies the missing step
  // while the modal is still open (e.g. they completed the survey on
  // another device and the realtime user refetch lands). Without this
  // the modal sits there stale until the user manually dismisses,
  // even though its premise is gone.
  useEffect(() => {
    if (!nudgeState.visible || !nudgeState.resumeAt || !user?.profile) return;
    const profile = user.profile;
    const u = user;
    const stepId = nudgeState.resumeAt;
    const filled =
      (stepId === 'survey' && !!profile.surveyCompletedAt) ||
      (stepId === 'purpose' && !!profile.accountPurpose) ||
      (stepId === 'displayName' && !!u.displayName) ||
      (stepId === 'dob' && !!u.dateOfBirth) ||
      (stepId === 'gender' && !!u.gender) ||
      (stepId === 'photos' && (u.photos?.length || 0) >= 3) ||
      (stepId === 'interestedIn' && !!profile.lookingForGender) ||
      (stepId === 'datingIntentions' && !!profile.datingIntentions) ||
      (stepId === 'prompts' && (profile.promptAnswer?.length || 0) >= 10) ||
      (stepId === 'interests' && Array.isArray(profile.interests) && profile.interests.length >= 3);
    if (filled) setNudgeState((s) => ({ ...s, visible: false }));
  }, [user, nudgeState.visible, nudgeState.resumeAt]);

  const continueToProfile = useCallback(() => {
    const { resumeAt, from } = nudgeState;
    setNudgeState((s) => ({ ...s, visible: false }));
    // Resolve the viewer's current mode so the destination can adapt
    // its copy and which fields it surfaces. Mirror the resolution
    // useCurrentUser does so a Settings-mode switch is respected here.
    const profile = user?.profile || {};
    const mode = profile.appMode === 'social'
      || profile.accountPurpose === 'socialize'
      || profile.accountPurpose === 'social'
      ? 'socialize'
      : 'dating';
    // Always route returning users to EditProfile so missing fields
    // are fixed in-place rather than dragging them back through the
    // first-launch onboarding survey. The only exception is the
    // accessibility survey, which is its own dedicated screen.
    if (resumeAt && SURVEY_ONLY_STEPS.has(resumeAt)) {
      navigation.navigate('AccessibilitySurvey', { returnTo: 'back', source: from });
    } else {
      navigation.navigate('EditProfile', { focusStep: resumeAt, mode, source: from });
    }
  }, [navigation, nudgeState, user]);

  /**
   * Returns true if the action is allowed, false otherwise. On false,
   * the appropriate UI is automatically shown (nudge modal for survey,
   * alert for restricted/banned, etc).
   *
   * Pass `silent: true` to suppress UI and just inspect `lastVerdict()`.
   */
  const gate = useCallback((action, opts = {}) => {
    const verdict = checkActionAllowed({ user, action });
    lastVerdictRef.current = verdict;
    if (verdict.ok) return true;

    if (opts.silent) return false;

    switch (verdict.reason) {
      case 'survey_required':
        // Only surface the nudge the first time the user encounters
        // this specific missing step in the current session. Repeated
        // taps after they dismiss silently no-op so the popup isn't a
        // pop-up-on-every-tap nag. The action itself is still blocked
        // server-side, so suppression is purely a UX concession.
        if (!dismissedSteps.has(verdict.resumeAt)) {
          setNudgeState({ visible: true, from: action, resumeAt: verdict.resumeAt });
        }
        break;
      case 'banned':
        Alert.alert(REASON_COPY.banned.title, REASON_COPY.banned.body, [
          { text: 'Sign out', onPress: () => logout?.() },
        ]);
        break;
      case 'restricted':
        Alert.alert(REASON_COPY.restricted.title, REASON_COPY.restricted.body);
        break;
      case 'tier_required':
        // Caller usually owns the paywall UI — just surface the reason
        // so they can route to Elite. This branch is silent so the
        // existing paywall flow still wins.
        break;
      default:
        break;
    }
    return false;
  }, [logout, user]);

  const lastVerdict = useCallback(() => lastVerdictRef.current, []);

  const nudge = (
    <SurveyNudgeModal
      visible={nudgeState.visible}
      from={nudgeState.from}
      onCancel={closeNudge}
      onContinue={continueToProfile}
    />
  );

  return { gate, lastVerdict, nudge };
}
