import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import ChatScreen from '../ChatScreen';

const mockUseTheme = jest.fn();
const mockUseAuth = jest.fn();
const mockGetMessages = jest.fn(async () => []);

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

jest.mock('../../hooks', () => ({
  useCurrentUser: () => ({ currentUser: { id: 'me', preferences: {}, settings: {} }, loading: false, isAuthenticated: true }),
  useEligibility: () => ({ gate: () => true, lastVerdict: () => null, nudge: null }),
}));

// connectionService is reached from the overflow menu's "Remove
// connection" action; stub it so the screen renders without a
// Supabase client.
jest.mock('../../api/services/connectionService', () => ({
  disconnect: jest.fn(async () => ({ success: true })),
  getConnectionState: jest.fn(async () => ({
    following: false, followedBy: false, isConnected: false, requestStatus: 'none',
  })),
  canMessageDirectly: jest.fn(async () => true),
}));

// ChatScreen calls useFocusEffect for read-receipt persistence; tests
// render outside a NavigationContainer so we stub it to a no-op.
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useFocusEffect: jest.fn() };
});

jest.mock('../../api/hooks/useRealtime', () => ({
  useRealtime: () => ({
    onMessage: () => () => {},
    onTypingStart: () => () => {},
    onTypingStop: () => () => {},
    onReadReceipt: () => () => {},
    emitTypingStart: jest.fn(),
    emitTypingStop: jest.fn(),
    emitReadReceipt: jest.fn(),
    joinConversation: jest.fn(),
    leaveConversation: jest.fn(),
  }),
}));

// Text is the only message kind chatService still supports — the mock
// surface mirrors the real module's exports exactly, so a test (or the
// screen) reaching for sendImageMessage/toggleReaction fails loudly.
jest.mock('../../api/services/chatService', () => ({
  UNSUPPORTED_MESSAGE_TYPE: 'unsupported',
  getMessages: (...args) => mockGetMessages(...args),
  sendMessage: jest.fn(async () => ({ id: 'sent-1' })),
  markConversationRead: jest.fn(async () => 0),
}));

jest.mock('../../utils/useScreenshotProtection', () => ({
  useScreenshotProtection: jest.fn(),
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

describe('Chat interactive actions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetMessages.mockImplementation(async () => []);
    mockUseTheme.mockReturnValue({
      colors: {
        cream: '#F7F2EA',
        white: '#FFFFFF',
        black: '#111111',
        gray: '#666666',
        gray200: '#DDDDDD',
        gray300: '#CFCFCF',
        gray400: '#A0A0A0',
        gray600: '#666666',
        accent: '#F56040',
        accentTint08: '#FDEDE8',
        accentTint10: '#FCE7E1',
      },
    });
    mockUseAuth.mockReturnValue({
      session: null,
      user: { id: 'u1', name: 'Me' },
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  // Chat is text-only. This locks the composer down: no mic, no call
  // button, no plus-button action row (photo / sticker / gift / game
  // all shipped through it once). If someone re-adds any of those
  // affordances, these queries start finding them and the test fails.
  it('composer offers text input and send only', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const match = { id: 'm1', name: 'Asha', images: ['https://example.com/a.jpg'] };
    const route = { params: { match } };
    const { queryByTestId, getByTestId, getByPlaceholderText } = render(
      <ChatScreen navigation={navigation} route={route} />
    );

    expect(getByPlaceholderText('Type a message...')).toBeTruthy();
    expect(getByTestId('chat-send')).toBeTruthy();
    expect(queryByTestId('chat-mic')).toBeNull();
    expect(queryByTestId('chat-plus')).toBeNull();
    expect(queryByTestId('chat-photo')).toBeNull();
    expect(queryByTestId('chat-sticker')).toBeNull();
    expect(navigation.navigate).not.toHaveBeenCalledWith('Call', expect.anything());

    // Flush mount-time getMessages()/markConversationRead() promises.
    await act(async () => {});
  });

  it('sends a plain text message from the composer', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    // A real conversationId is required — ChatScreen refuses to
    // fake-send into a conversationless thread.
    const route = { params: { match: { id: 'm1', name: 'Asha', images: ['https://example.com/a.jpg'] }, conversationId: 'conv-1' } };
    const { getByPlaceholderText, getByTestId, getByText } = render(
      <ChatScreen navigation={navigation} route={route} />
    );

    fireEvent.changeText(getByPlaceholderText('Type a message...'), 'Hello there');
    await act(async () => {
      fireEvent.press(getByTestId('chat-send'));
    });

    expect(getByText('Hello there')).toBeTruthy();
  });

  // Legacy rows (image / audio / gift / game) written by older builds
  // are normalised by chatService to UNSUPPORTED_MESSAGE_TYPE with an
  // empty body. The screen must render a neutral placeholder for them —
  // not an empty bubble, not a crash.
  it('renders a placeholder for legacy non-text messages', async () => {
    mockUseAuth.mockReturnValue({
      session: { user: { id: 'auth-1' } },
      user: { id: 'me', name: 'Me' },
    });
    mockGetMessages.mockImplementation(async () => [
      { id: 'old-1', senderId: 'them', text: '', time: '9:00 AM', type: 'unsupported' },
      { id: 'new-1', senderId: 'them', text: 'still here', time: '9:01 AM', type: 'text' },
    ]);

    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const route = {
      params: {
        match: { id: 'm1', name: 'Asha', images: ['https://example.com/a.jpg'] },
        conversationId: 'conv-1',
      },
    };
    const { getByText } = render(
      <ChatScreen navigation={navigation} route={route} />
    );

    // Flush the mount-time getMessages() promise.
    await act(async () => {});

    expect(getByText('Attachment no longer supported')).toBeTruthy();
    expect(getByText('still here')).toBeTruthy();
  });
});
