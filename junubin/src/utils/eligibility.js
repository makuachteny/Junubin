// Eligibility — single source of truth for "can this user do X?"
//
// Replaces ad-hoc auth/moderation checks scattered across screens with
// one helper. The check order is fixed and matches the server-side
// guards in 00014_safety_eligibility:
//
//   ban  →  restricted
//
// Old survey, tier, balance, and rate-limit gates are gone with the
// removed paid mechanics. Moderation is the only hard action gate.


// Things a restricted user can still do — fix their profile, leave the
// app, file a report, block. Everything else is silently disabled.
export const ALLOWED_WHEN_RESTRICTED = new Set([
  'edit_profile',
  'fill_survey',
  'block',
  'report',
  'unmatch',
  'logout',
  'delete_account',
  'view_profile',
  'view_feed',
]);

export function getProfileRecord(userOrProfile) {
  const value = userOrProfile?.profile !== undefined ? userOrProfile.profile : userOrProfile;
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

/**
 * Single eligibility check. Returns:
 *   { ok: true }
 *   { ok: false, reason, ...context }
 *
 * `user` shape:
 *   { id, moderationStatus, profile: { surveyCompletedAt, accountPurpose, ... } }
 *
 * Callers branch on `verdict.reason` to decide which UI to show:
 *   'banned'     → forceSignOut()
 *   'restricted' → restrictedToast()
 */
export function checkActionAllowed({ user, action }) {
  if (!user) return { ok: false, reason: 'unauthenticated' };

  if (user.moderationStatus === 'banned') {
    return { ok: false, reason: 'banned' };
  }

  if (user.moderationStatus === 'restricted' && !ALLOWED_WHEN_RESTRICTED.has(action)) {
    return { ok: false, reason: 'restricted' };
  }

  // Ban and restriction are the only things that block an action now.
  return { ok: true };
}

// ── Profile / survey progress ─────────────────────────────────────────
//
// Walked in the canonical order of ProfileSetupScreen so resumeAt
// returns a step the screen actually knows how to mount.

const STEP_ORDER = [
  // Open to — the multi-select used by community discovery.
  // ProfileSetup still writes accountPurpose for schema compatibility;
  // either value satisfies the gate.
  { id: 'purpose',     test: (p) => !!p?.accountPurpose
                                     || (Array.isArray(p?.openTo) && p.openTo.length > 0) },
  { id: 'displayName', test: (p, u) => !!u?.displayName },
  { id: 'dob',         test: (p, u) => !!u?.dateOfBirth },
  // Gender is explicitly optional/skippable in onboarding now, so it
  // is NOT gated here — gating a field the survey lets you skip is
  // what produces a nudge the user can never satisfy.
  //
  // Photos: the 5-step onboarding (Industry redesign) requires exactly
  // one photo, so the gate is ≥ 1 — keeping it higher would bounce
  // every fresh signup straight back into a nudge for a step the flow
  // never asked for. More photos are a soft profileCompleteness item.
  { id: 'photos',      test: (p, u) => (u?.photos?.length || 0) >= 1 },
  // country / prompts / interests are deliberately NOT gated any more:
  // the 5-step onboarding doesn't collect them (city is skippable,
  // prompts and interests moved to EditProfile via the Profile tab's
  // strength checklist). Gating a field onboarding never asks for
  // produces a nudge the user can't satisfy without detouring into
  // EditProfile — exactly the pattern the redesign removed. They stay
  // soft scores in profileCompleteness.js.
  // languages / profession / city / locationVisibility are all
  // deliberately absent: every one of them is optional-skippable in
  // ProfileSetup, and gating an optional field here would nudge users
  // toward a step they're allowed to leave blank.
];

/**
 * Returns the id of the first unanswered setup step, or null if the
 * user is ready for the current app.
 */
export function nextIncompleteStep(profile, user) {
  if (!profile) return 'purpose';
  for (const step of STEP_ORDER) {
    if (!step.test(profile, user)) return step.id;
  }
  return null; // fully complete
}

/**
 * Convenience: rough percent-complete for the profile completeness ring.
 * Counts the setup steps still required by the current app.
 */
export function profilePercentComplete(profile, user) {
  if (!profile) return 0;
  const done = STEP_ORDER.filter((s) => s.test(profile, user)).length;
  return Math.round((done / STEP_ORDER.length) * 100);
}

// Reason → short copy for toasts/nudges. Components can override per-action.
export const REASON_COPY = {
  unauthenticated:    { title: 'Sign in', body: 'Sign in to continue.' },
  banned:             { title: 'Account closed', body: "We've closed this account. Contact support if you think this is a mistake." },
  restricted:         { title: 'Account under review', body: "Some features are paused while we look into a recent report. We'll reach out shortly." },
  blocked:            { title: 'Not available', body: "You can't do that with this person." },
};
