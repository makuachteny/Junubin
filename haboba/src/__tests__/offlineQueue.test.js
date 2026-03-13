import { enqueueAction, processQueue, getQueueLength } from '../utils/offlineQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('Offline Queue', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('enqueues an action', async () => {
    await enqueueAction({ type: 'send_message', content: 'hello' });
    const len = await getQueueLength();
    expect(len).toBe(1);
  });

  it('enqueues multiple actions', async () => {
    await enqueueAction({ type: 'send_message', content: 'hello' });
    await enqueueAction({ type: 'send_message', content: 'world' });
    const len = await getQueueLength();
    expect(len).toBe(2);
  });

  it('adds queuedAt timestamp to actions', async () => {
    await enqueueAction({ type: 'test' });
    const raw = await AsyncStorage.getItem('@haboba_offline_queue');
    const queue = JSON.parse(raw);
    expect(queue[0].queuedAt).toBeTruthy();
    expect(typeof queue[0].queuedAt).toBe('number');
  });

  it('processes all actions and clears queue on success', async () => {
    await enqueueAction({ type: 'a' });
    await enqueueAction({ type: 'b' });
    const handler = jest.fn();
    await processQueue(handler);
    expect(handler).toHaveBeenCalledTimes(2);
    const len = await getQueueLength();
    expect(len).toBe(0);
  });

  it('retains failed actions in queue', async () => {
    await enqueueAction({ type: 'succeed' });
    await enqueueAction({ type: 'fail' });
    const handler = jest.fn(async (action) => {
      if (action.type === 'fail') throw new Error('fail');
    });
    await processQueue(handler);
    const len = await getQueueLength();
    expect(len).toBe(1);
  });

  it('returns 0 length for empty queue', async () => {
    const len = await getQueueLength();
    expect(len).toBe(0);
  });
});
