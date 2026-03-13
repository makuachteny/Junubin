import { trackEvent, flushEvents, AnalyticsEvents } from '../utils/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('Analytics', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('tracks an event and stores it', async () => {
    await trackEvent('test_event', { key: 'value' });
    const events = await flushEvents();
    expect(events).toHaveLength(1);
    expect(events[0].event).toBe('test_event');
    expect(events[0].properties.key).toBe('value');
    expect(events[0].timestamp).toBeTruthy();
    expect(events[0].sessionId).toBeTruthy();
  });

  it('buffers multiple events', async () => {
    await trackEvent('event_1');
    await trackEvent('event_2');
    await trackEvent('event_3');
    const events = await flushEvents();
    expect(events).toHaveLength(3);
  });

  it('flush clears the buffer', async () => {
    await trackEvent('event_1');
    await flushEvents();
    const events = await flushEvents();
    expect(events).toHaveLength(0);
  });

  it('exports expected event constants', () => {
    expect(AnalyticsEvents.ONBOARDING_PAGE_VIEW).toBe('onboarding_page_view');
    expect(AnalyticsEvents.ONBOARDING_SKIP).toBe('onboarding_skip');
    expect(AnalyticsEvents.ONBOARDING_COMPLETE).toBe('onboarding_complete');
    expect(AnalyticsEvents.SIGNUP_START).toBe('signup_start');
    expect(AnalyticsEvents.SIGNUP_COMPLETE).toBe('signup_complete');
    expect(AnalyticsEvents.PROFILE_SETUP_STEP).toBe('profile_setup_step');
    expect(AnalyticsEvents.PROFILE_SETUP_COMPLETE).toBe('profile_setup_complete');
    expect(AnalyticsEvents.SWIPE).toBe('swipe');
    expect(AnalyticsEvents.MATCH).toBe('match');
    expect(AnalyticsEvents.MESSAGE_SENT).toBe('message_sent');
    expect(AnalyticsEvents.PROFILE_VIEW).toBe('profile_view');
  });

  it('does not crash on storage errors', async () => {
    const spy = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('fail'));
    await expect(trackEvent('test')).resolves.not.toThrow();
    spy.mockRestore();
  });
});
