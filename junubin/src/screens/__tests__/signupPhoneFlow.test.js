import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';

import SignupScreen from '../SignupScreen';

const mockUseTheme = jest.fn();
const mockStartOtp = jest.fn();
const mockLoginWithOtp = jest.fn();
const mockDevAuthBypassEnabled = jest.fn();

jest.mock('../../theme', () => {
  const actual = jest.requireActual('../../theme');
  return { ...actual, useTheme: () => mockUseTheme() };
});

jest.mock('../../auth', () => ({
  useAuth: () => ({ startOtp: mockStartOtp, loginWithOtp: mockLoginWithOtp }),
}));

jest.mock('../../utils/analytics', () => ({
  trackEvent: jest.fn(),
  AnalyticsEvents: new Proxy({}, { get: (_, key) => String(key) }),
}));

jest.mock('../../config/devAuth', () => ({
  devAuthBypassEnabled: () => mockDevAuthBypassEnabled(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }) => children,
}));

const COLORS = {
  cream: '#FDFCFA', creamDark: '#F4F1EA', surfaceMuted: '#F4F1EA',
  black: '#252A30', white: '#FFFFFF',
  gray400: '#98938A', gray500: '#77726A',
  accent: '#0F8FD6', accentDark: '#085F91',
  separator: '#E7E2D8', inputBg: '#F4F1EA',
  gold: '#F0B41F', onGold: '#241B03', error: '#D94A4A',
};

const makeNavigation = () => ({
  navigate: jest.fn(),
  replace: jest.fn(),
  goBack: jest.fn(),
  canGoBack: () => true,
});

// Drives the phone step through to the OTP step. Accepts ToS, types
// `number`, sends the code.
const sendCode = async (r, number = '912 345 678') => {
  fireEvent.changeText(r.getByPlaceholderText('912 345 678'), number);
  fireEvent.press(r.getByRole('checkbox'));
  await act(async () => {
    fireEvent.press(r.getByText('SEND CODE'));
  });
};

const typeCode = async (r, code) => {
  for (const d of code) {
    await act(async () => {
      fireEvent.press(r.getByTestId(`keypad-${d}`));
    });
  }
};

