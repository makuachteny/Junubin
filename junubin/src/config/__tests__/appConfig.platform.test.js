const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../../..');

const readExpoPublicConfig = () => {
  const output = execSync('node_modules/.bin/expo config --type public --json', {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(output);
};

const hasPlugin = (plugins, name) =>
  plugins.some((plugin) => {
    if (typeof plugin === 'string') return plugin === name;
    if (Array.isArray(plugin)) return plugin[0] === name;
    return false;
  });

describe('Expo platform config', () => {
  let config;

  beforeAll(() => {
    config = readExpoPublicConfig();
  });

  it('declares ios and android platforms', () => {
    expect(config.platforms).toEqual(expect.arrayContaining(['ios', 'android']));
  });

  it('has required iOS usage descriptions for feature permissions', () => {
    const infoPlist = config?.ios?.infoPlist || {};
    expect(infoPlist.NSCameraUsageDescription).toBeTruthy();
    expect(infoPlist.NSPhotoLibraryUsageDescription).toBeTruthy();
    expect(infoPlist.NSLocationWhenInUseUsageDescription).toBeTruthy();
  });

  // JuNubin is text-only: nothing records audio, so declaring a
  // microphone purpose string would claim a capability the app never
  // exercises. This locks the pivot in — if a plugin (expo-av,
  // expo-image-picker's microphonePermission) or a config edit
  // re-injects it, this fails.
  it('does not declare a microphone usage description', () => {
    const infoPlist = config?.ios?.infoPlist || {};
    expect(infoPlist.NSMicrophoneUsageDescription).toBeUndefined();
  });

  // Only remote-notification. `voip`/`audio` belonged to the removed
  // Daily.co call stack — App Review checks declared background modes
  // against actual behavior.
  it('declares only the remote-notification background mode', () => {
    const modes = config?.ios?.infoPlist?.UIBackgroundModes || [];
    expect(modes).toEqual(['remote-notification']);
  });

  it('has required Android runtime permissions for core features', () => {
    const permissions = config?.android?.permissions || [];
    expect(permissions).toEqual(
      expect.arrayContaining([
        'android.permission.CAMERA',
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.ACCESS_COARSE_LOCATION',
      ])
    );
  });

  // The app coarsens every coordinate before storage and tells users it
  // never collects precise location; requesting FINE would contradict
  // that and force a "precise location" Play Data Safety entry.
  // RECORD_AUDIO went out with voice notes and calls.
  it('does not request fine location or audio recording permissions', () => {
    const permissions = config?.android?.permissions || [];
    expect(permissions).not.toContain('android.permission.ACCESS_FINE_LOCATION');
    expect(permissions).not.toContain('android.permission.RECORD_AUDIO');
  });

  it('includes plugins needed for notifications and the profile-photo picker', () => {
    const plugins = config.plugins || [];
    expect(hasPlugin(plugins, 'expo-notifications')).toBe(true);
    expect(hasPlugin(plugins, 'expo-image-picker')).toBe(true);
    // expo-av must stay gone — it re-injects mic permissions at prebuild.
    expect(hasPlugin(plugins, 'expo-av')).toBe(false);
  });
});
