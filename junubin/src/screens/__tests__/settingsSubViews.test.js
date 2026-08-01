// Settings — flattened screen + in-screen sub-views (redesign).
// Covers: the main sections, the header title swap per sub-view,
// back-pops-sub-view-first, and each sub-view's key affordances.
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import SettingsScreen from '../SettingsScreen';

const mockUseTheme = jest.fn();
const mockUseAuth = jest.fn();
const mockUseSubscription = jest.fn();
const mockUseCurrentUser = jest.fn();

jest.mock('../../theme', () => {
  const actual = jest.requireActual('../../theme');
  return {
    ...actual,
    useTheme: () => mockUseTheme(),
  };
});

jest.mock('../../auth', () => ({
  useAuth: () => mockUseAuth(),
  useRequireAuth: () => (() => true),
}));

jest.mock('../../payments', () => {
  const actual = jest.requireActual('../../payments');
  return {
    ...actual,
    useSubscription: () => mockUseSubscription(),
  };
});

jest.mock('../../hooks', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
  useEligibility: () => ({ gate: () => true, lastVerdict: () => null, nudge: null }),
}));

jest.mock('../../api/services/profileService', () => ({
  updateProfile: jest.fn(async () => ({})),
}));

jest.mock('../../api/services/safetyService', () => ({
  unblockUser: jest.fn(async () => ({})),
}));

// The per-category toggles gate on the OS permission when flipping on.
jest.mock('../../utils/notifications', () => ({
  getNotificationPermissionStatus: jest.fn(async () => 'granted'),
  promptForPushPermission: jest.fn(async () => 'token'),
}));

jest.mock('../../utils/permissionAlert', () => ({
  promptToOpenSettings: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const THEME = {
  isDark: false,
  toggleTheme: jest.fn(),
  colors: {
    cream: '#FDFCFA',
    creamDark: '#F4F1EA',
    white: '#FFFFFF',
    black: '#252A30',
    gray300: '#CFCFCF',
    gray400: '#A0A0A0',
    gray500: '#666666',
    accent: '#0F8FD6',
    accentDark: '#0B6EA6',
    accentSurface: 'rgba(15,143,214,0.10)',
    separator: '#E7E2D8',
    error: '#D94A4A',
    ssGold: '#F0B41F',
    onGold: '#241B03',
  },
};

const SUBSCRIPTION = { reset: jest.fn(async () => {}) };

const renderSettings = ({ profile = {}, verified = false } = {}) => {
  mockUseCurrentUser.mockReturnValue({
    currentUser: { verified, profile },
  });
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  const utils = render(<SettingsScreen navigation={navigation} />);
  return { navigation, ...utils };
};

describe('Settings — flattened main view', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue(THEME);
    mockUseSubscription.mockReturnValue(SUBSCRIPTION);
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'auth-1' } },
      logout: jest.fn(async () => {}),
    });
  });

  it('renders the three sections and the account rows', async () => {
    const { getByText } = renderSettings();
    await act(async () => {});

    expect(getByText('Settings')).toBeTruthy();
    expect(getByText('LOCATION VISIBILITY')).toBeTruthy();
    expect(getByText('APPEARANCE')).toBeTruthy();
    expect(getByText('ACCOUNT & SAFETY')).toBeTruthy();

    // Design's visibility copy on the app's real values.
    expect(getByText('Everyone on JuNubin')).toBeTruthy();
    expect(getByText('City only')).toBeTruthy();
    expect(getByText('Nobody')).toBeTruthy();

    expect(getByText('Dark mode')).toBeTruthy();
    expect(getByText('Verify your photo')).toBeTruthy();
    expect(getByText('Blocked people')).toBeTruthy();
    expect(getByText('Notifications')).toBeTruthy();
    expect(getByText('Help, terms & safety')).toBeTruthy();
    expect(getByText('Log out')).toBeTruthy();
    expect(getByText('Delete account')).toBeTruthy();
  });

  it('marks the verify row done when the account is verified', async () => {
    const { getByText } = renderSettings({ verified: true });
    await act(async () => {});
    expect(getByText('Verify your photo — done ✓')).toBeTruthy();
  });

  it('back closes the screen from the main view', async () => {
    const { navigation, getByLabelText } = renderSettings();
    await act(async () => {});
    fireEvent.press(getByLabelText('Back'));
    expect(navigation.goBack).toHaveBeenCalled();
  });
});

