// Eligibility — single source of truth for "can this user do X?"
//
// Replaces ad-hoc auth/moderation checks scattered across screens with
// one helper. The check order is fixed and matches the server-side
// guards in 00014_safety_eligibility:
//
//   ban  →  restricted
//
// The dating-era gates that used to follow (survey, tier, balance,
// rate-limit) went out with swiping, calls and paid consumables.


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
 *   { id, moderationStatus, subscriptionTier, profile: { surveyCompletedAt, accountPurpose, ... } }
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

  // The dating-era gates (survey-before-swiping, tier-gated calls,
  // consumable balances, daily like limits) are gone with those
  // features — ban and restriction are the only things that block an
  // action now.
  return { ok: true };
}

// ── Profile / survey progress ─────────────────────────────────────────
//
// Walked in the canonical order of ProfileSetupScreen so resumeAt
// returns a step the screen actually knows how to mount.

const STEP_ORDER = [
  // Open to — the multi-select that replaced the Dating/Socialize
  // purpose cards in the community pivot. ProfileSetup still writes
  // accountPurpose ('socialize') alongside the openTo array so every
  // pre-pivot profile stays "complete" here; either satisfies the gate.
  { id: 'purpose',     test: (p) => !!p?.accountPurpose
                                     || (Array.isArray(p?.openTo) && p.openTo.length > 0) },
  { id: 'displayName', test: (p, u) => !!u?.displayName },
  { id: 'dob',         test: (p, u) => !!u?.dateOfBirth },
  // Gender is explicitly optional/skippable in onboarding now, so it
  // is NOT gated here — gating a field the survey lets you skip is
  // what produces a nudge the user can never satisfy.
  //
  // Country IS gated: "where are my South Sudanese people near me or
  // in the city I care about" doesn't work without it, and
  // ProfileSetup requires it to advance. City stays optional.
  { id: 'country',     test: (p, u) => !!u?.countryCode },
  // Photos: ProfileSetup tightened to ≥ 3 photos to ship. Keep the
  // gate in lock-step or users finish setup but the eligibility check
  // immediately bounces them right back here. Previous value (≥ 2)
  // let users through ProfileSetup while still flagging photos
  // incomplete — a quiet inconsistency that surfaced as the survey
  // popup never going away.
  { id: 'photos',      test: (p, u) => (u?.photos?.length || 0) >= 3 },
  // Prompt answer — what ProfileSetup ACTUALLY collects on the
  // "Answer a profile prompt" step. The old `bio` test gated on
  // `Profile.bio`, but ProfileSetup never writes that column (only
  // EditProfile does). Result: bio?.length >= 30 was always false,
  // so the survey-nudge popup kept firing on every dating action no
  // matter how complete the user's setup was. Bio remains an
  // optional "level-up" item via profileCompleteness.js — it's a
  // soft score, not a gate.
  { id: 'prompts', test: (p) => (p?.promptAnswer?.length || 0) >= 10 },
  // Interests — ProfileSetup requires ≥ 3 selections to advance past
  // the interests step. Mirror that gate here so a user whose
  // profile somehow lost the interests column (legacy data, mid-edit
  // crash) gets routed back to the interests step rather than slipping
  // through the eligibility check.
  { id: 'interests', test: (p) => Array.isArray(p?.interests) && p.interests.length >= 3 },
  // NOTE: the dating-only steps (`interestedIn`, `datingIntentions`,
  // `survey`) were removed in the community pivot along with the
  // ProfileSetup steps that collected them. `onlyDating` is still
  // honoured by the walkers below so re-introducing a mode-scoped step
  // stays a one-line change — there just aren't any today.
  //
  // languages / profession / city / locationVisibility are all
  // deliberately absent: every one of them is optional-skippable in
  // ProfileSetup, and gating an optional field here would nudge users
  // toward a step they're allowed to leave blank.
];

/**
 * Returns the id of the first unanswered step, or null if the user is
 * fully set up for the requested mode.
 *
 * `opts.mode` ('dating' | 'social' | undefined): which mode to validate
 * against. When omitted, falls back to the user's stored accountPurpose
 * — the historic behavior. When passed explicitly (e.g. by the
 * eligibility helper for a dating action), it overrides accountPurpose
 * so a Social-onboarded user who toggles to Dating still gets gated on
 * the dating-only fields they haven't filled yet.
 */
export function nextIncompleteStep(profile, user, opts = {}) {
  if (!profile) return 'purpose';
  const modeIsDating = opts.mode === 'dating'
    || (!opts.mode && (
      profile.accountPurpose === 'dating' || profile.accountPurpose === 'both'
    ));
  for (const step of STEP_ORDER) {
    if (step.onlyDating && !modeIsDating) continue;
    if (!step.test(profile, user)) return step.id;
  }
  return null; // fully complete
}

/**
 * Convenience: rough percent-complete for the profile completeness ring.
 * Counts only steps relevant to the user's chosen mode.
 */
export function profilePercentComplete(profile, user, opts = {}) {
  if (!profile) return 0;
  const modeIsDating = opts.mode === 'dating'
    || (!opts.mode && (
      profile.accountPurpose === 'dating' || profile.accountPurpose === 'both'
    ));
  const relevant = STEP_ORDER.filter((s) => !s.onlyDating || modeIsDating);
  if (relevant.length === 0) return 0;
  const done = relevant.filter((s) => s.test(profile, user)).length;
  return Math.round((done / relevant.length) * 100);
}

// Reason → short copy for toasts/nudges. Components can override per-action.
export const REASON_COPY = {
  unauthenticated:    { title: 'Sign in', body: 'Sign in to continue.' },
  banned:             { title: 'Account closed', body: "We've closed this account. Contact support if you think this is a mistake." },
  restricted:         { title: 'Account under review', body: "Some features are paused while we look into a recent report. We'll reach out shortly." },
  blocked:            { title: 'Not available', body: "You can't do that with this person." },
};
