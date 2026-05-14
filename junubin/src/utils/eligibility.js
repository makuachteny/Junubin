// Eligibility — single source of truth for "can this user do X?"
//
// Replaces ad-hoc tier/auth checks scattered across HomeScreen,
// ChatScreen, ProfileDetailScreen with one helper. The check order is
// fixed and matches the server-side guards in 00014_safety_eligibility:
//
//   ban  →  restricted  →  survey  →  tier  →  balance  →  rate-limit
//
// Subscription tier never bypasses survey or moderation. That's the
// rule the audit enforced and the place every loophole used to live.

import { ALL_FEATURES_FREE } from '../payments/entitlements';

export const DATING_ACTIONS = new Set([
  'swipe_like',
  'swipe_pass',         // note: pass is technically dating-mode but we
                        //       keep it allowed pre-survey so users can
                        //       browse without committing. Server-side
                        //       try_record_swipe still enforces survey.
  'super_like',
  'like_with_whisper',
  'open_match',
  'call_match',
  'video_call_match',
  'spotlight_self',
]);

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

// Tier required per action. `null` (or absent) = no tier requirement.
//
// Super-likes and whispers are consumables — free users can top up via
// the Elite paywall and use them — so they're not tier-gated; the
// balance check (server-side via try_consume_*) is what enforces them.
// Calls are subscription-only.
export const TIER_REQUIRED = {
  call_match:        'plus',
  video_call_match:  'plus',
};

const TIER_RANK = { free: 0, plus: 1, junub: 2 };
function tierAtLeast(userTier, required) {
  return (TIER_RANK[userTier] ?? 0) >= (TIER_RANK[required] ?? 0);
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
 *   'banned'           → forceSignOut()
 *   'restricted'       → restrictedToast()
 *   'survey_required'  → surveyNudgeModal({ resumeAt: verdict.resumeAt })
 *   'tier_required'    → paywall({ tier: verdict.tier })
 *   'balance_required' → showCoinPurchase()
 *   'rate_limited'     → cooldownToast()
 */
export function checkActionAllowed({ user, action }) {
  if (!user) return { ok: false, reason: 'unauthenticated' };

  if (user.moderationStatus === 'banned') {
    return { ok: false, reason: 'banned' };
  }

  if (user.moderationStatus === 'restricted' && !ALLOWED_WHEN_RESTRICTED.has(action)) {
    return { ok: false, reason: 'restricted' };
  }

  if (DATING_ACTIONS.has(action)) {
    // A dating action implies the user is actively in dating mode for
    // this tap, regardless of their stored accountPurpose. A social-
    // onboarded user who flips the HomeScreen toggle to Dating and
    // tries to like someone still needs to have answered the dating-
    // only fields (sexuality, lookingForGender, intention). Forcing
    // `mode: 'dating'` here makes the step iterator check those
    // fields even when accountPurpose is 'socialize'.
    //
    // The user only sees the nudge when something is *actually*
    // missing — a previously-completed dating user toggling Social→
    // Dating won't get nudged because their dating fields are filled.
    const missing = nextIncompleteStep(user.profile, user, { mode: 'dating' });
    if (missing !== null) {
      return {
        ok: false,
        reason: 'survey_required',
        resumeAt: missing,
        from: action,
      };
    }
  }

  // Free-for-all gate: skip tier requirements while every feature is
  // unlocked. Banned / restricted / survey_required still apply.
  if (!ALL_FEATURES_FREE) {
    const requiredTier = TIER_REQUIRED[action];
    if (requiredTier && !tierAtLeast(user.subscriptionTier, requiredTier)) {
      return { ok: false, reason: 'tier_required', tier: requiredTier };
    }
  }

  return { ok: true };
}

// ── Profile / survey progress ─────────────────────────────────────────
//
// Walked in the canonical order of ProfileSetupScreen so resumeAt
// returns a step the screen actually knows how to mount.

const STEP_ORDER = [
  // Basic identity
  { id: 'purpose',     test: (p) => !!p?.accountPurpose },
  { id: 'displayName', test: (p, u) => !!u?.displayName },
  { id: 'dob',         test: (p, u) => !!u?.dateOfBirth },
  { id: 'gender',      test: (p, u) => !!u?.gender },
  { id: 'photos',      test: (p, u) => (u?.photos?.length || 0) >= 2 },
  // Dating qualifiers (only required if mode includes dating)
  { id: 'interestedIn',     test: (p) => !!p?.lookingForGender,    onlyDating: true },
  { id: 'datingIntentions', test: (p) => !!p?.datingIntentions,    onlyDating: true },
  { id: 'bio',              test: (p) => (p?.bio?.length || 0) >= 30 },
  // Survey block — accessibility/compatibility questions
  { id: 'survey', test: (p) => !!p?.surveyCompletedAt, onlyDating: true },
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
  survey_required:    { title: 'Tell us a little more', body: "Liking and matching work best when we know what you're looking for. Take a minute and we'll match you with people who fit." },
  tier_required:      { title: 'JuNubin+', body: 'This is a JuNubin+ feature.' },
  balance_required:   { title: 'Out of credits', body: "You've used all your credits — top up to keep going." },
  rate_limited:       { title: 'Slow down a sec', body: "You've hit today's limit. Try again tomorrow or upgrade for more." },
  blocked:            { title: 'Not available', body: "You can't do that with this person." },
};
