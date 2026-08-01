// useEligibility — wraps checkActionAllowed so each action site can do:
//
//   const { gate, nudge } = useEligibility();
//   ...
//   if (!gate('send_message')) return;   // shows alert automatically
//   ...
//   {nudge}    // <-- render at the bottom of the screen JSX (now null)
//
// Post-pivot only 'banned' and 'restricted' can block an action — the
// dating-era reasons (survey/tier/balance/rate-limit) are gone with
// swiping, calls and paid consumables. The survey-nudge modal and the
// AccessibilitySurvey screen went with the redesign; `nudge` stays in
// the return shape (as null) so call sites keep rendering `{nudge}`
// without churn.

import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { checkActionAllowed, REASON_COPY } from '../utils/eligibility';
import { useAuth } from '../auth';

export function useEligibility() {
  const { user, logout } = useAuth();
  const lastVerdictRef = useRef(null);

  /**
   * Returns true if the action is allowed, false otherwise. On false,
   * the appropriate UI is automatically shown (alert for
   * restricted/banned).
   *
   * Pass `silent: true` to suppress UI and just inspect `lastVerdict()`.
   */
  const gate = useCallback((action, opts = {}) => {
    const verdict = checkActionAllowed({ user, action });
    lastVerdictRef.current = verdict;
    if (verdict.ok) return true;

    if (opts.silent) return false;

    switch (verdict.reason) {
      case 'banned':
        Alert.alert(REASON_COPY.banned.title, REASON_COPY.banned.body, [
          { text: 'Sign out', onPress: () => logout?.() },
        ]);
        break;
      case 'restricted':
        Alert.alert(REASON_COPY.restricted.title, REASON_COPY.restricted.body);
        break;
      default:
        break;
    }
    return false;
  }, [logout, user]);

  const lastVerdict = useCallback(() => lastVerdictRef.current, []);

  return { gate, lastVerdict, nudge: null };
}
