const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

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
      backgroundColor: '#1C1917',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: false,
      bundleIdentifier: getBundleId(),
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#1C1917',
      },
      package: getBundleId(),
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: ['expo-font', 'expo-asset'],
    extra: {
      eas: {
        projectId: process.env.EAS_PROJECT_ID || 'YOUR_EAS_PROJECT_ID',
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
    },
    updates: {
      url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID || 'YOUR_EAS_PROJECT_ID'}`,
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
  },
};