describe('Settings — sub-views', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue(THEME);
    mockUseSubscription.mockReturnValue(SUBSCRIPTION);
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'auth-1' } },
      logout: jest.fn(async () => {}),
    });
  });

  it('verify: shows the copy and routes the gold CTA to PhotoVerification', async () => {
    const { navigation, getByText, queryByText } = renderSettings();
    await act(async () => {});

    fireEvent.press(getByText('Verify your photo'));
    // Header title swaps; main sections leave.
    expect(getByText('Verify your photo')).toBeTruthy();
    expect(queryByText('LOCATION VISIBILITY')).toBeNull();
    expect(getByText(/A quick selfie proves you're a real person/)).toBeTruthy();

    fireEvent.press(getByText('TAKE VERIFICATION SELFIE'));
    expect(navigation.navigate).toHaveBeenCalledWith('PhotoVerification');
  });

  it('verify: shows the verified chip instead of the CTA when verified', async () => {
    const { getByText, queryByText } = renderSettings({ verified: true });
    await act(async () => {});

    fireEvent.press(getByText('Verify your photo — done ✓'));
    expect(getByText("You're verified")).toBeTruthy();
    expect(queryByText('TAKE VERIFICATION SELFIE')).toBeNull();
  });

  it('blocked: shows the empty copy when nobody is blocked', async () => {
    const { getByText } = renderSettings();
    await act(async () => {});

    fireEvent.press(getByText('Blocked people'));
    await act(async () => {});
    expect(getByText(/You haven't blocked anyone/)).toBeTruthy();
  });

  it('notifications: renders the four toggles and the push-only note', async () => {
    const { getByText, getByTestId } = renderSettings();
    await act(async () => {});

    fireEvent.press(getByText('Notifications'));
    await act(async () => {});

    expect(getByText('Message requests')).toBeTruthy();
    expect(getByText('New messages')).toBeTruthy();
    expect(getByText('New followers')).toBeTruthy();
    expect(getByText('People-nearby digest')).toBeTruthy();
    expect(getByText(/Push only — JuNubin never emails or texts you/)).toBeTruthy();

    // Toggling flips the switch state without crashing.
    await act(async () => {
      fireEvent.press(getByTestId('notif-requests'));
    });
    expect(getByTestId('notif-requests').props.accessibilityState.checked).toBe(false);
  });

  it('help: routes each row to its SettingsInfo page', async () => {
    const { navigation, getByText } = renderSettings();
    await act(async () => {});

    fireEvent.press(getByText('Help, terms & safety'));
    const expectations = [
      ['FAQ', 'faq'],
      ['Contact us', 'contact'],
      ['Terms of use', 'terms'],
      ['Privacy policy', 'privacy'],
      ['Community guidelines', 'guidelines'],
      ['Safety tips', 'safety'],
    ];
    expectations.forEach(([label, pageKey]) => {
      fireEvent.press(getByText(label));
      expect(navigation.navigate).toHaveBeenCalledWith('SettingsInfo', { pageKey });
    });
  });

  it('delete: shows the warning card and Cancel returns to the main view', async () => {
    const { getByText } = renderSettings();
    await act(async () => {});

    fireEvent.press(getByText('Delete account'));
    expect(getByText("This can't be undone")).toBeTruthy();
    expect(getByText(/deleted within 24 hours/)).toBeTruthy();
    expect(getByText('Delete my account')).toBeTruthy();

    fireEvent.press(getByText('Cancel'));
    expect(getByText('LOCATION VISIBILITY')).toBeTruthy();
  });

  it('back pops the sub-view before closing the screen', async () => {
    const { navigation, getByText, getByLabelText } = renderSettings();
    await act(async () => {});

    fireEvent.press(getByText('Blocked people'));
    await act(async () => {});
    fireEvent.press(getByLabelText('Back'));
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(getByText('LOCATION VISIBILITY')).toBeTruthy();

    fireEvent.press(getByLabelText('Back'));
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
