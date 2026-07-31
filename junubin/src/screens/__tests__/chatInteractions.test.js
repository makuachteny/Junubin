import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ChatScreen from '../ChatScreen';

const mockUseTheme = jest.fn();
const mockUseSubscription = jest.fn();
const mockUseAuth = jest.fn();

jest.mock('../../theme', () => {
  const actual = jest.requireActual('../../theme');
  return {
    ...actual,
    useTheme: () => mockUseTheme(),
  };
});

jest.mock('../../payments', () => ({
  useSubscription: () => mockUseSubscription(),
}));

jest.mock('../../auth', () => ({
  useAuth: () => mockUseAuth(),
  useRequireAuth: () => (() => true),
}));

jest.mock('../../hooks', () => ({
  useCurrentUser: () => ({ currentUser: { id: 'me', preferences: {}, settings: {} }, loading: false, isAuthenticated: true }),
  useEligibility: () => ({ gate: () => true, lastVerdict: () => null, nudge: null }),
}));

// Chat is text + images only. connectionService is reached from the
// overflow menu's "Remove connection" action; stub it so the screen
// renders without a Supabase client.
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
    emitTypingStart: jest.fn(),
    emitTypingStop: jest.fn(),
    emitReadReceipt: jest.fn(),
    joinConversation: jest.fn(),
    leaveConversation: jest.fn(),
  }),
}));

jest.mock('../../api/services/chatService', () => ({
  getMessages: jest.fn(async () => []),
  sendMessage: jest.fn(async () => ({ id: 'sent-1' })),
  sendImageMessage: jest.fn(async () => ({ id: 'img-1', url: 'https://example.com/i.jpg' })),
  toggleReaction: jest.fn(async () => ({ added: true })),
  getReactions: jest.fn(async () => ({})),
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

jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(async () => ({
        sound: {
          pauseAsync: jest.fn(),
          playAsync: jest.fn(),
        },
      })),
    },
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
    setAudioModeAsync: jest.fn(async () => {}),
    Recording: {
      createAsync: jest.fn(async () => ({
        recording: {
          stopAndUnloadAsync: jest.fn(async () => {}),
          getURI: jest.fn(() => 'file://mock-audio.m4a'),
          getStatusAsync: jest.fn(async () => ({ durationMillis: 1000 })),
        },
      })),
      RecordingOptionsPresets: { HIGH_QUALITY: {} },
    },
  },
}));

describe('Chat interactive actions', () => {
  let alertSpy;

  beforeEach(() => {
    jest.useFakeTimers();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
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
    mockUseSubscription.mockReturnValue({
      hasTier: () => true,
      effectiveTier: 'plus',
      promoTier: null,
      promoEndsAt: null,
      coins: 200,
      adsEnabled: true,
      consumeCoins: () => true,
      consumeWhisper: jest.fn(),
      addCoins: jest.fn(),
      addSpotlights: jest.fn(),
      addSuperLikes: jest.fn(),
      addWhispers: jest.fn(),
      setAdsEnabled: jest.fn(),
      grantPromoTier: jest.fn(),
    });
    mockUseAuth.mockReturnValue({
      session: null,
      user: { id: 'u1', name: 'Me' },
    });
  });

  afterEach(() => {
    alertSpy.mockRestore();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  // Mini Game (Quick Pick) and Co-watch / Co-listen UI removed in v1 strip; tests deleted.

  // Chat is text + images only. These two cases lock that in: the
  // composer must not offer voice, and the action row must not offer
  // gifts or games. If someone re-adds a mic or a call button, the
  // queries below start finding it and these fail.
  it('composer offers no voice note or call affordance', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const match = { id: 'm1', name: 'Asha', images: ['https://example.com/a.jpg'] };
    const route = { params: { match } };
    const { queryByTestId } = render(
      <ChatScreen navigation={navigation} route={route} />
    );

    expect(queryByTestId('chat-mic')).toBeNull();
    expect(queryByTestId('chat-send')).toBeTruthy();
    expect(navigation.navigate).not.toHaveBeenCalledWith('Call', expect.anything());

    // Flush mount-time getMessages()/markConversationRead() promises.
    await act(async () => {});
  });

  it('action row offers photo and stickers only, with no upgrade prompt', async () => {
    mockUseSubscription.mockReturnValue({
      hasTier: () => false,
      effectiveTier: 'free',
      promoTier: null,
      promoEndsAt: null,
      coins: 0,
      adsEnabled: true,
      consumeCoins: () => true,
      consumeWhisper: jest.fn(),
      addCoins: jest.fn(),
      addSpotlights: jest.fn(),
      addSuperLikes: jest.fn(),
      addWhispers: jest.fn(),
      setAdsEnabled: jest.fn(),
      grantPromoTier: jest.fn(),
    });
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const route = { params: { match: { id: 'm1', name: 'Asha', images: ['https://example.com/a.jpg'] } } };
    const { getByTestId, queryByTestId } = render(
      <ChatScreen navigation={navigation} route={route} />
    );

    fireEvent.press(getByTestId('chat-plus'));

    expect(getByTestId('chat-photo')).toBeTruthy();
    expect(getByTestId('chat-sticker')).toBeTruthy();
    expect(queryByTestId('chat-gift')).toBeNull();
    expect(queryByTestId('chat-game')).toBeNull();

    // Stickers are free now — there is no tier to upgrade to, so
    // tapping must open the tray rather than raise a paywall alert.
    fireEvent.press(getByTestId('chat-sticker'));
    expect(alertSpy).not.toHaveBeenCalled();
    expect(navigation.navigate).not.toHaveBeenCalledWith('Elite');

    await act(async () => {});
  });

  it('long press text message can add emoji reaction', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const route = { params: { match: { id: 'm1', name: 'Asha', images: ['https://example.com/a.jpg'] } } };
    const { getByPlaceholderText, getByTestId, getByText } = render(
      <ChatScreen navigation={navigation} route={route} />
    );

    fireEvent.changeText(getByPlaceholderText('Type a message...'), 'Hello there');
    await act(async () => {
      fireEvent.press(getByTestId('chat-send'));
    });

    fireEvent(getByText('Hello there'), 'longPress', { nativeEvent: { pageX: 190, pageY: 320 } });
    await act(async () => {
      fireEvent.press(getByTestId('reaction-heart'));
    });

    expect(getByText('❤️')).toBeTruthy();
  });
});