describe('SignupScreen — phone OTP flow (Industry redesign)', () => {
  let alertSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({ isDark: false, colors: COLORS });
    mockStartOtp.mockResolvedValue({ message: 'OTP sent' });
    mockLoginWithOtp.mockResolvedValue({ appUser: null });
    mockDevAuthBypassEnabled.mockReturnValue(false);
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('shows the design copy on the phone step', () => {
    const r = render(<SignupScreen navigation={makeNavigation()} />);
    expect(r.getByText("What's your number?")).toBeTruthy();
    expect(r.getByText("We'll text you a code. That's the whole sign-in.")).toBeTruthy();
    expect(r.getByText('Your number is never shown on your profile.')).toBeTruthy();
    expect(r.getByText('+254')).toBeTruthy(); // Kenya default
    expect(r.getByText('SEND CODE')).toBeTruthy();
  });

  it('cycles the country prefix on tap (+254 → +211 → …)', () => {
    const r = render(<SignupScreen navigation={makeNavigation()} />);
    const prefix = r.getByText('+254');
    fireEvent.press(prefix);
    expect(r.getByText('+211')).toBeTruthy();
    fireEvent.press(r.getByText('+211'));
    expect(r.getByText('+256')).toBeTruthy();
  });

  it('composes E.164 with leading zeros stripped', async () => {
    const r = render(<SignupScreen navigation={makeNavigation()} />);
    await sendCode(r, '0912 345 678');
    expect(mockStartOtp).toHaveBeenCalledWith({ phone: '+254912345678' });
  });

  it('gates SEND CODE behind the ToS acceptance checkbox', async () => {
    const r = render(<SignupScreen navigation={makeNavigation()} />);
    fireEvent.changeText(r.getByPlaceholderText('912 345 678'), '912 345 678');
    await act(async () => {
      fireEvent.press(r.getByText('SEND CODE'));
    });
    expect(mockStartOtp).not.toHaveBeenCalled();
  });

  it('rejects an invalid number without calling the service', async () => {
    const r = render(<SignupScreen navigation={makeNavigation()} />);
    await sendCode(r, '12');
    expect(mockStartOtp).not.toHaveBeenCalled();
    expect(r.getByText('Phone number is too short.')).toBeTruthy();
  });

  it('auto-verifies once six keypad digits are entered', async () => {
    const nav = makeNavigation();
    const r = render(<SignupScreen navigation={nav} />);
    await sendCode(r);
    expect(r.getByText('Enter the code')).toBeTruthy();
    expect(r.getByText(/Sent to \+254 912 345 678/)).toBeTruthy();
    await typeCode(r, '123456');
    expect(mockLoginWithOtp).toHaveBeenCalledWith({
      phone: '+254912345678',
      code: '123456',
    });
    // Brand-new account → profile setup.
    expect(nav.replace).toHaveBeenCalledWith('ProfileSetup');
  });

  it('dev auth bypass signs in immediately from SEND CODE', async () => {
    mockDevAuthBypassEnabled.mockReturnValue(true);
    const nav = makeNavigation();
    const r = render(<SignupScreen navigation={nav} />);
    await act(async () => {
      fireEvent.press(r.getByText('SEND CODE'));
    });
    expect(mockStartOtp).toHaveBeenCalledWith({ phone: '+254000000000' });
    expect(mockLoginWithOtp).toHaveBeenCalledWith({
      phone: '+254000000000',
      code: '000000',
    });
    expect(r.queryByText('Enter the code')).toBeNull();
    expect(nav.replace).toHaveBeenCalledWith('ProfileSetup');
  });

  it('dev auth bypass still uses the typed phone when present', async () => {
    mockDevAuthBypassEnabled.mockReturnValue(true);
    const nav = makeNavigation();
    const r = render(<SignupScreen navigation={nav} />);
    fireEvent.changeText(r.getByPlaceholderText('912 345 678'), '0912 345 678');
    await act(async () => {
      fireEvent.press(r.getByText('SEND CODE'));
    });
    expect(mockStartOtp).toHaveBeenCalledWith({ phone: '+254912345678' });
    expect(mockLoginWithOtp).toHaveBeenCalledWith({
      phone: '+254912345678',
      code: '000000',
    });
  });

  it('returning user with a profile is not sent to ProfileSetup', async () => {
    mockLoginWithOtp.mockResolvedValue({
      appUser: { profile: { profileComplete: true } },
    });
    const nav = makeNavigation();
    const r = render(<SignupScreen navigation={nav} />);
    await sendCode(r);
    await typeCode(r, '123456');
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('a network drop does not count as a failed attempt', async () => {
    mockLoginWithOtp.mockRejectedValue(new Error('Network request failed'));
    const r = render(<SignupScreen navigation={makeNavigation()} />);
    await sendCode(r);
    await typeCode(r, '123456');
    expect(alertSpy).toHaveBeenCalledWith(
      'Connection problem',
      expect.stringContaining("doesn't count against your attempts"),
    );
    // Boxes cleared for a clean retype, keypad still live.
    mockLoginWithOtp.mockResolvedValue({ appUser: null });
    await typeCode(r, '654321');
    expect(mockLoginWithOtp).toHaveBeenLastCalledWith({
      phone: '+254912345678',
      code: '654321',
    });
  });

  it('locks the keypad after five wrong codes and Resend re-enables it', async () => {
    mockLoginWithOtp.mockRejectedValue(new Error('Invalid token'));
    const r = render(<SignupScreen navigation={makeNavigation()} />);
    await sendCode(r);
    for (let i = 0; i < 5; i++) {
      await typeCode(r, '111111');
    }
    expect(alertSpy).toHaveBeenCalledWith(
      'Too many incorrect codes',
      expect.any(String),
    );
    expect(mockLoginWithOtp).toHaveBeenCalledTimes(5);

    // Digits are ignored while locked.
    await typeCode(r, '222222');
    expect(mockLoginWithOtp).toHaveBeenCalledTimes(5);

    // Resend issues a fresh code and clears the lockout. (The 30s
    // cooldown interval it starts is cleared by unmount on cleanup.)
    mockLoginWithOtp.mockResolvedValue({ appUser: null });
    await act(async () => {
      fireEvent.press(r.getByText('Resend'));
    });
    expect(mockStartOtp).toHaveBeenCalledTimes(2);
    await typeCode(r, '333333');
    expect(mockLoginWithOtp).toHaveBeenCalledTimes(6);
  });

  it('edit on the OTP step returns to the phone step', async () => {
    const r = render(<SignupScreen navigation={makeNavigation()} />);
    await sendCode(r);
    fireEvent.press(r.getByText('edit'));
    expect(r.getByText("What's your number?")).toBeTruthy();
  });
});
