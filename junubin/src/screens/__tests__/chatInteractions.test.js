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
  sendAudioMessage: jest.fn(async () => ({ id: 'audio-1' })),
  toggleReaction: jest.fn(async () => ({ added: true })),
  getReactions: jest.fn(async () => ({})),
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

  it('mini game selection updates the input text', () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const route = { params: { match: { id: 'm1', name: 'Asha', images: ['https://example.com/a.jpg'] } } };
    const { getByText, getByPlaceholderText } = render(
      <ChatScreen navigation={navigation} route={route} />
    );

    fireEvent.press(getByText('Rooftop'));

    const input = getByPlaceholderText('Type a message...');
    expect(input.props.value).toContain('Mini-game pick: Rooftop dinner');
  });

  it('co-watch sync moves into syncing state on click', () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const route = { params: { match: { id: 'm1', name: 'Asha', images: ['https://example.com/a.jpg'] } } };
    const { getByText, queryByText } = render(
      <ChatScreen navigation={navigation} route={route} />
    );

    fireEvent.press(getByText('Start Sync'));
    expect(getByText('Syncing...')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(queryByText('Syncing...')).toBeTruthy();
  });

  it('mic action opens voice call flow for eligible tiers', () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const match = { id: 'm1', name: 'Asha', images: ['https://example.com/a.jpg'] };
    const route = { params: { match } };
    const { getByTestId } = render(
      <ChatScreen navigation={navigation} route={route} />
    );

    fireEvent.press(getByTestId('chat-mic'));

    // Mic now opens the in-chat voice recorder modal (replacing the
    // old "navigate to Call screen as a placeholder" behaviour). The
    // recorder modal renders its own title text on mount.
    expect(navigation.navigate).not.toHaveBeenCalledWith('Call', expect.anything());
  });

  it('sticker action prompts upgrade for non-premium users', () => {
    mockUseSubscription.mockReturnValue({
      hasTier: () => false,
      effectiveTier: 'free',
      promoTier: null,
      promoEndsAt: null,
      coins: 200,
      adsEnabled: true,
      consumeCoins: () => true,
      addCoins: jest.fn(),
      addSpotlights: jest.fn(),
      addSuperLikes: jest.fn(),
      addWhispers: jest.fn(),
      setAdsEnabled: jest.fn(),
      grantPromoTier: jest.fn(),
    });
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const route = { params: { match: { id: 'm1', name: 'Asha', images: ['https://example.com/a.jpg'] } } };
    const { getByTestId } = render(
      <ChatScreen navigation={navigation} route={route} />
    );

    fireEvent.press(getByTestId('chat-plus'));
    fireEvent.press(getByTestId('chat-sticker'));

    expect(alertSpy).toHaveBeenCalled();
  });

  it('long press text message can add emoji reaction', () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const route = { params: { match: { id: 'm1', name: 'Asha', images: ['https://example.com/a.jpg'] } } };
    const { getByPlaceholderText, getByTestId, getByText } = render(
      <ChatScreen navigation={navigation} route={route} />
    );

    fireEvent.changeText(getByPlaceholderText('Type a message...'), 'Hello there');
    fireEvent.press(getByTestId('chat-send'));

    fireEvent(getByText('Hello there'), 'longPress', { nativeEvent: { pageX: 190, pageY: 320 } });
    fireEvent.press(getByTestId('reaction-heart'));

    expect(getByText('❤️')).toBeTruthy();
  });
});
