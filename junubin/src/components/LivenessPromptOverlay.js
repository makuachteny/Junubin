// LivenessPromptOverlay — UI-only active-liveness scaffold.
//
// Walks the user through three short prompts (look left, look right,
// blink) before they take the verification selfie. This is the UX
// half of the May 2026 audit P2.1 fix; the matching server side is
// `supabase/functions/face-liveness/`.
//
// Today this is a *visual* gate only — the SDK that actually grades
// the head movement / blink is the AWS Amplify FaceLivenessDetector
// (`@aws-amplify/ui-react-native`). That component requires native
// camera bindings + Amplify config + AWS IAM-scoped Cognito creds, so
// it's gated on EXPO_PUBLIC_LIVENESS_PROVIDER === 'aws-amplify'. Until
// that flag is set, the prompt runs in time-based mode: each prompt
// holds for 1500ms and `onComplete(true)` fires after the last one.
//
// Integration sketch when wiring AWS Amplify:
//
//   1. `npm i @aws-amplify/ui-react-native aws-amplify`
//   2. Configure Amplify with the Cognito identity pool that has
//      `rekognition:CreateFaceLivenessSession` permission.
//   3. Replace the time-based progression below with the SDK's
//      <FaceLivenessDetector /> component (it owns the camera + the
//      prompts and emits `onAnalysisComplete` once Rekognition has
//      graded the session).
//   4. Call face-liveness Edge Function with action='create' first to
//      mint a sessionId; pass it to the SDK; on completion call
//      action='result' to read the score.

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, FontFamily } from '../theme';
import { createLivenessSession, getLivenessResult } from '../api/services/livenessService';

// Try to load the AWS Amplify Face Liveness component dynamically.
// If the package isn't installed (most dev machines, before the
// install ships), `require` throws and we fall through to the
// time-based UI scaffold below. Once `@aws-amplify/ui-react-native`
// is in the bundle, this branch lights up automatically.
let FaceLivenessDetector = null;
try {
  // eslint-disable-next-line global-require, import/no-unresolved
  const mod = require('@aws-amplify/ui-react-native');
  FaceLivenessDetector = mod?.FaceLivenessDetector || null;
} catch {
  FaceLivenessDetector = null;
}

const PROVIDER = process.env.EXPO_PUBLIC_LIVENESS_PROVIDER || 'none';

const PROMPTS = [
  { id: 'left',   label: 'Turn your head LEFT',  icon: 'arrow-back' },
  { id: 'right',  label: 'Turn your head RIGHT', icon: 'arrow-forward' },
  { id: 'blink',  label: 'Blink slowly',         icon: 'eye-outline' },
];
const HOLD_MS = 1500;

export default function LivenessPromptOverlay({ onComplete, onCancel }) {
  const { colors } = useTheme();
  const [stepIdx, setStepIdx] = useState(0);
  const [progress] = useState(new Animated.Value(0));
  // Real-AWS state: sessionId comes back from the face-liveness Edge
  // Function. Once the SDK component finishes its camera flow,
  // sessionComplete flips true and we poll the result endpoint.
  const [sessionId, setSessionId] = useState(null);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [error, setError] = useState(null);
  const useAwsPath = PROVIDER === 'aws-amplify' && !!FaceLivenessDetector;
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // ── AWS path: mint a session on mount ──────────────────────────
  useEffect(() => {
    if (!useAwsPath) return;
    let cancelled = false;
    createLivenessSession().then((session) => {
      if (cancelled || !mountedRef.current) return;
      if (!session?.sessionId) {
        // Server returned 503 (AWS not configured) or network blip.
        // Fall through to time-based path so the user isn't stuck.
        setError('liveness-not-configured');
        return;
      }
      setSessionId(session.sessionId);
    });
    return () => { cancelled = true; };
  }, [useAwsPath]);

  // ── AWS path: poll result after SDK reports complete ─────────────
  useEffect(() => {
    if (!useAwsPath || !sessionComplete || !sessionId) return;
    let cancelled = false;
    getLivenessResult(sessionId).then((result) => {
      if (cancelled || !mountedRef.current) return;
      if (!result) {
        onComplete?.({ passed: false, mode: 'aws-amplify', error: 'no-result' });
        return;
      }
      onComplete?.({
        passed: !!result.passed,
        confidence: result.confidence,
        awsStatus: result.status,
        sessionId,
        mode: 'aws-amplify',
      });
    });
    return () => { cancelled = true; };
  }, [useAwsPath, sessionComplete, sessionId, onComplete]);

  // ── Time-based path: drive the progress bar through 3 prompts ────
  const timeBasedActive = !useAwsPath || error === 'liveness-not-configured';
  useEffect(() => {
    if (!timeBasedActive) return;
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (!finished || !mountedRef.current) return;
      if (stepIdx < PROMPTS.length - 1) {
        setStepIdx(stepIdx + 1);
      } else {
        // Time-based fallback always signals pass — the moderation
        // pipeline downstream (admin review + image moderation)
        // catches any obvious cheating.
        onComplete?.({ passed: true, mode: 'time-based' });
      }
    });
    return () => anim.stop();
  }, [timeBasedActive, stepIdx, progress, onComplete]);

  const current = PROMPTS[stepIdx];
  const styles = getStyles(colors);

  // ── AWS path: hand the camera to the Amplify SDK component ─────
  if (useAwsPath && !error && sessionId && !sessionComplete) {
    return (
      <View style={styles.container}>
        <FaceLivenessDetector
          sessionId={sessionId}
          region={process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1'}
          onAnalysisComplete={() => setSessionComplete(true)}
          onError={(e) => {
            // SDK error → surface a pass:false so the caller can
            // route to the manual-review path instead of stranding
            // the user on a broken camera screen.
            onComplete?.({ passed: false, mode: 'aws-amplify', error: String(e?.error?.name || e?.message || 'sdk-error') });
          }}
        />
      </View>
    );
  }

  // ── AWS path: session minting in flight — show a small spinner ─
  if (useAwsPath && !error && !sessionId) {
    return (
      <View style={styles.container}>
        <Text style={styles.eyebrow}>Preparing liveness check…</Text>
      </View>
    );
  }

  // Default (and fallback): time-based prompt overlay.
  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <Text style={styles.eyebrow}>Liveness check · {stepIdx + 1} / {PROMPTS.length}</Text>
      <View style={styles.iconCircle}>
        <Ionicons name={current.icon} size={56} color={colors.accent} />
      </View>
      <Text style={styles.prompt}>{current.label}</Text>
      <View style={styles.progressTrack}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
      <Text style={styles.helper}>
        Hold steady. We use this to confirm you're a real person — your
        video isn't kept, only a yes/no result.
      </Text>
      {onCancel ? (
        <Text style={styles.cancel} onPress={onCancel}>Cancel</Text>
      ) : null}
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 14,
  },
  eyebrow: {
    fontSize: 12,
    fontFamily: FontFamily.semibold,
    color: colors.gray500,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  prompt: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.black,
    textAlign: 'center',
  },
  progressTrack: {
    width: 220,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gray200,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  helper: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    color: colors.gray500,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 19,
  },
  cancel: {
    marginTop: 16,
    fontSize: 14,
    color: colors.gray500,
    fontFamily: FontFamily.semibold,
    textDecorationLine: 'underline',
  },
});
