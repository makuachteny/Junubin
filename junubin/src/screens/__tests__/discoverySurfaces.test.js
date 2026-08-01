// Smoke + behaviour tests for the two surfaces that replaced the swipe
// deck: Home ("Nearby") and the Directory.
//
// The load-bearing assertion in here is the privacy one: Home must not
// let anything reach `expo-location` until the user has accepted the
// in-app disclosure. If that regresses, the app starts cold-prompting
// for location, which is both a policy violation and a broken promise.

import React from 'react';
import { render, act, fireEvent, waitFor } from '@testing-library/react-native';

import HomeScreen from '../HomeScreen';
import DirectoryScreen from '../DirectoryScreen';

const mockUseTheme = jest.fn();
const mockUseAuth = jest.fn();
const mockUseCurrentUser = jest.fn();
const mockSearchDirectory = jest.fn();
const mockGetItem = jest.fn(async () => null);
const mockSetItem = jest.fn(async () => {});
const mockRequestPermissions = jest.fn(async () => ({ status: 'granted' }));

jest.mock('../../theme', () => {
  const actual = jest.requireActual('../../theme');
  return { ...actual, useTheme: () => mockUseTheme() };
});

jest.mock('../../auth', () => ({
  useAuth: () => mockUseAuth(),
  useRequireAuth: () => (() => true),
}));

jest.mock('../../hooks', () => ({
  useCurrentUser: () => mockUseCurrentUser(),
  useEligibility: () => ({ gate: () => true, lastVerdict: () => null, nudge: null }),
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useFocusEffect: jest.fn() };
});

jest.mock('../../api/services/directoryService', () => ({
  searchDirectory: (...args) => mockSearchDirectory(...args),
}));

jest.mock('../../api/services/followService', () => ({
  checkFollowStatus: jest.fn(async () => new Set()),
  followUser: jest.fn(async () => ({})),
  unfollowUser: jest.fn(async () => ({})),
}));

jest.mock('../../api/services/discoverService', () => ({
  getNearbyUsers: jest.fn(async () => ({ users: [] })),
}));

// The whole point of the disclosure gate: this must never be called
// before the user accepts. Every test asserts on it.
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: (...args) => mockRequestPermissions(...args),
  getLastKnownPositionAsync: jest.fn(async () => null),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 4.85, longitude: 31.6 } })),
  Accuracy: { Balanced: 3 },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (...args) => mockGetItem(...args),
  setItem: (...args) => mockSetItem(...args),
}));

jest.mock('../../utils/haptics', () => ({
  hapticSelection: jest.fn(),
  hapticHeavy: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  ...(() => {
    const React = require('react');
    const insets = { top: 0, bottom: 0, left: 0, right: 0 };
    const frame = { x: 0, y: 0, width: 390, height: 844 };
    const SafeAreaInsetsContext = React.createContext(insets);
    const SafeAreaFrameContext = React.createContext(frame);
    const SafeAreaProvider = ({ children }) => (
      <SafeAreaInsetsContext.Provider value={insets}>
        <SafeAreaFrameContext.Provider value={frame}>{children}</SafeAreaFrameContext.Provider>
      </SafeAreaInsetsContext.Provider>
    );
    return {
      SafeAreaInsetsContext,
      SafeAreaFrameContext,
      SafeAreaProvider,
      useSafeAreaInsets: () => insets,
      useSafeAreaFrame: () => frame,
    };
  })(),
}));

const COLORS = {
  cream: '#F7F2EA', creamDark: '#EDE6DA', white: '#FFFFFF', black: '#111111',
  gray: '#666', gray100: '#F0F0F0', gray200: '#DDD', gray300: '#CCC',
  gray400: '#A0A0A0', gray500: '#888', gray600: '#666', gray700: '#444',
  gray900: '#1A1A1A',
  accent: '#CE1126', accentDark: '#A80E1F',
  accentTint04: '#FEF6F4', accentTint06: '#FEF3F0', accentTint08: '#FEF0EC',
  accentTint10: '#FDE7E1', accentTint12: '#FDDDD5', accentTint15: '#FDD4CA',
  accentTint25: '#FBC0B1',
  surface: '#FFF', surfaceMuted: '#F1F1F1', separator: '#E7E7E7',
  cardBg: '#FFF', cardBorder: '#E0E0E0',
  inputBg: '#F8F8F8', inputBorder: '#E0E0E0',
  tabActive: '#111', tabInactive: '#9A9A9A',
  error: '#CE1126', success: '#009739', rose: '#E84393', gold: '#FCCD12',
};

