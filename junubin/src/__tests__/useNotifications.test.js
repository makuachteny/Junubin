import { renderHook } from '@testing-library/react-native';
import { useNotifications } from '../utils/useNotifications';

const mockRegister = jest.fn(() => Promise.resolve(null));
const mockAddResponseListener = jest.fn(() => ({ remove: jest.fn() }));
const mockAddReceivedListener = jest.fn(() => ({ remove: jest.fn() }));

jest.mock('../utils/notifications', () => ({
  registerForPushNotifications: (...args) => mockRegister(...args),
  addNotificationResponseListener: (...args) => mockAddResponseListener(...args),
  addNotificationReceivedListener: (...args) => mockAddReceivedListener(...args),
}));

describe('useNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers for push notifications on mount', () => {
    const navRef = { current: null };
    renderHook(() => useNotifications(navRef));
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  it('sets up response and received listeners', () => {
    const navRef = { current: null };
    renderHook(() => useNotifications(navRef));
    expect(mockAddResponseListener).toHaveBeenCalledTimes(1);
    expect(mockAddReceivedListener).toHaveBeenCalledTimes(1);
  });

  it('cleans up listeners on unmount', () => {
    const removeFn = jest.fn();
    mockAddResponseListener.mockReturnValue({ remove: removeFn });
    mockAddReceivedListener.mockReturnValue({ remove: removeFn });
    const navRef = { current: null };
    const { unmount } = renderHook(() => useNotifications(navRef));
    unmount();
    expect(removeFn).toHaveBeenCalledTimes(2);
  });
});
