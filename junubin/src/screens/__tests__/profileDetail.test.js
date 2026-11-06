// Person detail (ProfileDetailScreen) — redesign coverage.
// Layout: hero photo → name/age + verified → Follow/Message actions →
// OPEN TO tags → ABOUT facts grid. Behavior under test: follow toggle,
// direct-chat vs request-composer routing, self-preview mode, and the
// report/block overflow.
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ProfileDetailScreen from '../ProfileDetailScreen';

const mockUseFollow = jest.fn();
const mockToggleFollow = jest.fn();
const mockCanMessageDirectly = jest.fn(async () => false);
const mockGetConnectionState = jest.fn(async () => ({ requestStatus: 'none' }));
const mockGetOrCreateDirectConversation = jest.fn(async () => 'conv-9');
const mockSendMessageRequest = jest.fn(async () => ({ status: 'pending' }));

jest.mock('../../theme', () => {
  const actual = jest.requireActual('../../theme');
  return {
    ...actual,
    useTheme: () => ({ colors: actual.LightPalette, isDark: false }),
  };
});

jest.mock('../../auth', () => ({
  useAuth: () => ({ session: { user: { id: 'me' } } }),
  useRequireAuth: () => (() => true),
}));

jest.mock('../../hooks', () => ({
  useCurrentUser: () => ({ currentUser: { id: 'me' } }),
  useEligibility: () => ({ gate: () => true, lastVerdict: () => null, nudge: null }),
}));

jest.mock('../../hooks/useFollow', () => ({
  useFollow: (...args) => mockUseFollow(...args),
}));

jest.mock('../../api/services/connectionService', () => ({
  getConnectionState: (...args) => mockGetConnectionState(...args),
  canMessageDirectly: (...args) => mockCanMessageDirectly(...args),
}));

jest.mock('../../api/services/chatService', () => ({
  getOrCreateDirectConversation: (...args) => mockGetOrCreateDirectConversation(...args),
}));

jest.mock('../../api/services/messageRequestService', () => ({
  sendMessageRequest: (...args) => mockSendMessageRequest(...args),
}));

jest.mock('../../api/services/safetyService', () => ({
  reportUser: jest.fn(async () => ({})),
  blockUser: jest.fn(async () => ({})),
}));

