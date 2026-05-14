import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../config/supabase';

/**
 * Supabase Realtime hook — replaces Socket.io useSocket.
 * Provides live messages, match notifications, typing indicators, and read receipts.
 */
export function useRealtime(userId) {
  const channelsRef = useRef({});
  const messageCallbackRef = useRef(null);
  const matchSubscriptionRef = useRef(null);
  const typingTimerRef = useRef(null);
  // Per-conversation callback registries for broadcast events. Keyed
  // by conversationId so multiple open conversations don't trample
  // each other. The internal channel handlers (registered BEFORE
  // .subscribe() in joinConversation) read from these refs at fire
  // time — Supabase Realtime silently drops `.on()` calls made after
  // a channel has already subscribed, so we must register the bridge
  // up front and let consumers swap their callbacks via these refs.
  const typingStartCbsRef = useRef({}); // { [conversationId]: fn }
  const typingStopCbsRef = useRef({});
  const readReceiptCbsRef = useRef({});

  // Clean up all subscriptions on unmount
  useEffect(() => {
    return () => {
      for (const channel of Object.values(channelsRef.current)) {
        supabase.removeChannel(channel);
      }
      channelsRef.current = {};
      if (matchSubscriptionRef.current) {
        supabase.removeChannel(matchSubscriptionRef.current);
      }
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    };
  }, []);

  /**
   * Subscribe to new messages in a conversation via postgres_changes,
   * AND wire up all broadcast event handlers (typing_start,
   * typing_stop, read_receipt) BEFORE .subscribe(). Supabase Realtime
   * requires every `.on(...)` to be registered prior to subscription
   * or the listener never fires — that's why typing indicators
   * silently stopped working. The handlers dispatch to per-conv
   * callback refs (see typingStartCbsRef etc.), so consumers can
   * register/replace their callbacks at any time without touching
   * the channel itself.
   */
  const joinConversation = useCallback((conversationId) => {
    if (channelsRef.current[conversationId]) return;

    const channel = supabase
      .channel(`conv:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Message',
          filter: `conversationId=eq.${conversationId}`,
        },
        (payload) => {
          messageCallbackRef.current?.(payload.new);
        }
      )
      .on('broadcast', { event: 'typing_start' }, ({ payload }) => {
        if (!payload) return;
        // Ignore our own broadcasts — the peer indicator shouldn't
        // fire from this user's own keystrokes.
        if (payload.userId && payload.userId === userId) return;
        typingStartCbsRef.current[conversationId]?.({ conversationId, ...payload });
      })
      .on('broadcast', { event: 'typing_stop' }, ({ payload }) => {
        if (!payload) return;
        if (payload.userId && payload.userId === userId) return;
        typingStopCbsRef.current[conversationId]?.({ conversationId, ...payload });
      })
      .on('broadcast', { event: 'read_receipt' }, ({ payload }) => {
        if (!payload) return;
        if (payload.userId && payload.userId === userId) return;
        readReceiptCbsRef.current[conversationId]?.({ conversationId, ...payload });
      })
      .subscribe();

    channelsRef.current[conversationId] = channel;
  }, [userId]);

  const leaveConversation = useCallback((conversationId) => {
    const channel = channelsRef.current[conversationId];
    if (channel) {
      supabase.removeChannel(channel);
      delete channelsRef.current[conversationId];
    }
  }, []);

  /**
   * Listen for new messages in the active conversation.
   */
  const onMessage = useCallback((conversationId, callback) => {
    // Ensure channel exists
    joinConversation(conversationId);

    // Delegate to the callback ref used by joinConversation's INSERT handler
    messageCallbackRef.current = callback;

    return () => {
      messageCallbackRef.current = null;
    };
  }, [joinConversation]);

  /**
   * Listen for new matches AND match teardowns. The unmatch RPC issued
   * from another device deletes a Match row; without listening for
   * DELETE, the local matches list keeps showing a peer the user has
   * already broken up with. The same callback fires for both events;
   * the second arg distinguishes:
   *
   *   onMatchCreated((match, eventType) => { ... })
   *
   * `eventType` is 'INSERT' or 'DELETE'. Existing callers that ignore
   * the second arg keep working — they just get a refetch trigger on
   * either event, which is the most common shape they want anyway.
   */
  const onMatchCreated = useCallback((callback) => {
    if (!userId) return () => {};

    if (matchSubscriptionRef.current) {
      supabase.removeChannel(matchSubscriptionRef.current);
    }

    // INSERT and DELETE go through the same channel + callback. We
    // can't filter server-side on userId for INSERT (the row's
    // userAId/userBId is dynamic), so the handler does it client-side.
    const handle = (payload) => {
      const row = payload.new || payload.old;
      if (!row) return;
      if (row.userAId === userId || row.userBId === userId) {
        callback(row, payload.eventType);
      }
    };

    const channel = supabase
      .channel(`matches:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Match' }, handle)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'Match' }, handle)
      .subscribe();

    matchSubscriptionRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      if (matchSubscriptionRef.current === channel) {
        matchSubscriptionRef.current = null;
      }
    };
  }, [userId]);

  /**
   * Typing indicators via Supabase Realtime Broadcast. Emits two
   * distinct events (`typing_start` / `typing_stop`) — the matching
   * `.on('broadcast', { event: ... })` listeners are pre-registered
   * in `joinConversation` so they actually fire on the receiving end.
   * Outgoing `.send()` does NOT require pre-subscription registration,
   * so emit-side stays simple.
   */
  const emitTypingStart = useCallback((conversationId) => {
    // Debounce: skip if timer is still active
    if (typingTimerRef.current) return;

    const channel = channelsRef.current[conversationId];
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'typing_start',
        payload: { userId, conversationId },
      });
    }

    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
    }, 300);
  }, [userId]);

  const emitTypingStop = useCallback((conversationId) => {
    const channel = channelsRef.current[conversationId];
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'typing_stop',
        payload: { userId, conversationId },
      });
    }
  }, [userId]);

  /**
   * Register a callback for typing-start broadcasts on a given
   * conversation. Stores the callback in a ref — the actual broadcast
   * listener was attached up front in joinConversation (must be
   * before .subscribe() per Supabase Realtime). Returns an
   * unsubscribe that clears the slot.
   */
  const onTypingStart = useCallback((conversationId, callback) => {
    if (!conversationId) return () => {};
    typingStartCbsRef.current[conversationId] = callback;
    return () => {
      if (typingStartCbsRef.current[conversationId] === callback) {
        delete typingStartCbsRef.current[conversationId];
      }
    };
  }, []);

  const onTypingStop = useCallback((conversationId, callback) => {
    if (!conversationId) return () => {};
    typingStopCbsRef.current[conversationId] = callback;
    return () => {
      if (typingStopCbsRef.current[conversationId] === callback) {
        delete typingStopCbsRef.current[conversationId];
      }
    };
  }, []);

  /**
   * Read receipts via Broadcast.
   */
  const emitReadReceipt = useCallback((conversationId) => {
    const channel = channelsRef.current[conversationId];
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'read_receipt',
        payload: { userId, conversationId },
      });
    }
  }, [userId]);

  const onReadReceipt = useCallback((conversationId, callback) => {
    if (!conversationId) return () => {};
    readReceiptCbsRef.current[conversationId] = callback;
    return () => {
      if (readReceiptCbsRef.current[conversationId] === callback) {
        delete readReceiptCbsRef.current[conversationId];
      }
    };
  }, []);

  return {
    joinConversation,
    leaveConversation,
    onMessage,
    onMatchCreated,
    emitTypingStart,
    emitTypingStop,
    onTypingStart,
    onTypingStop,
    emitReadReceipt,
    onReadReceipt,
  };
}
