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
    expect(infoPlist.NSMicrophoneUsageDescription).toBeTruthy();
    expect(infoPlist.NSPhotoLibraryUsageDescription).toBeTruthy();
  });

  it('has required Android runtime permissions for core features', () => {
    const permissions = config?.android?.permissions || [];
    expect(permissions).toEqual(
      expect.arrayContaining([
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
        'android.permission.POST_NOTIFICATIONS',
      ])
    );
  });

  it('includes plugins needed for notifications, media picker, and audio', () => {
    const plugins = config.plugins || [];
    expect(hasPlugin(plugins, 'expo-notifications')).toBe(true);
    expect(hasPlugin(plugins, 'expo-image-picker')).toBe(true);
    expect(hasPlugin(plugins, 'expo-av')).toBe(true);
  });
});
