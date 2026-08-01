// Dev auth bypass — lets the phone/OTP flow "just pass" while SMS
// verification is still unimplemented.
//
// When enabled, SignupScreen's flow is unchanged (you still type a
// number, still type six digits) but nothing is sent to Supabase and
// ANY six digits are accepted. AuthContext mints a local session +
// user so the navigator flips to the authenticated stack.
//
// ── Safety ────────────────────────────────────────────────────────
// This is an auth bypass. Shipping it live would let anyone sign in as
// anyone, so it is double-gated: the constant below AND `__DEV__`.
// `__DEV__` is false in any EAS build (dev-client, preview, TestFlight,
// production), so a built binary can never take this path — only a
// local `expo start` / Metro session can. If you need the bypass in a
// TestFlight build for testing, drop the `__DEV__ &&` below, and put it
// back before you submit to App Review.
//
// ── Removing this ─────────────────────────────────────────────────
// Once real phone verification lands: set the constant to false, then
// delete this file and the `devAuthBypassEnabled()` branches in
// src/auth/AuthContext.js. Nothing else imports it.
const DEV_AUTH_BYPASS = true;

export const devAuthBypassEnabled = () =>
  __DEV__ && process.env.NODE_ENV !== 'test' && DEV_AUTH_BYPASS;

// Prefixed @junubin_ so logout()'s bulk key wipe clears it for free.
export const DEV_SESSION_KEY = '@junubin_dev_session';

// Stable id derived from the phone number, so signing in twice with
// the same number resumes the same local identity instead of minting a
// fresh one. Not cryptographic — just a deterministic label.
const devIdForPhone = (phone) =>
  `dev_${String(phone || 'anon').replace(/[^0-9]/g, '') || 'anon'}`;

// Shaped like the pieces of a Supabase session/User row the app
// actually reads: `session.user.id`, and a User with no profile (so a
// dev sign-in lands on ProfileSetup like a brand-new account would).
export const makeDevSession = (phone) => {
  const id = devIdForPhone(phone);
  return {
    session: {
      access_token: `dev-access-token-${id}`,
      token_type: 'bearer',
      user: { id, phone },
    },
    user: {
      id,
      auth_id: id,
      phone,
      displayName: null,
      moderationStatus: 'active',
      isVerified: false,
      profile: null,
      photos: [],
    },
  };
};
