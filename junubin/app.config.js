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
  // Android Maps blank-tile guard: a production build that ships
  // without the Google Maps key renders the People map as gray with
  // a "For development purposes only" watermark. Treat this as a
  // launch blocker so a missed env var is caught at build time, not
  // by a tester opening the map on day 1.
  if (!process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) {
    missing.push('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (Android maps will be blank without this)');
  }
  if (missing.length > 0) {
    throw new Error(`[JuNubin] Missing required production env vars: ${missing.join(', ')}`);
  }
}

if (!IS_PROD && !process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) {
  // Dev / preview warning only — don't block local builds since
  // developers may not need the map on every iteration.
  console.warn('[JuNubin] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY not set — Android map will show a blank tile.');
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
    version: '1.0.3',
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
        NSMicrophoneUsageDescription: 'JuNubin needs microphone access to send voice notes and place voice/video calls.',
        NSPhotoLibraryUsageDescription: 'JuNubin needs photo library access to upload profile photos and share images in chat and stories.',
        NSPhotoLibraryAddUsageDescription: 'JuNubin saves images you create (e.g. event posters or shared memes) to your photo library only when you tap save.',
        NSLocationWhenInUseUsageDescription: 'JuNubin uses your location to show people nearby and let you tag posts with where they were taken. Location is only collected while you are using the app.',
        NSContactsUsageDescription: 'JuNubin can scan your contacts to find friends who already have an account. Contact data is only used for this lookup and is never shown to other users.',
        // NSFaceIDUsageDescription intentionally OMITTED. Face ID unlock
        // is not implemented — `expo-local-authentication` isn't a
        // dependency and no code calls the LocalAuthentication API.
        // Declaring a purpose string for an API the app never accesses
        // is dead config and a possible App Review flag. Add this back
        // together with `expo-local-authentication` if/when biometric
        // unlock ships.
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
      // Google Maps API key — required for the Android PeopleMap to
      // render real tiles. Without it the map shows a blank gray
      // canvas with a "For development purposes only" watermark —
      // the most common "the map is broken!" report at launch for
      // RN apps using react-native-maps. iOS uses Apple MapKit and
      // needs no key. Get the key from Google Cloud Console with
      // "Maps SDK for Android" enabled, restrict it to the bundle
      // ID + your release / debug SHA-1 fingerprints.
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
        },
      },
      permissions: [
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.READ_CONTACTS',
        'android.permission.READ_MEDIA_IMAGES',
      ],
      // Strip permissions that transitive SDKs (analytics, etc.) merge
      // into the final manifest but that JuNubin does not use. AD_ID is
      // the important one: PostHog and other libs auto-add
      // com.google.android.gms.permission.AD_ID, which forces an
      // "advertising ID" disclosure in the Play Console Data Safety
      // form. JuNubin runs no ads and no ad attribution ("No ads ever",
      // src/payments/products.js), so we block it to keep the Data
      // Safety declaration honest and minimal.
      blockedPermissions: [
        'com.google.android.gms.permission.AD_ID',
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
