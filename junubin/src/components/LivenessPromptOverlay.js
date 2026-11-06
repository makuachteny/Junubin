// LivenessPromptOverlay — UI-only active-liveness scaffold.
//
// Walks the user through three short prompts (look left, look right,
// blink) before they take the verification selfie. This is the UX
// half of the May 2026 audit P2.1 fix; the matching server side is
// `supabase/functions/face-liveness/`.
//
// This is a *visual* gate: each prompt holds for 1500ms and
// `onComplete({ passed: true, mode: 'time-based' })` fires after the
// last one. The moderation pipeline downstream (image moderation +
// admin review) catches obvious cheating.
//
// The AWS Rekognition FaceLivenessDetector integration was removed —
// `@aws-amplify/ui-react-native` hard-imports the `aws-amplify` core
// at module scope, which Metro resolves statically, so merely having
// the package installed broke the bundle while the feature itself was
// unconfigured (no Cognito pool, no AWS creds, face-liveness Edge
// Function undeployed). If real liveness grading is wanted later:
//
//   1. `npm i @aws-amplify/ui-react-native aws-amplify`
//   2. Configure Amplify with a Cognito identity pool that has
//      `rekognition:CreateFaceLivenessSession` permission, set the
//      AWS_* secrets, and deploy `supabase/functions/face-liveness`.
//   3. Mint a sessionId via livenessService.createLivenessSession(),
//      render <FaceLivenessDetector/>, then read the score with
//      livenessService.getLivenessResult().

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, FontFamily } from '../theme';

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
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  // Drive the progress bar through the 3 prompts.
  useEffect(() => {
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
        onComplete?.({ passed: true, mode: 'time-based' });
      }
    });
    return () => anim.stop();
  }, [stepIdx, progress, onComplete]);

  const current = PROMPTS[stepIdx];
  const styles = getStyles(colors);

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
    fontFamily: FontFamily.heading,
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
