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
  const { user, signOut } = useAuth();
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

  const closeNudge = useCallback(() => {
    setNudgeState((s) => {
      if (s.resumeAt) dismissedSteps.add(s.resumeAt);
      return { ...s, visible: false };
    });
  }, []);

  const continueToProfile = useCallback(() => {
    const { resumeAt, from } = nudgeState;
    setNudgeState((s) => ({ ...s, visible: false }));
    // Always route to ProfileSetup — it covers every essential field
    // (basics, photos, prompts, interests, dating qualifiers) and
    // stamps `surveyCompletedAt` on completion, satisfying the
    // eligibility gate without a separate Survey detour. The
    // dedicated AccessibilitySurveyScreen is still reachable from
    // Settings for users who want to revise just the survey answers.
    navigation.navigate('ProfileSetup', { resumeAt, source: from });
  }, [navigation, nudgeState]);

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
          { text: 'Sign out', onPress: () => signOut?.() },
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
  }, [signOut, user]);

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
