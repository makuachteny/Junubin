// Centralized permission-denial alert helper.
//
// iOS denials are permanent — re-requesting just resolves with the
// same `denied` status without showing the OS dialog again. So when
// we hit a denial we have to point the user at Settings. Android is
// kinder (it'll re-prompt up to twice), but the user-side action is
// the same: open Settings, flip the toggle, come back.
//
// Usage:
//   import { promptToOpenSettings } from '../utils/permissionAlert';
//   if (status !== 'granted') {
//     promptToOpenSettings({
//       title: 'Photo access needed',
//       message: 'JuNubin needs photo access to add images to your post.',
//     });
//     return;
//   }

import { Alert, Linking, Platform } from 'react-native';

// In-memory deduper. Two paths often race the same prompt — e.g. the
// user taps "Take Photo" twice in quick succession while the camera
// permission check is in flight, surfacing the settings prompt
// twice. We collapse identical prompts within a short window so the
// user never sees stacked, duplicate dialogs.
const _lastPromptAt = new Map(); // key: title → ts
const DEDUP_WINDOW_MS = 1500;

function shouldShow(title) {
  const last = _lastPromptAt.get(title) || 0;
  const now = Date.now();
  if (now - last < DEDUP_WINDOW_MS) return false;
  _lastPromptAt.set(title, now);
  return true;
}

export function promptToOpenSettings({ title, message } = {}) {
  const t = title || 'Permission needed';
  if (!shouldShow(t)) return;
  Alert.alert(
    t,
    message || 'You can enable this in Settings.',
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          // Linking.openSettings opens the app's settings page on
          // iOS. On Android it opens the OS-level app info screen
          // (close enough — the user can tap into Permissions from
          // there). Wrapped in try/catch because openSettings can
          // reject on devices where the deep link isn't supported.
          try {
            Linking.openSettings();
          } catch {
            if (Platform.OS === 'android') {
              Linking.openURL('package:com.junubin').catch(() => {});
            }
          }
        },
      },
    ],
  );
}

/**
 * Smart permission request — checks current status first and only
 * prompts when the OS will actually surface a dialog. Avoids the
 * common "tap → silently denied → confused user" trap.
 *
 * `checker` is the SDK's getPermissionsAsync; `requester` is the
 * matching requestPermissionsAsync. Returns the final status.
 *
 * Use:
 *   const status = await ensurePermission({
 *     checker: ImagePicker.getMediaLibraryPermissionsAsync,
 *     requester: ImagePicker.requestMediaLibraryPermissionsAsync,
 *     deniedTitle: 'Photo access needed',
 *     deniedMessage: 'Enable photo access in Settings to share photos.',
 *   });
 *   if (status !== 'granted') return;
 */
export async function ensurePermission({
  checker,
  requester,
  deniedTitle,
  deniedMessage,
} = {}) {
  if (typeof checker !== 'function' || typeof requester !== 'function') {
    return 'undetermined';
  }

  // Check first — if already granted, no prompt at all.
  try {
    const existing = await checker();
    if (existing?.status === 'granted') return 'granted';

    // If iOS has permanently denied (canAskAgain === false), don't
    // call requester — it will silently resolve denied. Jump straight
    // to the Settings prompt so the user has an actionable next step.
    if (existing?.canAskAgain === false) {
      promptToOpenSettings({ title: deniedTitle, message: deniedMessage });
      return existing.status;
    }

    // Otherwise request — this will show the OS dialog.
    const next = await requester();
    if (next?.status === 'granted') return 'granted';

    promptToOpenSettings({ title: deniedTitle, message: deniedMessage });
    return next?.status || 'denied';
  } catch (e) {
    // Permission API failure (rare) — fall back to a denied prompt
    // so the user isn't stuck silently.
    promptToOpenSettings({ title: deniedTitle, message: deniedMessage });
    return 'denied';
  }
}
