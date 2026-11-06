// Chats home tab (MessagesScreen) + NotificationsScreen.
//
// Covers the redesign's behavioral surface: the Messages | Requests
// segmented control (count suffix only when pending requests exist),
// inline request cards with Accept → Chat and silent Decline, the
// "You: " preview prefix, and the derived Notifications feed.

import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import MessagesScreen from '../MessagesScreen';
import NotificationsScreen from '../NotificationsScreen';

const mockGetConversations = jest.fn(async () => []);
const mockGetIncomingRequests = jest.fn(async () => []);
const mockGetOutgoingRequests = jest.fn(async () => []);
const mockAcceptRequest = jest.fn(async () => ({ conversationId: 'conv-9' }));
const mockDeclineRequest = jest.fn(async () => ({ success: true }));

jest.mock('../../theme', () => {
  const actual = jest.requireActual('../../theme');
  return {
    ...actual,
    useTheme: () => ({ colors: actual.LightPalette, isDark: false }),
  };
});

// Session must be referentially stable across renders (as the real
// AuthContext guarantees) — fetchInbox keys its identity off it.
const STABLE_SESSION = { user: { id: 'me' } };
jest.mock('../../auth', () => ({
  useAuth: () => ({ session: STABLE_SESSION }),
}));

jest.mock('../../hooks', () => ({
  useCurrentUser: () => ({ currentUser: { id: 'me' } }),
}));

jest.mock('../../accessibility', () => ({
  useAccessibilityPreferences: () => ({ prefs: {} }),
}));

// Tests exercise the real-service path, not the TestFlight demo seed.
jest.mock('../../config/demoData', () => ({ DEMO_DATA_ENABLED: false }));

jest.mock('../../api/hooks/useRealtime', () => ({
  useRealtime: () => ({ onInboxActivity: () => () => {} }),
}));

jest.mock('../../api/services/conversationService', () => ({
  getConversations: (...args) => mockGetConversations(...args),
}));

jest.mock('../../api/services/messageRequestService', () => ({
  getIncomingRequests: (...args) => mockGetIncomingRequests(...args),
  getOutgoingRequests: (...args) => mockGetOutgoingRequests(...args),
  acceptMessageRequest: (...args) => mockAcceptRequest(...args),
  declineMessageRequest: (...args) => mockDeclineRequest(...args),
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useFocusEffect: jest.fn() };
});

jest.mock('../../components/MessageListSkeleton', () => () => null);
jest.mock('../../components/ThemedRefreshControl', () => () => null);

