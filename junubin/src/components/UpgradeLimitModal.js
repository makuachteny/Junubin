// UpgradeLimitModal — RETIRED.
//
// This was the daily-like-limit paywall: spend your last like, get a
// modal pitching JuNubin+ and Junub. JuNubin has no monetization, no
// upgrade prompts and no daily limits, so the prompt has nothing left
// to say and no condition that could legitimately trigger it —
// `hasUnlimitedLikes()` now returns true for everyone, so the caller's
// guard never fires.
//
// Kept as an inert no-op because HomeScreen (owned by another agent)
// still imports and renders it; this stub keeps that import resolving
// while rendering nothing. Delete this file once no screen references
// it.
//
// Props (`visible`, `tier`, `used`, `onCancel`, `onChoose`) are
// accepted and ignored so existing call sites keep working unchanged.
export default function UpgradeLimitModal() {
  return null;
}
