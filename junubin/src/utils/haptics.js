// AnaJunubin — Centralized Haptic Service
// Wraps expo-haptics with platform guard and error handling.

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const isNative = Platform.OS !== 'web';

export function hapticLight() {
  if (!isNative) return;
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
}

export function hapticMedium() {
  if (!isNative) return;
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
}

export function hapticHeavy() {
  if (!isNative) return;
  try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); } catch {}
}

export function hapticSelection() {
  if (!isNative) return;
  try { Haptics.selectionAsync(); } catch {}
}
