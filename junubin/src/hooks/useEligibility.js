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

import React, { useCallback, useState, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Alert } from 'react-native';
import { checkActionAllowed, REASON_COPY } from '../utils/eligibility';
import { useAuth } from '../auth';
import SurveyNudgeModal from '../components/SurveyNudgeModal';

export function useEligibility() {
  const navigation = useNavigation();
  const { user, signOut } = useAuth();
  const [nudgeState, setNudgeState] = useState({ visible: false, from: 'default', resumeAt: null });
  const lastVerdictRef = useRef(null);

  const closeNudge = useCallback(() => {
    setNudgeState((s) => ({ ...s, visible: false }));
  }, []);

  const continueToSurvey = useCallback(() => {
    const { resumeAt, from } = nudgeState;
    setNudgeState((s) => ({ ...s, visible: false }));
    // Two-stage funnel: ProfileSetup covers basics (name/dob/photos/
    // intentions); AccessibilitySurvey owns the dating-compatibility
    // questionnaire that flips `surveyCompletedAt`. The eligibility
    // helper returns the canonical step id; we just route the right
    // screen for it. Web, iOS, Android all funnel through here.
    if (resumeAt === 'survey') {
      navigation.navigate('AccessibilitySurvey', { source: from });
    } else {
      navigation.navigate('ProfileSetup', { resumeAt, source: from });
    }
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
        setNudgeState({ visible: true, from: action, resumeAt: verdict.resumeAt });
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
      onContinue={continueToSurvey}
    />
  );

  return { gate, lastVerdict, nudge };
}
