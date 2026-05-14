// AnaJunubin — Photo Verification Flow (4-step)
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FontFamily } from '../theme';
import Button from '../components/Button';
import * as ImagePicker from 'expo-image-picker';
import { promptToOpenSettings } from '../utils/permissionAlert';
import { supabase } from '../config/supabase';

const STEPS = ['Instructions', 'Capture', 'Review', 'Submitted'];

export default function PhotoVerificationScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
        setStep(2);
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
      const { error: insertErr } = await supabase
        .from('VerificationRequest')
        .insert({
          userId: appUser.id,
          photoUrl: pub.publicUrl,
          storagePath,
          status: 'pending',
        });
      if (insertErr) throw insertErr;

      setStep(3);
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
            <Button title="Take Selfie" variant="primary" size="lg" fullWidth onPress={() => setStep(1)} />
          </View>
        );

      case 1:
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

      case 2:
        return (
          <View style={styles.stepContent}>
            <View style={styles.stepTop}>
              <Text style={styles.stepTitle}>Review Your Photo</Text>
              {photo && <Image source={{ uri: photo }} style={styles.reviewImage} />}
              <Text style={styles.stepDesc}>Does this photo clearly show your face?</Text>
            </View>
            <View style={styles.reviewActions}>
              <Button title="Retake" variant="outline" size="md" onPress={() => setStep(1)} disabled={submitting} style={{ flex: 1 }} />
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

      case 3:
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
    fontSize: 22,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
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
    borderRadius: 24,
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
    borderRadius: 20,
    backgroundColor: colors.gray300,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
});
