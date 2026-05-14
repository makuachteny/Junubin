const IS_DEV = process.env.APP_VARIANT === 'development';
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';
const IS_PROD = process.env.APP_VARIANT === 'production';
const easProjectId = process.env.EAS_PROJECT_ID || '1cc13a52-317c-470e-addb-ef68ae3bd0e4';
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (IS_PROD) {
  const missing = [];
  if (!easProjectId) missing.push('EAS_PROJECT_ID');
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
  if (IS_DEV) return 'com.junubin.app.dev';
  if (IS_PREVIEW) return 'com.junubin.app.preview';
  return 'com.junubin.app';
};

export default {
  expo: {
    name: getAppName(),
    slug: 'junubin',
    owner: 'tmakua01',
    // URL scheme for deep links. Required for production builds — without
    // it `junubin://chat/...` etc. crash on cold launch. The dev/preview
    // variants advertise their own schemes so a single device can host all
    // three builds without push notifications routing to the wrong app.
    scheme: IS_DEV ? 'junubin-dev' : IS_PREVIEW ? 'junubin-preview' : 'junubin',
    version: '1.0.1',
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
      // Tell App Store Connect this app does not use non-exempt encryption so
      // TestFlight stops prompting for export-compliance docs on every build.
      // Only TLS / standard HTTPS is used — that is exempt under U.S. EAR.
      config: {
        usesNonExemptEncryption: false,
      },
      infoPlist: {
        // Required permission strings — App Review rejects builds that prompt
        // for a permission without an explanation here.
        NSCameraUsageDescription: 'JuNubin needs camera access to take profile photos, verify your identity, and post stories.',
        NSMicrophoneUsageDescription: 'JuNubin needs microphone access to send voice notes, place voice/video calls, and go live.',
        NSPhotoLibraryUsageDescription: 'JuNubin needs photo library access to upload profile photos and share images in chat and stories.',
        NSPhotoLibraryAddUsageDescription: 'JuNubin saves images you create (e.g. event posters or shared memes) to your photo library only when you tap save.',
        NSLocationWhenInUseUsageDescription: 'JuNubin uses your location to show people nearby and let you tag posts with where they were taken. Location is only collected while you are using the app.',
        NSContactsUsageDescription: 'JuNubin can scan your contacts to find friends who already have an account. Contact data is only used for this lookup and is never shown to other users.',
        NSFaceIDUsageDescription: 'JuNubin can use Face ID to quickly unlock your account on this device.',
        // NSUserTrackingUsageDescription intentionally OMITTED.
        // App Review treats a tracking permission string without the
        // matching ATT prompt at runtime as a rejection vector — and
        // we don't run any cross-app tracking / attribution SDK. Add
        // this back together with `expo-tracking-transparency` and a
        // pre-prompt UI if/when we ever integrate Facebook SDK,
        // AppsFlyer, Branch, etc.
        // Encryption export-compliance flag — set in addition to ios.config so
        // older Expo SDK versions still see it.
        ITSAppUsesNonExemptEncryption: false,
        // `audio` background mode keeps WebRTC audio streams alive when the
        // app is sent to the background mid-call. `voip` was already there
        // for the call-signaling layer and lets PushKit-style VoIP push
        // wake the app for incoming calls. Daily.co's RN SDK requires both.
        UIBackgroundModes: ['remote-notification', 'voip', 'audio'],
      },
      // Privacy policy + support URL surfaced in App Store Connect metadata.
      // App Review will follow these URLs — make sure they are reachable
      // before submitting.
      privacyManifests: {
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
            NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
          },
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
            NSPrivacyAccessedAPITypeReasons: ['C617.1'],
          },
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
            NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
          },
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
            NSPrivacyAccessedAPITypeReasons: ['E174.1'],
          },
        ],
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
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.READ_CONTACTS',
        'android.permission.READ_MEDIA_IMAGES',
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
