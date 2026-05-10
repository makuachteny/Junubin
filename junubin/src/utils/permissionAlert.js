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

export function promptToOpenSettings({ title, message } = {}) {
  Alert.alert(
    title || 'Permission needed',
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
