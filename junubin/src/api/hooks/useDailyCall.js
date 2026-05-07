// Daily.co WebRTC call wrapper.
//
// Owns the lifecycle of a single Daily call object, surfaces the local
// participant, the remote participants, and the join/leave/toggle
// helpers screens need to render a call. CallScreen and LiveView/GoLive
// share this hook so the underlying WebRTC plumbing is identical.
//
// `roomUrl` is minted server-side by the `daily-create-room` Edge
// Function (which holds the project's Daily API key). The client never
// sees the API key — only the per-room URL + a short-lived token.
//
// Two roles:
//   `host`     full audio + video publish (default for callers / live
//              broadcasters)
//   `listener` join muted, audio + video off (default for live viewers)

import { useEffect, useRef, useState, useCallback } from 'react';
import Daily from '@daily-co/react-native-daily-js';

export function useDailyCall({ roomUrl, token, role = 'host', enabled = true }) {
  const callRef = useRef(null);
  const [participants, setParticipants] = useState({});
  const [joinState, setJoinState] = useState('idle'); // idle | joining | joined | error
  const [error, setError] = useState(null);
  const [audioOn, setAudioOn] = useState(role === 'host');
  const [videoOn, setVideoOn] = useState(role === 'host');

  useEffect(() => {
    if (!enabled || !roomUrl) return undefined;

    const call = Daily.createCallObject({
      audioSource: role === 'host',
      videoSource: role === 'host',
      // Default subscribe to remote tracks so viewers see/hear the host.
      subscribeToTracksAutomatically: true,
    });
    callRef.current = call;

    const refresh = () => setParticipants({ ...call.participants() });

    call.on('joined-meeting', () => {
      setJoinState('joined');
      refresh();
    });
    call.on('participant-joined', refresh);
    call.on('participant-updated', refresh);
    call.on('participant-left', refresh);
    call.on('error', (e) => {
      setError(e?.errorMsg || 'Call error');
      setJoinState('error');
    });

    setJoinState('joining');
    call.join({ url: roomUrl, token: token || undefined })
      .catch((e) => {
        setError(e?.message || String(e));
        setJoinState('error');
      });

    return () => {
      try {
        call.leave();
        call.destroy();
      } catch {
        // Best-effort teardown.
      }
      callRef.current = null;
    };
  }, [enabled, roomUrl, token, role]);

  const toggleAudio = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    const next = !audioOn;
    call.setLocalAudio(next);
    setAudioOn(next);
  }, [audioOn]);

  const toggleVideo = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    const next = !videoOn;
    call.setLocalVideo(next);
    setVideoOn(next);
  }, [videoOn]);

  const flipCamera = useCallback(async () => {
    const call = callRef.current;
    if (!call) return;
    try {
      await call.cycleCamera();
    } catch {
      // Some platforms expose only a single camera — silently no-op.
    }
  }, []);

  const leave = useCallback(async () => {
    const call = callRef.current;
    if (!call) return;
    try {
      await call.leave();
    } catch {
      // Best-effort.
    }
  }, []);

  // Convenience derived values for the UI.
  const local = Object.values(participants).find((p) => p.local);
  const remotes = Object.values(participants).filter((p) => !p.local);

  return {
    callObject: callRef.current,
    joinState,
    error,
    participants,
    local,
    remotes,
    audioOn,
    videoOn,
    toggleAudio,
    toggleVideo,
    flipCamera,
    leave,
  };
}
