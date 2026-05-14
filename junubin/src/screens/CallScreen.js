import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DailyMediaView } from '@daily-co/react-native-daily-js';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import { imageSource } from '../utils/imageSource';
import { FontFamily } from '../theme';
import { SpraySplatter } from '../components/GraffitiAccents';
import { useAuth } from '../auth';
import * as callService from '../api/services/callService';
import { useDailyCall } from '../api/hooks/useDailyCall';
import { getOrCreateDailyRoom } from '../api/services/dailyService';

// Warm earth-tone palette — keeps the call screen tonally consistent with the
// landing/signup flow. Hardcoded because this screen is intentionally always
// dark regardless of theme preference.
const WARM = {
  primary: '#F5B741',
  mid:     '#E27D2C',
  deep:    '#8E5524',
};

export default function CallScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();
  const match = route.params?.match || {};
  const callType = route.params?.callType || 'voice';
  const direction = route.params?.direction || 'outgoing';
  const callId = route.params?.callId;

  // dialing → ringing → connected → ended (driven by signaling events)
  const [callState, setCallState] = useState(direction === 'outgoing' ? 'dialing' : 'connected');
  const [callDuration, setCallDuration] = useState(0);
  const [isSpeaker, setIsSpeaker] = useState(false);

  // Daily.co room is provisioned once the call is `connected`. The
  // signaling layer (existing callService) handles the ring/answer/decline
  // dance; Daily handles the media. Room context = the conversationId
  // (falls back to a deterministic pair key) so re-joining the same chat
  // re-uses the room.
  const conversationId =
    route.params?.match?.conversationId
    || (currentUser?.id && match.id
      ? [currentUser.id, match.id].sort().join('_')
      : null);
  const [dailyRoom, setDailyRoom] = useState(null);
  const [dailyError, setDailyError] = useState(null);
  useEffect(() => {
    if (callState !== 'connected' || !conversationId) return;
    let cancelled = false;
    (async () => {
      // Gate the call on OS-level camera/mic permission. Without this,
      // Daily silently joins with no tracks and the user sees a black/silent
      // screen with no explanation.
      try {
        const micPerm = await Audio.requestPermissionsAsync();
        const camPerm = callType === 'video'
          ? await Camera.requestCameraPermissionsAsync()
          : { granted: true };
        if (cancelled) return;
        if (!micPerm.granted || !camPerm.granted) {
          Alert.alert(
            'Camera or mic blocked',
            'JuNubin needs camera and microphone access for calls. Enable them in Settings.',
          );
          navigation.goBack();
          return;
        }
      } catch (e) {
        if (!cancelled) setDailyError(e?.message || 'Permission check failed');
        return;
      }
      try {
        const room = await getOrCreateDailyRoom({ kind: 'call', context: conversationId, isOwner: direction === 'outgoing' });
        if (!cancelled) setDailyRoom(room);
      } catch (e) {
        if (!cancelled) setDailyError(e?.message || 'Could not start media');
      }
    })();
    return () => { cancelled = true; };
  }, [callState, conversationId, direction, callType, navigation]);

  const dailyCall = useDailyCall({
    roomUrl: dailyRoom?.url,
    token: dailyRoom?.token,
    role: 'host',
    enabled: callState === 'connected' && !!dailyRoom,
  });

  const isMuted = !dailyCall.audioOn;
  const isVideoEnabled = dailyCall.videoOn || (callType === 'video' && !dailyRoom);
  const setIsMuted = () => dailyCall.toggleAudio();
  const timerRef = useRef(null);
  const channelRef = useRef(null);
  const startTimeRef = useRef(null);
  const endedRef = useRef(false);

  // Run the duration timer once we hit `connected`.
  useEffect(() => {
    if (callState !== 'connected') return;
    if (!startTimeRef.current) startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // Subscribe to peer signaling: accept / decline / end.
  useEffect(() => {
    if (!currentUser?.id || !callId) return;
    channelRef.current = callService.subscribeToCalls(currentUser.id, {
      onAccept: (payload) => {
        if (payload?.callId !== callId) return;
        setCallState('connected');
      },
      onDecline: (payload) => {
        if (payload?.callId !== callId) return;
        endedRef.current = true;
        setCallState('ended');
        callService.recordCall({
          callId,
          direction,
          callType,
          peer: { id: match.id, name: match.name, avatar: match.images?.[0] },
          status: 'declined',
        });
        // Bounce back to chat after a short pause so the user reads "Declined"
        setTimeout(() => navigation.goBack(), 1200);
      },
      onEnd: (payload) => {
        if (payload?.callId !== callId) return;
        endedRef.current = true;
        setCallState('ended');
        const seconds = startTimeRef.current
          ? Math.floor((Date.now() - startTimeRef.current) / 1000)
          : 0;
        callService.recordCall({
          callId,
          direction,
          callType,
          peer: { id: match.id, name: match.name, avatar: match.images?.[0] },
          status: 'completed',
          durationSeconds: seconds,
        });
        setTimeout(() => navigation.goBack(), 800);
      },
    });
    return () => {
      callService.unsubscribe(channelRef.current);
      channelRef.current = null;
    };
  }, [currentUser?.id, callId, callType, direction, match.id, match.name, match.images, navigation]);

  // Outgoing-call timeout: if the receiver doesn't answer in 30s, mark missed.
  useEffect(() => {
    if (direction !== 'outgoing' || callState !== 'dialing') return;
    const t = setTimeout(() => {
      if (!endedRef.current) {
        endedRef.current = true;
        if (match.id) callService.sendEnd(match.id, { callId, reason: 'no-answer' }).catch(() => {});
        callService.recordCall({
          callId,
          direction,
          callType,
          peer: { id: match.id, name: match.name, avatar: match.images?.[0] },
          status: 'missed',
        });
        setCallState('ended');
        navigation.goBack();
      }
    }, 30000);
    return () => clearTimeout(t);
  }, [direction, callState, callId, callType, match.id, match.name, match.images, navigation]);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleEnd = useCallback(async () => {
    if (endedRef.current) return;
    endedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);

    // Tell the peer to close their side too.
    if (match.id) {
      callService.sendEnd(match.id, { callId, reason: 'hangup' }).catch(() => {});
    }
    if (callState === 'connected') {
      const seconds = startTimeRef.current
        ? Math.floor((Date.now() - startTimeRef.current) / 1000)
        : callDuration;
      callService.recordCall({
        callId,
        direction,
        callType,
        peer: { id: match.id, name: match.name, avatar: match.images?.[0] },
        status: 'completed',
        durationSeconds: seconds,
      });
    } else if (direction === 'outgoing') {
      callService.recordCall({
        callId,
        direction,
        callType,
        peer: { id: match.id, name: match.name, avatar: match.images?.[0] },
        status: 'cancelled',
      });
    }
    // Explicitly leave the Daily call so camera/mic are released before
    // React unmounts the screen (otherwise the indicator stays hot until GC).
    try {
      await dailyCall.leave?.();
    } catch {
      // Swallow — best-effort teardown.
    }
    navigation.goBack();
  }, [navigation, match, callId, callType, direction, callState, callDuration, dailyCall]);

  const statusLabel = (() => {
    if (callState === 'dialing') return 'Calling…';
    if (callState === 'ended') return 'Call ended';
    return formatTime(callDuration);
  })();

  // Pick the remote participant whose tile we render full-bleed. With
  // multi-party (>1 remote) we render the first one full-bleed; the rest
  // would surface as small tiles if/when we build a grid.
  const remoteWithVideo = dailyCall.remotes.find((p) => p.video || p.tracks?.video?.state === 'playable');
  const showVideo = callType === 'video' && callState === 'connected';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
      {/* Remote video — full-bleed once connected. Falls back to the
          pulsing avatar when video isn't available (audio call OR before
          remote tracks arrive). */}
      {showVideo && remoteWithVideo ? (
        <View style={StyleSheet.absoluteFill}>
          <DailyMediaView
            videoTrack={remoteWithVideo.videoTrack}
            audioTrack={remoteWithVideo.audioTrack}
            mirror={false}
            zOrder={0}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.remoteScrim} pointerEvents="none" />
        </View>
      ) : (
        <View style={styles.avatarWrap}>
          <View style={[styles.pulseRing, styles.pulseRing1, { borderColor: 'rgba(245,183,65,0.18)' }]} />
          <View style={[styles.pulseRing, styles.pulseRing2, { borderColor: 'rgba(245,183,65,0.10)' }]} />
          <Image source={imageSource(match.images?.[0])} style={[styles.avatar, { borderColor: WARM.primary }]} />
        </View>
      )}

      {/* Local video PiP — small tile in the top-right when video is on. */}
      {showVideo && dailyCall.local?.videoTrack ? (
        <View style={[styles.localPip, { top: insets.top + 16 }]}>
          <DailyMediaView
            videoTrack={dailyCall.local.videoTrack}
            mirror
            zOrder={1}
            style={StyleSheet.absoluteFill}
          />
        </View>
      ) : null}

      <Text style={[styles.name, showVideo && remoteWithVideo && styles.nameOverlay]}>{match.name || 'Unknown'}</Text>
      <Text style={[styles.status, showVideo && remoteWithVideo && styles.statusOverlay]}>{statusLabel}</Text>

      {/* Honest indicator while we wait for media to come up. */}
      {callState === 'connected' && !dailyRoom ? (
        <View style={styles.mediaHint}>
          <Ionicons name="hourglass-outline" size={13} color="rgba(255,255,255,0.45)" />
          <Text style={styles.mediaHintText}>Connecting media…</Text>
        </View>
      ) : null}
      {dailyError ? (
        <View style={styles.mediaHint}>
          <Ionicons name="warning-outline" size={13} color="#F87171" />
          <Text style={[styles.mediaHintText, { color: '#F87171' }]}>{dailyError}</Text>
        </View>
      ) : null}

      {/* Ambient warm spray accents */}
      <View style={{ position: 'absolute', left: 10, top: 100 }} pointerEvents="none">
        <SpraySplatter size={40} color={WARM.primary} opacity={0.08} />
      </View>
      <View style={{ position: 'absolute', right: 15, bottom: 180 }} pointerEvents="none">
        <SpraySplatter size={45} color={WARM.deep} opacity={0.10} />
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlBtn, isMuted && styles.controlActive]}
          onPress={() => setIsMuted(!isMuted)}
          accessibilityRole="button"
          accessibilityState={{ selected: isMuted }}
          accessibilityLabel={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        >
          <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={26} color="#FFFFFF" />
          <Text style={styles.controlLabel}>Mute</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.endBtn}
          onPress={handleEnd}
          accessibilityRole="button"
          accessibilityLabel="End call"
        >
          <Ionicons name="call" size={30} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, isSpeaker && styles.controlActive]}
          onPress={() => {
            const next = !isSpeaker;
            setIsSpeaker(next);
            // Tell Daily / iOS to actually route audio — flipping local
            // state alone changes nothing on the audio session.
            dailyCall.setAudioDevice?.(next ? 'speakerphone' : 'wired');
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: isSpeaker }}
        >
          <Ionicons name={isSpeaker ? 'volume-high' : 'volume-medium'} size={26} color="#FFFFFF" />
          <Text style={styles.controlLabel}>Speaker</Text>
        </TouchableOpacity>

        {callType === 'video' && (
          <>
            <TouchableOpacity
              style={[styles.controlBtn, isVideoEnabled && styles.controlActive]}
              onPress={() => dailyCall.toggleVideo()}
              accessibilityRole="button"
              accessibilityState={{ selected: isVideoEnabled }}
            >
              <Ionicons name={isVideoEnabled ? 'videocam' : 'videocam-off'} size={26} color="#FFFFFF" />
              <Text style={styles.controlLabel}>Video</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={() => dailyCall.flipCamera()}
              accessibilityRole="button"
              accessibilityLabel="Flip camera"
            >
              <Ionicons name="camera-reverse" size={26} color="#FFFFFF" />
              <Text style={styles.controlLabel}>Flip</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C0E',
    alignItems: 'center',
  },
  // Dark scrim over the remote video so the name + status text remain
  // legible regardless of what the remote camera is showing.
  remoteScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  // Picture-in-picture for the local camera. Fixed size so it doesn't
  // dominate the remote tile.
  localPip: {
    position: 'absolute',
    right: 16,
    width: 110,
    height: 150,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: '#111',
    zIndex: 10,
  },
  nameOverlay: {
    position: 'absolute',
    top: 90,
    alignSelf: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  statusOverlay: {
    position: 'absolute',
    top: 130,
    alignSelf: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  avatarWrap: {
    marginTop: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
  },
  pulseRing1: { width: 160, height: 160 },
  pulseRing2: { width: 200, height: 200 },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    marginTop: 24,
  },
  status: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
    fontFamily: FontFamily.medium,
  },
  mediaHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  mediaHintText: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    color: 'rgba(255,255,255,0.55)',
  },
  controls: {
    position: 'absolute',
    bottom: 80,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  },
  controlBtn: {
    alignItems: 'center',
    gap: 6,
    padding: 14,
    borderRadius: 30,
  },
  controlActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  controlLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  endBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#E11D48',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});
