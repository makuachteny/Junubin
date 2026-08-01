// reportError — non-throwing error reporter for the many "should never
// fail, but if it does we want to know" catch blocks across the app.
//
// Replaces silent `catch {}` blocks. Always returns void and never
// throws, so it's safe inside cleanup paths, listeners, and useEffect
// teardown. Three sinks:
//
//   1. __DEV__ console.warn — visible while developing.
//   2. Sentry.captureException — production crash reporter (lazy-loaded
//      so this module is safe to import before App.js wires Sentry).
//   3. Sentry.addBreadcrumb — even when we don't promote the error to
//      a full exception, it lands in the next crash report's trail.
//
// `tag` should be a short stable identifier (`"chat.send"`,
// `"haptics.impact"`) so dashboard searches don't drown in anonymous
// "Error" rows. `extra` is for any context that helps triage.

let _sentry = null;
function getSentry() {
  if (_sentry) return _sentry;
  try {
    // eslint-disable-next-line global-require, import/no-unresolved
    _sentry = require('@sentry/react-native');
  } catch {
    _sentry = null;
  }
  return _sentry;
}

export function reportError(tag, err, extra = undefined) {
  try {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(`[${tag}]`, err?.message || err, extra || '');
    }
    const Sentry = getSentry();
    if (!Sentry) return;
    if (Sentry.addBreadcrumb) {
      Sentry.addBreadcrumb({
        category: 'error',
        message: tag,
        level: 'warning',
        data: { message: err?.message || String(err), ...(extra || {}) },
      });
    }
    if (Sentry.captureException && err instanceof Error) {
      Sentry.captureException(err, { tags: { tag }, extra });
    }
  } catch {
    // reporter must never throw
  }
}

export default reportError;
