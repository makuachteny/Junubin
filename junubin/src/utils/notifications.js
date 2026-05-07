// AnaJunubin — Push Notifications Service
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../config/supabase';

// Persist the Expo push token on the User row so server-side senders
// (match notifications, message notifications, etc.) can target the right
// device. Without this step the token is generated but never reaches the
// backend, so notifications can't be delivered.
async function savePushTokenToServer(token) {
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser || !token) return;
    await supabase
      .from('User')
      .update({ pushToken: token, pushTokenPlatform: Platform.OS })
      .eq('auth_id', authUser.id);
  } catch {
    // Best-effort. If the column doesn't exist yet (migration not applied)
    // or RLS rejects, fail silently — the token is still alive locally and
    // we'll retry next launch.
  }
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Register for push notifications.
//
// Apple App Review explicitly rejects apps that prompt for push
// notification permission immediately on launch — the user must have
// seen *what* notifications they'd be opting into before the OS dialog
// appears. So `registerForPushNotifications` no longer prompts by
// default; it only registers if the user has *already* granted (e.g.
// they opted in via an in-app pre-prompt). For the first OS dialog,
// call `promptForPushPermission()` explicitly from a context that has
// just shown the user a reason — first match, first follow, opening
// settings → notifications, etc.
//
// Pass { prompt: true } to opt back into the legacy "register and
// prompt if needed" behavior — handy from a deliberate user click on
// a notifications setting toggle.
export async function registerForPushNotifications({ prompt = false } = {}) {
  if (!Device.isDevice) {
    if (__DEV__) console.log('[Notifications] Must use physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    if (!prompt) {
      // Passive path — never trigger the OS dialog. The caller will
      // explicitly call promptForPushPermission() when the moment is
      // right.
      return null;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync();
    await savePushTokenToServer(token.data);
    return token.data;
  } catch {
    return null;
  }
}

/**
 * Explicit prompt-and-register entrypoint. Call this from a pre-prompt
 * UI ("Get notified when someone matches with you?") right after a
 * notification-eligible event so the OS dialog has context. Returns
 * the resulting token, or null if the user declined / device can't
 * receive pushes.
 */
export async function promptForPushPermission() {
  return registerForPushNotifications({ prompt: true });
}

export async function getNotificationPermissionStatus() {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export function addNotificationResponseListener(handler) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}

export function addNotificationReceivedListener(handler) {
  return Notifications.addNotificationReceivedListener(handler);
}
