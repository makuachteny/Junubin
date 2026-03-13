import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { useNotifications } from '../utils/useNotifications';

// Mock notifications module
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

  it('does not register for notifications when not authenticated', () => {
    const navRef = { current: null };
    renderHook(() => useNotifications(navRef, false));
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('registers for notifications when authenticated', () => {
    const navRef = { current: null };
    renderHook(() => useNotifications(navRef, true));
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  it('sets up notification listeners', () => {
    const navRef = { current: null };
    renderHook(() => useNotifications(navRef, true));
    expect(mockAddResponseListener).toHaveBeenCalledTimes(1);
    expect(mockAddReceivedListener).toHaveBeenCalledTimes(1);
  });
});
