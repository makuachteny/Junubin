// JuNubin — Incoming Call Hook
//
// Subscribes the current user's call channel and surfaces incoming-call state
// so a top-level overlay can render. Decoupled from any single screen so the
// overlay shows up regardless of which tab the receiver is on.

import { useEffect, useState, useCallback, useRef } from 'react';
import * as callService from '../services/callService';

export function useIncomingCall(userId) {
  const [incoming, setIncoming] = useState(null);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!userId) return undefined;
    channelRef.current = callService.subscribeToCalls(userId, {
      onInvite: (payload) => {
        if (!payload?.callId) return;
        setIncoming(payload);
      },
      // If the caller cancels before we accept, dismiss the overlay.
      onEnd: (payload) => {
        setIncoming((prev) => (prev?.callId === payload?.callId ? null : prev));
      },
    });
    return () => {
      callService.unsubscribe(channelRef.current);
      channelRef.current = null;
    };
  }, [userId]);

  const accept = useCallback(() => {
    if (!incoming) return null;
    const { callId, caller, callType, conversationId } = incoming;
    callService.sendAccept(caller?.id, { callId }).catch(() => {});
    callService.recordCall({
      callId,
      direction: 'incoming',
      callType,
      peer: caller,
      status: 'answered',
    });
    const accepted = { callId, caller, callType, conversationId };
    setIncoming(null);
    return accepted;
  }, [incoming]);

  const decline = useCallback(() => {
    if (!incoming) return;
    const { callId, caller, callType } = incoming;
    callService.sendDecline(caller?.id, { callId }).catch(() => {});
    callService.recordCall({
      callId,
      direction: 'incoming',
      callType,
      peer: caller,
      status: 'declined',
    });
    setIncoming(null);
  }, [incoming]);

  return { incoming, accept, decline };
}