const PERSON = {
  id: 'u1',
  name: 'Nyandeng',
  city: 'Juba',
  countryCode: 'SS',
  images: ['https://example.com/a.jpg'],
  verified: true,
  languages: ['Dinka', 'Juba Arabic'],
  openTo: ['friendship', 'community'],
  interests: [],
};

const navigation = { navigate: jest.fn(), goBack: jest.fn(), addListener: jest.fn(() => () => {}) };

beforeEach(() => {
  jest.clearAllMocks();
  mockGetItem.mockResolvedValue(null);
  mockRequestPermissions.mockResolvedValue({ status: 'granted' });
  mockSearchDirectory.mockResolvedValue({ people: [PERSON], nextCursor: null });
  mockUseTheme.mockReturnValue({ isDark: false, toggleTheme: jest.fn(), colors: COLORS });
  mockUseAuth.mockReturnValue({
    ready: true, isAuthenticated: true, session: { user: { id: '1' } },
    user: null, logout: jest.fn(), refreshUser: jest.fn(),
  });
  mockUseCurrentUser.mockReturnValue({
    currentUser: { name: 'Me', city: 'Omaha', images: ['https://example.com/me.jpg'], preferences: {} },
  });
});

describe('HomeScreen — people discovery', () => {
  // Industry redesign: the map is full-bleed with floating chrome — no
  // "Nearby" title bar. The city pill + Map|List segment ARE the header.
  it('renders the floating city pill and Map/List segment', async () => {
    const { getByTestId, queryByTestId } = render(
      <HomeScreen navigation={navigation} route={{ params: {} }} />
    );
    await act(async () => {});
    expect(getByTestId('home-city-pill')).toBeTruthy();
    expect(getByTestId('home-view-map')).toBeTruthy();
    expect(getByTestId('home-view-list')).toBeTruthy();
    // No swipe-deck affordances survive on this screen.
    expect(queryByTestId('profile-card')).toBeNull();
  });

  it('does not ask the OS for location before the disclosure is accepted', async () => {
    // Disclosure flag absent from storage → the map must render the
    // in-app explanation and nothing may touch expo-location.
    const { getByTestId } = render(
      <HomeScreen navigation={navigation} route={{ params: {} }} />
    );
    await act(async () => {});
    expect(getByTestId('location-disclosure-accept')).toBeTruthy();
    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });

  it('puts city search and people filters inside the location dropdown', async () => {
    mockGetItem.mockImplementation(async (key) =>
      (key === '@junubin/home_view_mode_v1' ? 'list' : null));
    const { getByTestId, getByText } = render(
      <HomeScreen navigation={navigation} route={{ params: {} }} />
    );
    await act(async () => {});

    await act(async () => {
      fireEvent.press(getByTestId('home-city-pill'));
    });

    expect(getByTestId('home-city-search')).toBeTruthy();
    expect(getByText('Everyone')).toBeTruthy();
    expect(getByText('Verified')).toBeTruthy();
    expect(getByText('Active this week')).toBeTruthy();

    mockSearchDirectory.mockClear();
    await act(async () => {
      fireEvent.press(getByText('Verified'));
    });
    await waitFor(() => expect(mockSearchDirectory).toHaveBeenCalledWith(
      expect.objectContaining({ verifiedOnly: true })
    ));
  });

  it('declining the disclosure drops the user into the list, still without asking the OS', async () => {
    const { getByText, queryByTestId } = render(
      <HomeScreen navigation={navigation} route={{ params: {} }} />
    );
    await act(async () => {});
    await act(async () => {
      fireEvent.press(getByText('Not now — browse the list'));
    });
    await waitFor(() => expect(mockSearchDirectory).toHaveBeenCalled());
    expect(queryByTestId('location-disclosure-accept')).toBeNull();
    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });

  it('list view renders people from the directory', async () => {
    mockGetItem.mockImplementation(async (key) =>
      (key === '@junubin/home_view_mode_v1' ? 'list' : null));
    const { findByText } = render(
      <HomeScreen navigation={navigation} route={{ params: {} }} />
    );
    expect(await findByText('Nyandeng')).toBeTruthy();
  });

  it('tapping a person opens ProfileDetail (ProfileView is gone)', async () => {
    mockGetItem.mockImplementation(async (key) =>
      (key === '@junubin/home_view_mode_v1' ? 'list' : null));
    const { findByText } = render(
      <HomeScreen navigation={navigation} route={{ params: {} }} />
    );
    const row = await findByText('Nyandeng');
    await act(async () => { fireEvent.press(row); });
    expect(navigation.navigate).toHaveBeenCalledWith(
      'ProfileDetail',
      expect.objectContaining({ profile: expect.objectContaining({ id: 'u1' }) }),
    );
  });
});

