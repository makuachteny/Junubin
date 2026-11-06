# Accessibility QA Matrix

This matrix defines edge-case checks controlled by the onboarding accessibility survey (`AccessibilitySurvey`).

## Survey Options -> Feature Flags

- `highContrast`: stronger secondary text and placeholder contrast.
- `nonColorCues`: text labels added for status cues (e.g., `Unread`, `Read`, `Sent`).
- `largerTouchTargets`: larger hit areas for small controls.
- `reducedMotion`: reduce animation intensity and autoplay timing effects.
- `screenReaderHints`: reserved for additional explicit spoken hints.

## Critical Scenarios

1. Onboarding + Account flow

- New user reaches `AccessibilitySurvey` after OTP verification and before profile setup.
- Saving preferences routes to `ProfileSetup`.
- Skipping survey stores opt-out and routes to `ProfileSetup`.

2. Non-color cue verification

- Messages list shows `Unread` label when thread is unread and `nonColorCues` is enabled.
- Chat sent messages show `Sent`/`Read` labels with `nonColorCues` enabled.

3. Contrast verification

- Chat input placeholder and secondary timestamps become stronger with `highContrast` enabled.
- Message preview/timestamp contrast is stronger in Messages with `highContrast` enabled.

4. Touch target verification

- Chat composer icon buttons and send button expand when `largerTouchTargets` enabled.
- Story reaction chips/input height expand when `largerTouchTargets` enabled.

5. Motion verification

- Onboarding pulse loop is disabled when `reducedMotion` enabled.
- Story reaction animation becomes minimal and less visually intense when `reducedMotion` enabled.

## Regression Gates

- Jest full suite passes.
- Smoke tests pass for onboarding, chat, settings, and app navigator.
- Chat interactions pass (including long-press emoji reactions).