jest.mock('../../utils/haptics', () => ({
  hapticLight: jest.fn(),
  hapticMedium: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Let the fetch promises settle so the loading skeleton gives way to
// the list (real timers — the row entrance animations use rAF).
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const makeNavigation = () => ({
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
});

const CONVOS = [
  {
    id: 'm1',
    conversationId: 'c1',
    name: 'Nyah',
    images: [],
    lastMessage: 'See you there',
    lastMessageMine: true,
    timestamp: '2h',
    unread: false,
    unreadCount: 0,
    updatedAt: '2026-07-30T10:00:00Z',
  },
  {
    id: 'm2',
    conversationId: 'c2',
    name: 'Majok',
    images: [],
    lastMessage: 'Salaam! Long time.',
    lastMessageMine: false,
    timestamp: '1d',
    unread: true,
    unreadCount: 3,
    updatedAt: '2026-07-29T10:00:00Z',
  },
];

const REQUESTS = [
  {
    id: 'r1',
    status: 'pending',
    from: { id: 'u7', name: 'Adut', age: 26, city: 'Kampala', profession: 'Nurse', images: [] },
    message: 'We keep crossing paths — would love to chat.',
    createdAt: '2026-07-31T10:00:00Z',
  },
];

describe('Chats home tab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConversations.mockImplementation(async () => CONVOS);
    mockGetIncomingRequests.mockImplementation(async () => REQUESTS);
    mockGetOutgoingRequests.mockImplementation(async () => []);
  });

  it('renders the header and both segments with the request count', async () => {
    const navigation = makeNavigation();
    const { getByText } = render(<MessagesScreen navigation={navigation} />);
    await flush();

    expect(getByText('Chats')).toBeTruthy();
    expect(getByText('Messages')).toBeTruthy();
    // Count suffix present because one request is pending.
    expect(getByText('Requests (1)')).toBeTruthy();
  });

  it('omits the request count suffix when there are none pending', async () => {
    mockGetIncomingRequests.mockImplementation(async () => []);
    const navigation = makeNavigation();
    const { getByText, queryByText } = render(<MessagesScreen navigation={navigation} />);
    await flush();

    expect(getByText('Requests')).toBeTruthy();
    expect(queryByText(/Requests \(/)).toBeNull();
  });

  it('shows conversation rows with a "You: " prefix only on my last messages', async () => {
    const navigation = makeNavigation();
    const { getByText, queryByText } = render(<MessagesScreen navigation={navigation} />);
    await flush();

    expect(getByText('You: See you there')).toBeTruthy();
    expect(getByText('Salaam! Long time.')).toBeTruthy();
    expect(queryByText('You: Salaam! Long time.')).toBeNull();
    // Unread count pill on Majok's row.
    expect(getByText('3')).toBeTruthy();
  });

  it('renders no preview line for a thread with no messages yet', async () => {
    mockGetConversations.mockImplementation(async () => [
      { ...CONVOS[0], lastMessage: '', lastMessageMine: false },
    ]);
    const navigation = makeNavigation();
    const { getByText, queryByText } = render(<MessagesScreen navigation={navigation} />);
    await flush();

    expect(getByText('Nyah')).toBeTruthy();
    // The design has no placeholder preview — the row just omits the line.
    expect(queryByText(/Say hi/)).toBeNull();
  });

  it('has no separate empty-inbox state — the footer line carries it', async () => {
    mockGetConversations.mockImplementation(async () => []);
    const navigation = makeNavigation();
    const { getByText, queryByText } = render(<MessagesScreen navigation={navigation} />);
    await flush();

    expect(queryByText('No conversations yet')).toBeNull();
    expect(getByText('browse the Directory')).toBeTruthy();
  });

  it('opens the Chat when a conversation row is tapped', async () => {
    const navigation = makeNavigation();
    const { getByText } = render(<MessagesScreen navigation={navigation} />);
    await flush();

    fireEvent.press(getByText('Nyah'));
    expect(navigation.navigate).toHaveBeenCalledWith('Chat', { thread: CONVOS[0] });
  });

  it('footer link switches to the Directory tab', async () => {
    const navigation = makeNavigation();
    const { getByText } = render(<MessagesScreen navigation={navigation} />);
    await flush();

    fireEvent.press(getByText('browse the Directory'));
    expect(navigation.navigate).toHaveBeenCalledWith('DirectoryTab');
  });

  it('bell button opens Notifications', async () => {
    const navigation = makeNavigation();
    const { getByLabelText } = render(<MessagesScreen navigation={navigation} />);
    await flush();

    fireEvent.press(getByLabelText(/Notifications/));
    expect(navigation.navigate).toHaveBeenCalledWith('Notifications');
  });

  it('Requests segment renders inline cards and Accept opens the new Chat', async () => {
    const navigation = makeNavigation();
    const { getByText } = render(<MessagesScreen navigation={navigation} />);
    await flush();

    fireEvent.press(getByText('Requests (1)'));
    expect(getByText(
      "People you're not connected to yet. Accepting starts a chat; declining is silent.",
    )).toBeTruthy();
    expect(getByText('Adut, 26')).toBeTruthy();
    expect(getByText('Kampala · Nurse')).toBeTruthy();
    expect(getByText('“We keep crossing paths — would love to chat.”')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByText('Accept'));
    });
    expect(mockAcceptRequest).toHaveBeenCalledWith('r1');
    expect(navigation.navigate).toHaveBeenCalledWith('Chat', expect.objectContaining({
      conversationId: 'conv-9',
    }));
  });

  it('Decline confirms first, then calls the service silently', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, msg, buttons) => {
      const decline = (buttons || []).find((b) => b.style === 'destructive');
      decline?.onPress?.();
    });
    const navigation = makeNavigation();
    const { getByText } = render(<MessagesScreen navigation={navigation} />);
    await flush();

    fireEvent.press(getByText('Requests (1)'));
    await act(async () => {
      fireEvent.press(getByText('Decline'));
    });
    expect(alertSpy).toHaveBeenCalled();
    expect(mockDeclineRequest).toHaveBeenCalledWith('r1');
    alertSpy.mockRestore();
  });

  it('shows the requests empty state copy when none are pending', async () => {
    mockGetIncomingRequests.mockImplementation(async () => []);
    const navigation = makeNavigation();
    const { getByText } = render(<MessagesScreen navigation={navigation} />);
    await flush();

    fireEvent.press(getByText('Requests'));
    expect(getByText(
      'No pending requests.\nRequests from strangers land here — never straight in your inbox.',
    )).toBeTruthy();
  });
});

describe('Notifications screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConversations.mockImplementation(async () => []);
    mockGetIncomingRequests.mockImplementation(async () => []);
    mockGetOutgoingRequests.mockImplementation(async () => []);
  });

  it('renders the header and empty state, and back goes back', async () => {
    const navigation = makeNavigation();
    const { getByText, getByLabelText } = render(
      <NotificationsScreen navigation={navigation} />,
    );
    await flush();

    expect(getByText('Notifications')).toBeTruthy();
    expect(getByText('Nothing yet')).toBeTruthy();
    fireEvent.press(getByLabelText('Back'));
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('renders unread chats and requests, then opens the right surface', async () => {
    mockGetConversations.mockImplementation(async () => CONVOS);
    mockGetIncomingRequests.mockImplementation(async () => REQUESTS);
    mockGetOutgoingRequests.mockImplementation(async () => [{
      id: 'r2',
      status: 'accepted',
      conversationId: 'conv-accepted',
      respondedAt: '2026-07-31T11:00:00Z',
      to: { id: 'u9', name: 'Bol', images: [] },
    }]);
    const navigation = makeNavigation();
    const { getByLabelText, getByText } = render(
      <NotificationsScreen navigation={navigation} />,
    );
    await flush();

    expect(getByText('Majok')).toBeTruthy();
    expect(getByText(/sent you 3 messages/)).toBeTruthy();
    expect(getByText('Adut')).toBeTruthy();
    expect(getByText(/sent you a message request/)).toBeTruthy();
    expect(getByText('Bol')).toBeTruthy();
    expect(getByText(/accepted your message request/)).toBeTruthy();

    fireEvent.press(getByLabelText(/Majok sent you 3 messages/));
    expect(navigation.navigate).toHaveBeenCalledWith('Chat', expect.objectContaining({
      conversationId: 'c2',
    }));

    fireEvent.press(getByLabelText(/Adut sent you a message request/));
    expect(navigation.navigate).toHaveBeenCalledWith('Main', {
      screen: 'MessagesTab',
      params: { segment: 'requests' },
    });
  });
});
