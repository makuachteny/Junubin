import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../config/supabase';

/**
 * Supabase Realtime hook — replaces Socket.io useSocket.
 * Provides live messages, inbox activity (new messages + message
 * requests), typing indicators, and read receipts.
 */
export function useRealtime(userId) {
  const channelsRef = useRef({});
  const messageCallbackRef = useRef(null);
  const inboxSubscriptionRef = useRef(null);
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
      if (inboxSubscriptionRef.current) {
        supabase.removeChannel(inboxSubscriptionRef.current);
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
   * Listen for anything that should refresh the inbox. The two events
   * that change what the Messages tab shows are:
   *
   *   • a new `Message` row (a thread moves to the top / goes unread)
   *   • a `MessageRequest` INSERT or UPDATE (a stranger asked to talk,
   *     or one of our own requests was accepted/declined)
   *
   * The callback keeps the old shape — `(row, eventType)` — so callers
   * that just refetch on any event need no changes:
   *
   *   onInboxActivity((row, eventType, table) => { ... })
   *
   * `table` is the third arg ('Message' | 'MessageRequest') for callers
   * that want to branch; ignoring it is fine.
   *
   * `Message` rows are already scoped by RLS to conversations this user
   * belongs to, so no client-side filter is needed there.
   * `MessageRequest` can't be filtered server-side on a single column
   * (we care about both sides of the row), so the handler does it.
   */
  const onInboxActivity = useCallback((callback) => {
    if (!userId) return () => {};

    if (inboxSubscriptionRef.current) {
      supabase.removeChannel(inboxSubscriptionRef.current);
    }

    const handleMessage = (payload) => {
      const row = payload.new || payload.old;
      if (!row) return;
      callback(row, payload.eventType, 'Message');
    };

    const handleRequest = (payload) => {
      const row = payload.new || payload.old;
      if (!row) return;
      if (row.fromUserId === userId || row.toUserId === userId) {
        callback(row, payload.eventType, 'MessageRequest');
      }
    };

    const channel = supabase
      .channel(`inbox:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Message' }, handleMessage)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'MessageRequest' }, handleRequest)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'MessageRequest' }, handleRequest)
      .subscribe();

    inboxSubscriptionRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      if (inboxSubscriptionRef.current === channel) {
        inboxSubscriptionRef.current = null;
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
    onInboxActivity,
    emitTypingStart,
    emitTypingStop,
    onTypingStart,
    onTypingStop,
    emitReadReceipt,
    onReadReceipt,
  };
}