describe('DirectoryScreen', () => {
  it('renders search, filter chips and numbered blueprint results', async () => {
    const { getByTestId, findByText, getByText } = render(
      <DirectoryScreen navigation={navigation} route={{ params: {} }} />
    );
    expect(getByTestId('directory-search')).toBeTruthy();
    expect(getByTestId('directory-chip-all')).toBeTruthy();
    expect(getByTestId('directory-chip-verified')).toBeTruthy();
    expect(await findByText('Nyandeng')).toBeTruthy();
    // Registry kicker + letterspaced count line from the design.
    expect(getByText('NO. 01 — JUBA')).toBeTruthy();
    expect(getByText('1 PEOPLE IN THE DIASPORA DIRECTORY')).toBeTruthy();
  });

  it('city chip filters by city; tapping it again clears back to Everywhere', async () => {
    const { getByTestId } = render(
      <DirectoryScreen navigation={navigation} route={{ params: {} }} />
    );
    await act(async () => {});
    mockSearchDirectory.mockClear();
    await act(async () => {
      fireEvent.press(getByTestId('directory-chip-Nairobi'));
    });
    await waitFor(() => expect(mockSearchDirectory).toHaveBeenCalledWith(
      expect.objectContaining({ city: 'Nairobi' })
    ));
    mockSearchDirectory.mockClear();
    await act(async () => {
      fireEvent.press(getByTestId('directory-chip-Nairobi'));
    });
    await waitFor(() => expect(mockSearchDirectory).toHaveBeenCalledWith(
      expect.objectContaining({ city: undefined })
    ));
  });

  it('"Verified only" chip maps to the verifiedOnly facet', async () => {
    const { getByTestId } = render(
      <DirectoryScreen navigation={navigation} route={{ params: {} }} />
    );
    await act(async () => {});
    mockSearchDirectory.mockClear();
    await act(async () => {
      fireEvent.press(getByTestId('directory-chip-verified'));
    });
    await waitFor(() => expect(mockSearchDirectory).toHaveBeenCalledWith(
      expect.objectContaining({ verifiedOnly: true })
    ));
  });

  it('tapping a card opens ProfileDetail with the profile', async () => {
    const { getByTestId, findByText } = render(
      <DirectoryScreen navigation={navigation} route={{ params: {} }} />
    );
    await findByText('Nyandeng');
    await act(async () => {
      fireEvent.press(getByTestId('person-card-u1'));
    });
    expect(navigation.navigate).toHaveBeenCalledWith(
      'ProfileDetail',
      expect.objectContaining({ profile: expect.objectContaining({ id: 'u1' }) })
    );
  });

  it('every filter is available — nothing is locked behind a paid tier', async () => {
    const { queryByText } = render(
      <DirectoryScreen navigation={navigation} route={{ params: {} }} />
    );
    await act(async () => {});
    expect(queryByText(/Upgrade/i)).toBeNull();
    expect(queryByText(/JuNubin\+/i)).toBeNull();
  });
});
