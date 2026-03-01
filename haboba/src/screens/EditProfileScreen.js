import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import { currentUser, CULTURAL_STICKERS, imageSource } from '../data/mockProfiles';
import { useAuth } from '../auth';
import * as profileService from '../api/services/profileService';

export default function EditProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { accessToken, updateUser } = useAuth();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(currentUser.name);
  const [bio, setBio] = useState('Designer exploring the city');
  const [job, setJob] = useState('');
  const [school, setSchool] = useState('');
  const [lookingFor, setLookingFor] = useState('Something serious');
  const [selectedStickers, setSelectedStickers] = useState([0, 4]); // Dinka, Junub

  const lookingForOptions = ['Something serious', "Let's see where it goes", 'Marriage-minded', 'Friendship', 'Networking'];

  const toggleSticker = (index) => {
    setSelectedStickers((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      }
      if (prev.length >= 5) {
        Alert.alert('Limit Reached', 'You can select up to 5 identity stickers.');
        return prev;
      }
      return [...prev, index];
    });
  };

  const handleSave = async () => {
    if (!accessToken) {
      navigation.goBack();
      return;
    }
    setSaving(true);
    try {
      const stickers = selectedStickers.map((i) => CULTURAL_STICKERS[i]);
      const user = await profileService.updateProfile(accessToken, {
        displayName: name.trim(),
        bio: bio.trim(),
        job: job.trim(),
        school: school.trim(),
        lookingFor,
        stickers,
      });
      updateUser(user);
      Alert.alert('Profile Updated!', 'Your changes have been saved.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="close" size={28} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn} activeOpacity={0.8}>
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Photos */}
        <Text style={styles.sectionTitle}>Photos</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosRow}>
          {currentUser.images.map((img, i) => (
            <View key={i} style={styles.photoCard}>
              <Image source={imageSource(img)} style={styles.photo} />
              <TouchableOpacity style={styles.photoRemove}>
                <Ionicons name="close-circle" size={22} color={colors.accent} />
              </TouchableOpacity>
              {i === 0 && (
                <View style={styles.mainBadge}>
                  <Text style={styles.mainBadgeText}>Main</Text>
                </View>
              )}
            </View>
          ))}
          {/* Add photo button */}
          <TouchableOpacity
            style={styles.addPhotoCard}
            onPress={() => Alert.alert('Add Photo', 'Photo picker coming soon!')}
          >
            <Ionicons name="add" size={32} color={colors.accent} />
            <Text style={styles.addPhotoText}>Add</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Basic info */}
        <Text style={styles.sectionTitle}>Basic Info</Text>
        <View style={styles.fieldGroup}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.fieldInput}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.gray400}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Bio</Text>
            <TextInput
              style={[styles.fieldInput, styles.fieldMultiline]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell people about yourself"
              placeholderTextColor={colors.gray400}
              multiline
              maxLength={200}
            />
            <Text style={styles.charCount}>{bio.length}/200</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Job</Text>
            <TextInput
              style={styles.fieldInput}
              value={job}
              onChangeText={setJob}
              placeholder="Your job title"
              placeholderTextColor={colors.gray400}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>School</Text>
            <TextInput
              style={styles.fieldInput}
              value={school}
              onChangeText={setSchool}
              placeholder="Your school"
              placeholderTextColor={colors.gray400}
            />
          </View>
        </View>

        {/* Looking For */}
        <Text style={styles.sectionTitle}>Looking For</Text>
        <View style={styles.optionsRow}>
          {lookingForOptions.map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.optionChip, lookingFor === option && styles.optionChipActive]}
              onPress={() => setLookingFor(option)}
            >
              <Text style={[styles.optionText, lookingFor === option && styles.optionTextActive]}>
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Identity Stickers */}
        <Text style={styles.sectionTitle}>Identity Stickers</Text>
        <Text style={styles.sectionSub}>Select up to 5 that represent you</Text>
        <View style={styles.stickersGrid}>
          {CULTURAL_STICKERS.map((sticker, index) => {
            const isSelected = selectedStickers.includes(index);
            return (
              <TouchableOpacity
                key={index}
                style={[styles.stickerChip, isSelected && styles.stickerChipActive]}
                onPress={() => toggleSticker(index)}
              >
                <Text style={styles.stickerEmoji}>{sticker.emoji}</Text>
                <Text style={[styles.stickerLabel, isSelected && styles.stickerLabelActive]}>
                  {sticker.label}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={16} color={colors.accent} style={{ marginLeft: 2 }} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.gray200,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    ...Typography.sectionLabel,
    color: colors.black,
  },
  saveBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveBtnText: {
    ...Typography.label,
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    ...Typography.sectionLabel,
    color: colors.black,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionSub: {
    ...Typography.caption,
    color: colors.gray400,
    marginTop: -8,
    marginBottom: 12,
  },
  photosRow: {
    flexDirection: 'row',
  },
  photoCard: {
    width: 100,
    height: 140,
    borderRadius: 14,
    marginRight: 10,
    overflow: 'hidden',
    backgroundColor: colors.gray200,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  mainBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  mainBadgeText: {
    ...Typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    fontSize: 10,
  },
  addPhotoCard: {
    width: 100,
    height: 140,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 82, 82, 0.05)',
    gap: 4,
  },
  addPhotoText: {
    ...Typography.caption,
    color: colors.accent,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  fieldGroup: {
    gap: 4,
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    ...Typography.captionBold,
    color: colors.gray,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldInput: {
    ...Typography.body,
    color: colors.black,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.cream,
  },
  fieldMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
  charCount: {
    ...Typography.caption,
    color: colors.gray400,
    textAlign: 'right',
    marginTop: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  optionChipActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(255, 82, 82, 0.08)',
  },
  optionText: {
    ...Typography.bodySmallMedium,
    color: colors.gray,
  },
  optionTextActive: {
    color: colors.accent,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  stickersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stickerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    backgroundColor: colors.white,
  },
  stickerChipActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(255, 82, 82, 0.08)',
  },
  stickerEmoji: {
    fontSize: 16,
  },
  stickerLabel: {
    ...Typography.bodySmallMedium,
    color: colors.gray,
  },
  stickerLabelActive: {
    color: colors.accent,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
});
