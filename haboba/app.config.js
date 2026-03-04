const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';
const IS_PROD = process.env.APP_VARIANT === 'production';
const PLACEHOLDER_PROJECT_ID = 'YOUR_EAS_PROJECT_ID';
const easProjectId = process.env.EAS_PROJECT_ID || PLACEHOLDER_PROJECT_ID;
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (IS_PROD) {
  const missing = [];
  if (!process.env.EAS_PROJECT_ID || easProjectId === PLACEHOLDER_PROJECT_ID) missing.push('EAS_PROJECT_ID');
  if (!supabaseUrl) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (missing.length > 0) {
    throw new Error(`[JuNubin] Missing required production env vars: ${missing.join(', ')}`);
  }
}

const getAppName = () => {
  if (IS_DEV) return 'JuNubin (Dev)';
  if (IS_PREVIEW) return 'JuNubin (Preview)';
  return 'JuNubin';
};

const getBundleId = () => {
  if (IS_DEV) return 'com.haboba.app.dev';
  if (IS_PREVIEW) return 'com.haboba.app.preview';
  return 'com.haboba.app';
};

export default {
  expo: {
    name: getAppName(),
    slug: 'junubin',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#000000',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: false,
      bundleIdentifier: getBundleId(),
      infoPlist: {
        NSCameraUsageDescription: 'JuNubin needs camera access for photo verification and stories.',
        NSMicrophoneUsageDescription: 'JuNubin needs microphone access for voice notes and calls.',
        NSPhotoLibraryUsageDescription: 'JuNubin needs photo library access to share photos in chat and stories.',
        UIBackgroundModes: ['remote-notification'],
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#000000',
      },
      package: getBundleId(),
      permissions: [
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
        'android.permission.POST_NOTIFICATIONS',
      ],
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-font',
      'expo-asset',
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#0095F6',
          defaultChannel: 'default',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'JuNubin needs photo library access to share photos in chat and stories.',
          cameraPermission: 'JuNubin needs camera access for photo verification and stories.',
        },
      ],
      [
        'expo-av',
        {
          microphonePermission: 'Allow JuNubin to access your microphone for voice notes.',
        },
      ],
    ],
    extra: {
      eas: {
        projectId: easProjectId,
      },
      supabaseUrl,
      supabaseAnonKey,
    },
    updates: {
      url: `https://u.expo.dev/${easProjectId}`,
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
  },
};