// The composer is its own tested component — here it only needs to
// reveal whether the screen opened it.
jest.mock('../../components/MessageRequestComposer', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return ({ visible }) => (visible ? React.createElement(Text, null, 'composer-open') : null);
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const baseProfile = {
  id: 'peer-1',
  name: 'Nyah',
  age: 26,
  verified: true,
  city: 'Nairobi',
  countryCode: 'KE',
  distance: 2,
  ethnicity: 'Dinka',
  languages: ['Juba Arabic', 'English'],
  openTo: ['community', 'mentorship'],
  profession: 'Nurse',
  education: 'KU',
  photos: ['https://example.com/nyah.jpg'],
};

const makeNav = () => ({ navigate: jest.fn(), goBack: jest.fn() });
const renderScreen = (params = {}) => {
  const navigation = makeNav();
  const utils = render(
    <ProfileDetailScreen
      navigation={navigation}
      route={{ params: { profile: baseProfile, ...params } }}
    />
  );
  return { navigation, ...utils };
};

describe('ProfileDetailScreen (person detail)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanMessageDirectly.mockImplementation(async () => false);
    mockGetConnectionState.mockImplementation(async () => ({ requestStatus: 'none' }));
    mockUseFollow.mockReturnValue({
      isFollowing: false,
      isFriend: false,
      toggleFollow: mockToggleFollow,
      loading: false,
    });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  it('renders identity, city line, OPEN TO tags and ABOUT facts', async () => {
    const { findByText, getByText } = renderScreen();
    expect(await findByText('Nyah, 26')).toBeTruthy();
    await waitFor(() => expect(mockGetConnectionState).toHaveBeenCalledWith('peer-1'));
    expect(getByText('Nairobi, Kenya · 2.0 km')).toBeTruthy();
    // OPEN TO — canonical labels from the openTo vocabulary
    expect(getByText('OPEN TO')).toBeTruthy();
    expect(getByText('Community')).toBeTruthy();
    expect(getByText('Mentorship')).toBeTruthy();
    // ABOUT facts grid
    expect(getByText('ABOUT')).toBeTruthy();
    expect(getByText('BACKGROUND')).toBeTruthy();
    expect(getByText('Dinka')).toBeTruthy();
    expect(getByText('LANGUAGES')).toBeTruthy();
    expect(getByText('Juba Arabic, English')).toBeTruthy();
    expect(getByText('PROFESSION')).toBeTruthy();
    expect(getByText('Nurse')).toBeTruthy();
    expect(getByText('SCHOOL')).toBeTruthy();
    expect(getByText('KU')).toBeTruthy();
  });

  it('omits ABOUT cells with no data', async () => {
    const { findByText, queryByText } = renderScreen({
      profile: { ...baseProfile, education: '', school: '', ethnicity: '' },
    });
    await findByText('Nyah, 26');
    expect(queryByText('SCHOOL')).toBeNull();
    expect(queryByText('BACKGROUND')).toBeNull();
    expect(queryByText('PROFESSION')).toBeTruthy();
  });

  it('shows Send request + one-request hint for strangers and opens the composer', async () => {
    const { findByText, getByText, queryByText } = renderScreen();
    const sendBtn = await findByText('Send request');
    expect(getByText('One request per person. They see your note before your chat.')).toBeTruthy();
    expect(queryByText('composer-open')).toBeNull();
    fireEvent.press(sendBtn);
    expect(getByText('composer-open')).toBeTruthy();
    expect(mockGetOrCreateDirectConversation).not.toHaveBeenCalled();
  });

  it('shows Message + connected hint and opens the direct conversation when connected', async () => {
    mockCanMessageDirectly.mockImplementation(async () => true);
    const { navigation, findByText, getByText } = renderScreen();
    const msgBtn = await findByText('Message');
    expect(getByText("You're connected — chat away.")).toBeTruthy();
    fireEvent.press(msgBtn);
    await waitFor(() => {
      expect(mockGetOrCreateDirectConversation).toHaveBeenCalledWith('peer-1');
      expect(navigation.navigate).toHaveBeenCalledWith(
        'Chat',
        expect.objectContaining({ conversationId: 'conv-9' })
      );
    });
  });

  it('toggles follow and reflects the following state', async () => {
    const { findByText } = renderScreen();
    fireEvent.press(await findByText('Follow'));
    expect(mockToggleFollow).toHaveBeenCalledTimes(1);

    mockUseFollow.mockReturnValue({
      isFollowing: true,
      isFriend: false,
      toggleFollow: mockToggleFollow,
      loading: false,
    });
    const { findByText: findAgain } = renderScreen();
    expect(await findAgain('Following')).toBeTruthy();
  });

  it('opens the report/block menu from the overflow button', async () => {
    const { findByLabelText } = renderScreen();
    fireEvent.press(await findByLabelText('Report or block'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Nyah',
      null,
      expect.arrayContaining([
        expect.objectContaining({ text: 'Report' }),
        expect.objectContaining({ text: 'Block' }),
      ])
    );
  });

  it('selfPreview hides Follow, Message, the hint and the overflow menu', async () => {
    const { findByText, queryByText, queryByLabelText } = renderScreen({ selfPreview: true });
    expect(await findByText('Nyah, 26')).toBeTruthy();
    expect(queryByText('Follow')).toBeNull();
    expect(queryByText('Message')).toBeNull();
    expect(queryByText('Send request')).toBeNull();
    expect(queryByText('One request per person. They see your note before your chat.')).toBeNull();
    expect(queryByLabelText('Report or block')).toBeNull();
    // Back is still there — a preview must be escapable.
    expect(queryByLabelText('Back')).toBeTruthy();
  });
});
