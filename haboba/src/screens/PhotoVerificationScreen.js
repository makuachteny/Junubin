// AnaJunubin — Photo Verification Flow (4-step)
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import Button from '../components/Button';
import * as ImagePicker from 'expo-image-picker';

const STEPS = ['Instructions', 'Capture', 'Review', 'Submitted'];

export default function PhotoVerificationScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState(null);

  const handleCapture = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Camera Required', 'Please allow camera access to verify your photo.');
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

  const handleSubmit = () => {
    // In production, upload to backend for verification
    setStep(3);
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <View style={styles.stepContent}>
            <View style={styles.iconCircle}>
              <Ionicons name="camera" size={40} color={colors.accent} />
            </View>
            <Text style={styles.stepTitle}>Verify Your Photos</Text>
            <Text style={styles.stepDesc}>
              Take a selfie to prove you're real. This helps build trust in the community.
            </Text>
            <View style={styles.instructions}>
              {['Face the camera directly', 'Good lighting, no filters', 'Match your profile photos'].map((item, i) => (
                <View key={i} style={styles.instructionRow}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
                  <Text style={styles.instructionText}>{item}</Text>
                </View>
              ))}
            </View>
            <Button title="Take Selfie" variant="primary" size="lg" fullWidth onPress={() => setStep(1)} />
          </View>
        );

      case 1:
        return (
          <View style={styles.stepContent}>
            <View style={styles.cameraPlaceholder}>
              <Ionicons name="camera" size={60} color={colors.gray400} />
              <Text style={[styles.stepDesc, { marginTop: 16 }]}>Position your face in the frame</Text>
            </View>
            <Button title="Capture Photo" variant="primary" size="lg" fullWidth onPress={handleCapture} />
          </View>
        );

      case 2:
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Review Your Photo</Text>
            {photo && <Image source={{ uri: photo }} style={styles.reviewImage} />}
            <Text style={styles.stepDesc}>Does this photo clearly show your face?</Text>
            <View style={styles.reviewActions}>
              <Button title="Retake" variant="outline" size="md" onPress={() => setStep(1)} style={{ flex: 1 }} />
              <Button title="Submit" variant="primary" size="md" onPress={handleSubmit} style={{ flex: 1 }} />
            </View>
          </View>
        );

      case 3:
        return (
          <View style={styles.stepContent}>
            <View style={styles.iconCircle}>
              <Ionicons name="checkmark-circle" size={50} color={colors.success} />
            </View>
            <Text style={styles.stepTitle}>Submitted!</Text>
            <Text style={styles.stepDesc}>
              Your verification is being reviewed. This usually takes less than 24 hours.
            </Text>
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

      {renderStep()}
    </View>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 56,
  },
  headerTitle: {
    fontSize: 34,
    fontFamily: FontFamily.black,
    color: colors.black,
    letterSpacing: 0.3,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gray300,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.accentTint08,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepTitle: {
    ...Typography.h2,
    color: colors.black,
    textAlign: 'center',
  },
  stepDesc: {
    ...Typography.bodySmall,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  instructions: { gap: 12, marginVertical: 16 },
  instructionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  instructionText: { ...Typography.body, color: colors.black },
  cameraPlaceholder: {
    width: 260,
    height: 340,
    borderRadius: 20,
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
    borderRadius: 16,
    backgroundColor: colors.gray300,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
});
