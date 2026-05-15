// Demo-mode flag — controls whether the client seeds empty surfaces
// (swipe deck, inbox, likes, feed, stories) with the demo-user
// roster defined in src/data/__dev__/mockProfiles.js.
//
// Why a runtime flag instead of plain `__DEV__`:
//   - TestFlight builds are produced with `--profile production` →
//     `__DEV__` is FALSE on the device. A `__DEV__`-only gate would
//     leave testers staring at empty screens.
//   - We want one switch the operator can flip without re-building
//     when there are enough real users to deprecate the demos.
//
// When to flip this OFF:
//   - Before submitting to App Review.   App reviewers seeing a deck
//     of fake-looking users is a rejection vector.
//   - When real-user signups are dense enough that the discover API
//     reliably returns >0 candidates per query.
//
// Toggling requires a new EAS build — there's no remote config
// fallback yet. If/when we add one, swap this constant for a
// Supabase-backed remote flag and the rest of the app keeps working.
export const DEMO_DATA_ENABLED = true;

// Stable id prefix every demo user / match / like carries. ChatScreen
// uses it to short-circuit network sends + realtime subs so a demo
// conversation behaves like a real one without trying to write
// against a Conversation row that doesn't exist in the DB.
export const DEMO_ID_PREFIX = 'demo_';

export const isDemoId = (id) => typeof id === 'string' && id.startsWith(DEMO_ID_PREFIX);
