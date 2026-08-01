// AnaJunubin — Photo Verification Flow (5-step with liveness check)
//
// Flow: Instructions → Liveness → Capture → Review → Submitted
// The Liveness step is the May 2026 audit P2.1 addition — an active
// head-turn/blink prompt before the selfie is captured. While the
// EXPO_PUBLIC_LIVENESS_PROVIDER env var is unset, the step runs as a
// UX-only scaffold (time-based prompts; no AWS Rekognition grading).
// Once AWS Amplify FaceLivenessDetector is wired in
// LivenessPromptOverlay, the same step gains real grading.
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FontFamily } from '../theme';
import Button from '../components/Button';
import LivenessPromptOverlay from '../components/LivenessPromptOverlay';
import * as ImagePicker from 'expo-image-picker';
import { promptToOpenSettings } from '../utils/permissionAlert';
import { supabase } from '../config/supabase';

const STEPS = ['Instructions', 'Liveness', 'Capture', 'Review', 'Submitted'];
const LIVENESS_PROVIDER = process.env.EXPO_PUBLIC_LIVENESS_PROVIDER || 'none';

export default function PhotoVerificationScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // Liveness state — null = not yet attempted; { passed, mode } once
  // the overlay reports back. We carry this through to handleSubmit
  // so the VerificationRequest row records *how* this user was
  // verified (selfie-only vs. selfie + liveness).
  const [livenessResult, setLivenessResult] = useState(null);

  const handleLivenessComplete = useCallback((result) => {
    setLivenessResult(result);
    if (result?.passed) {
      // Liveness passed → proceed to the capture step. If a real AWS
      // session id is in flight, it stays in livenessResult.metadata
      // and gets written to VerificationRequest.metadata below.
      setStep(2);
    } else {
      Alert.alert(
        'Liveness check failed',
        'We couldn\'t confirm you\'re a live person. Please try again with better lighting.',
        [{ text: 'Retry', onPress: () => setStep(1) }, { text: 'Cancel', onPress: () => navigation.goBack() }],
      );
    }
  }, [navigation]);

  const handleCapture = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') {
        promptToOpenSettings({
          title: 'Camera access needed',
          message: 'JuNubin needs camera access to verify your profile photo. Enable it in Settings.',
        });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
        cameraType: ImagePicker.CameraType?.front ?? 'front',
      });

      if (!result.canceled && result.assets?.[0]) {
        setPhoto(result.assets[0].uri);
        setStep(3); // Review step (was 2 in the pre-liveness flow).
      }
    } catch (err) {
      Alert.alert('Camera Error', 'Could not open the camera. Please try again.');
    }
  };

  const handleSubmit = async () => {
    if (!photo || submitting) return;
    setSubmitting(true);
    try {
      // Resolve the app User row (the same auth-id → User lookup
      // every service does).
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('You must be signed in to verify.');
      const { data: appUser, error: userErr } = await supabase
        .from('User').select('id').eq('auth_id', authUser.id).single();
      if (userErr || !appUser) throw new Error('Could not load your account.');

      // Upload selfie into the photos bucket under
      // `<userId>/verification/<ts>.jpg` so the existing photos-bucket
      // INSERT policy (first-path-segment must equal caller's User.id)
      // accepts the write. Reusing the bucket keeps the moderation
      // pipeline simple — a reviewer scans both profile photos and
      // verification selfies from the same Storage explorer view.
      const response = await fetch(photo);
      const arrayBuffer = await response.arrayBuffer();
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('Selected image was empty — retake the photo.');
      }
      const storagePath = `${appUser.id}/verification/${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from('photos')
        .upload(storagePath, arrayBuffer, { contentType: 'image/jpeg', upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: pub } = supabase.storage.from('photos').getPublicUrl(storagePath);

      // Write the pending VerificationRequest row. The 00029 trigger
      // mirrors status → User.isVerified once an admin approves the
      // row from the Supabase dashboard. The client NEVER sets
      // isVerified directly — RLS blocks that, and we want a paper
      // trail before the badge appears on the profile.
      //
      // `method` matches the 00039 enum: 'selfie' (legacy / time-based
      // scaffold) vs 'aws-face-liveness' (real Rekognition grading).
      // Only stamp 'aws-face-liveness' when the overlay returned a
      // real AWS sessionId — otherwise the row falsely claims the
      // user was graded by AWS when in fact the time-based fallback
      // ran. Reviewers rely on `method` to know which path to trust.
      const gradedByAws =
        livenessResult?.mode === 'aws-amplify' && !!livenessResult.sessionId;
      const { error: insertErr } = await supabase
        .from('VerificationRequest')
        .insert({
          userId: appUser.id,
          photoUrl: pub.publicUrl,
          storagePath,
          status: 'pending',
          method: gradedByAws ? 'aws-face-liveness' : 'selfie',
          metadata: livenessResult || {},
        });
      if (insertErr) throw insertErr;

      setStep(4);
    } catch (err) {
      Alert.alert(
        'Could not submit',
        err?.message || 'Try again when you have a connection.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepTop}>
              <View style={styles.iconCircle}>
                <Ionicons name="camera" size={32} color={colors.accent} />
              </View>
              <Text style={styles.stepTitle}>Verify Your Photos</Text>
              <Text style={styles.stepDesc}>
                Take a selfie to prove you're real. This helps{'\n'}build trust in the community.
              </Text>
              <View style={styles.instructions}>
                {['Face the camera directly', 'Good lighting, no filters', 'Match your profile photos'].map((item, i) => (
                  <View key={i} style={styles.instructionRow}>
                    <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
                    <Text style={styles.instructionText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Button
              title="Continue"
              variant="primary"
              size="lg"
              fullWidth
              onPress={() => {
                // Skip the liveness step entirely while the provider
                // env var is unset AND no Amplify SDK is installed —
                // keeps the flow on the legacy "selfie only" path so
                // existing testers aren't blocked on the scaffold.
                // Once you flip EXPO_PUBLIC_LIVENESS_PROVIDER, the
                // step engages.
                setStep(LIVENESS_PROVIDER === 'none' ? 2 : 1);
              }}
            />
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepTop}>
              <LivenessPromptOverlay
                onComplete={handleLivenessComplete}
                onCancel={() => navigation.goBack()}
              />
            </View>
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepTop}>
              <View style={styles.cameraPlaceholder}>
                <Ionicons name="camera" size={48} color={colors.gray400} />
                <Text style={[styles.stepDesc, { marginTop: 12 }]}>Position your face in the frame</Text>
              </View>
            </View>
            <Button title="Capture Photo" variant="primary" size="lg" fullWidth onPress={handleCapture} />
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepTop}>
              <Text style={styles.stepTitle}>Review Your Photo</Text>
              {photo && <Image source={{ uri: photo }} style={styles.reviewImage} />}
              <Text style={styles.stepDesc}>Does this photo clearly show your face?</Text>
            </View>
            <View style={styles.reviewActions}>
              <Button title="Retake" variant="outline" size="md" onPress={() => setStep(2)} disabled={submitting} style={{ flex: 1 }} />
              <Button
                title={submitting ? 'Submitting…' : 'Submit'}
                variant="primary"
                size="md"
                onPress={handleSubmit}
                disabled={submitting}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        );

      case 4:
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepTop}>
              <View style={styles.iconCircle}>
                <Ionicons name="checkmark-circle" size={40} color={colors.success} />
              </View>
              <Text style={styles.stepTitle}>Submitted!</Text>
              <Text style={styles.stepDesc}>
                Your verification is being reviewed.{'\n'}This usually takes less than 24 hours.
              </Text>
            </View>
            <Button title="Done" variant="primary" size="lg" fullWidth onPress={() => navigation.goBack()} />
          </View>
        );
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={26} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Photo Verification</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Progress dots */}
      <View style={styles.progressRow}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.progressDot, i <= step && { backgroundColor: colors.accent }]} />
        ))}
      </View>

      <View style={styles.body}>
        {renderStep()}
      </View>
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.black,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  progressDot: {
    width: 24,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.gray300,
  },
  body: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 40,
    paddingBottom: 32,
  },
  stepTop: {
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 24,
    fontFamily: FontFamily.heading,
    color: colors.black,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  stepDesc: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
    color: colors.gray500,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
  },
  instructions: { gap: 14, marginVertical: 20, alignSelf: 'center' },
  instructionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  instructionText: { fontSize: 15, fontFamily: FontFamily.medium, color: colors.black },
  cameraPlaceholder: {
    width: 240,
    height: 320,
    borderRadius: 4,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.gray300,
    borderStyle: 'dashed',
  },
  reviewImage: {
    width: 220,
    height: 280,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.gray300,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
});
