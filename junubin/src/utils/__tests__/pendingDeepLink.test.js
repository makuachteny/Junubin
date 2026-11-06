import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearPending,
  consumePending,
  pathFromUrl,
  setPending,
  urlRequiresAuth,
} from '../pendingDeepLink';

describe('pendingDeepLink', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('extracts app and universal-link paths without fragments', () => {
    expect(pathFromUrl('junubin://survey?step=photo#ignored')).toBe('survey?step=photo');
    expect(pathFromUrl('https://junubin.app/chat/conv-1#ignored')).toBe('chat/conv-1');
    expect(pathFromUrl('https://example.com/chat/conv-1')).toBeNull();
  });

  it('defers every authenticated deep-link route', () => {
    expect(urlRequiresAuth('junubin://chat/conv-1')).toBe(true);
    expect(urlRequiresAuth('junubin://message-requests')).toBe(true);
    expect(urlRequiresAuth('junubin://survey?step=photo')).toBe(true);
    expect(urlRequiresAuth('junubin://home')).toBe(false);
  });

  it('stores one pending URL and consumes it once', async () => {
    await setPending('junubin://message-requests');

    await expect(consumePending()).resolves.toBe('junubin://message-requests');
    await expect(consumePending()).resolves.toBeNull();
  });

  it('can clear a queued URL without dispatching it', async () => {
    await setPending('junubin://chat/conv-1');
    await clearPending();

    await expect(consumePending()).resolves.toBeNull();
  });
});
