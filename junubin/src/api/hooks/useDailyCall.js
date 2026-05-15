// Daily.co WebRTC call wrapper.
//
// Owns the lifecycle of a single Daily call object, surfaces the local
// participant, the remote participants, and the join/leave/toggle
// helpers screens need to render a call.
//
// `roomUrl` is minted server-side by the `daily-create-room` Edge
// Function (which holds the project's Daily API key). The client never
// sees the API key — only the per-room URL + a short-lived token.
//
// Two roles:
//   `host`     full audio + video publish (default for callers)
//   `listener` join muted, audio + video off

import { useEffect, useRef, useState, useCallback } from 'react';

// Daily's RN SDK ships a native module. Loading it under Expo Go (or any
// client missing the linked native code) throws at import time and
// crashes the bundle. Wrapping in try/require lets the app render a
// graceful "live unavailable" surface instead. Production builds via
// EAS include the native module so the require succeeds normally.
let Daily = null;
try {
  // eslint-disable-next-line global-require
  Daily = require('@daily-co/react-native-daily-js').default;
} catch {
  // Native module unavailable — useDailyCall returns an inert object.
}

export const isDailyAvailable = () => Daily !== null;

export function useDailyCall({ roomUrl, token, role = 'host', enabled = true }) {
  const callRef = useRef(null);
  const [participants, setParticipants] = useState({});
  const [joinState, setJoinState] = useState('idle'); // idle | joining | joined | error
  const [error, setError] = useState(null);
  const [audioOn, setAudioOn] = useState(role === 'host');
  const [videoOn, setVideoOn] = useState(role === 'host');

  useEffect(() => {
    if (!enabled || !roomUrl) return undefined;
    if (!Daily) {
      // Native module missing (Expo Go) — surface a clear error so
      // screens can render a fallback rather than appear hung in
      // 'joining' forever.
      setError('Live video requires a native build. Open in TestFlight to join.');
      setJoinState('error');
      return undefined;
    }

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

  // Route audio between earpiece / speakerphone / wired headset. Daily's
  // RN SDK exposes `setAudioDevice('speakerphone' | 'wired' | 'earpiece'
  // | 'bluetooth')` — wrap it so screens can flip it from a button.
  const setAudioDevice = useCallback(async (deviceType) => {
    const call = callRef.current;
    if (!call || !deviceType) return;
    try {
      if (typeof call.setAudioDevice === 'function') {
        await call.setAudioDevice(deviceType);
      } else if (typeof call.setSpeakerphoneOn === 'function') {
        await call.setSpeakerphoneOn(deviceType === 'speakerphone');
      }
    } catch {
      // Some platforms / older SDK versions no-op silently.
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
    setAudioDevice,
  };
}
