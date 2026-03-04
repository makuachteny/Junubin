// AnaJunubin — Screenshot Protection Hook
import { useEffect } from 'react';
import * as ScreenCapture from 'expo-screen-capture';

export function useScreenshotProtection() {
  useEffect(() => {
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    return () => {
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
    };
  }, []);
}
