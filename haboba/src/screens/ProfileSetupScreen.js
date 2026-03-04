import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Dimensions,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import { useAuth } from '../auth';
import * as profileService from '../api/services/profileService';
import * as ImagePicker from 'expo-image-picker';

const { width } = Dimensions.get('window');

// ─── Step Definitions ───
const STEPS = [
  { key: 'name', title: "What's your first name?", icon: 'person', subtitle: 'This is how you\'ll appear on AnaJubin.' },
  { key: 'birthday', title: 'When were you born?', icon: 'calendar', subtitle: 'Your age will be shown on your profile.' },
  { key: 'gender', title: 'What\'s your gender?', icon: 'body', subtitle: 'Select the option that best describes you.' },
  { key: 'pronouns', title: 'What are your pronouns?', icon: 'chatbubbles', subtitle: 'Select up to 4. This will be visible on your profile.' },
  { key: 'sexuality', title: 'What\'s your sexuality?', icon: 'heart', subtitle: 'This helps us find your best matches.' },
  { key: 'datePref', title: 'Who do you want to date?', icon: 'people', subtitle: 'You can always change this later.' },
  { key: 'intention', title: 'What are you looking for?', icon: 'compass', subtitle: 'Be upfront about your intentions.' },
  { key: 'ethnicity', title: 'What\'s your background?', icon: 'flag', subtitle: 'Help others learn more about you.' },
  { key: 'education', title: 'Education level', icon: 'school', subtitle: 'Optional — visible on your profile.' },
  { key: 'children', title: 'Do you have children?', icon: 'happy', subtitle: 'Optional — visible on your profile.' },
  { key: 'photos', title: 'Add your best photos', icon: 'camera', subtitle: 'Add at least 2 photos. The more, the better!' },
  { key: 'prompts', title: 'Answer a profile prompt', icon: 'chatbox-ellipses', subtitle: 'Show off your personality.' },
  { key: 'interests', title: 'What do you love?', icon: 'star', subtitle: 'Pick at least 3 interests.' },
];

// ─── Options Data ───
const GENDER_OPTIONS = ['Man', 'Woman', 'Nonbinary'];
const PRONOUN_OPTIONS = ['she/her/hers', 'he/him/his', 'they/them/theirs', 'ze/zir/zirs'];
const SEXUALITY_OPTIONS = ['Straight', 'Gay', 'Lesbian', 'Bisexual', 'Pansexual', 'Asexual', 'Queer', 'Prefer not to say'];
const DATE_PREF_OPTIONS = ['Men', 'Women', 'Everyone'];
const INTENTION_OPTIONS = ['Life partner', 'Long-term relationship', 'Short-term relationship', 'Figuring it out', 'Prefer not to say'];
const ETHNICITY_OPTIONS = ['Dinka', 'Nuer', 'Shilluk', 'Bari', 'Zande', 'Acholi', 'Murle', 'Toposa', 'Lotuko', 'Madi', 'Luo', 'Other'];
const EDUCATION_OPTIONS = ['High school', 'Some college', 'Associate degree', 'Bachelor\'s degree', 'Master\'s degree', 'Doctorate', 'Trade school', 'Prefer not to say'];
const CHILDREN_OPTIONS = ['No children', 'Have children', 'Want children someday', 'Don\'t want children', 'Open to children', 'Prefer not to say'];
const INTEREST_OPTIONS = [
  'Cooking', 'Basketball', 'Music', 'Travel', 'Fashion', 'Faith', 'Fitness', 'Tech',
  'Art', 'Reading', 'Movies', 'Gaming', 'Dancing', 'Business', 'Photography', 'Soccer',
  'Poetry', 'Singing', 'Running', 'Volunteering', 'Food', 'Nature', 'Languages', 'History',
];
const PROMPT_OPTIONS = [
  'The way to my heart is...',
  'A fun fact about me is...',
  'My ideal Sunday looks like...',
  'I\'m looking for someone who...',
  'My most controversial opinion is...',
  'Two truths and a lie...',
  'I get along best with people who...',
  'My love language is...',
];

const ProfileSetupScreen = ({ navigation }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const insets = useSafeAreaInsets();
  const { session, updateUser } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [selectedGender, setSelectedGender] = useState('');
  const [selectedPronouns, setSelectedPronouns] = useState([]);
  const [selectedSexuality, setSelectedSexuality] = useState('');
  const [selectedDatePref, setSelectedDatePref] = useState('');
  const [selectedIntention, setSelectedIntention] = useState('');
  const [selectedEthnicity, setSelectedEthnicity] = useState('');
  const [selectedEducation, setSelectedEducation] = useState('');
  const [selectedChildren, setSelectedChildren] = useState('');
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [promptAnswer, setPromptAnswer] = useState('');
  const [photos, setPhotos] = useState(Array(6).fill(null));

  // Visibility toggles (BLK feature)
  const [showGender, setShowGender] = useState(true);
  const [showPronouns, setShowPronouns] = useState(true);
  const [showSexuality, setShowSexuality] = useState(false);
  const [showEthnicity, setShowEthnicity] = useState(true);

  const totalSteps = STEPS.length;
  const step = STEPS[currentStep];

  const saveProfileToApi = async () => {
    if (!session) {
      navigation.navigate('Main');
      return;
    }
    setSaving(true);
    try {
      // Parse birthDate MM/DD/YYYY → ISO
      let dateOfBirth;
      if (birthDate.length === 10) {
        const [mm, dd, yyyy] = birthDate.split('/');
        dateOfBirth = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`).toISOString();
      }

      // Map gender
      const genderMap = { Man: 'man', Woman: 'woman', Nonbinary: 'non_binary' };

      const updates = {
        displayName: firstName.trim(),
        ...(dateOfBirth ? { dateOfBirth } : {}),
        ...(selectedGender ? { gender: genderMap[selectedGender] || 'other' } : {}),
        pronouns: selectedPronouns.join(', '),
        sexuality: selectedSexuality,
        lookingForGender: selectedDatePref,
        datingIntentions: selectedIntention,
        ethnicity: selectedEthnicity,
        education: selectedEducation,
        children: selectedChildren,
        interests: selectedInterests,
        promptQuestion: selectedPrompt,
        promptAnswer: promptAnswer.trim(),
        profileComplete: true,
      };

      const user = await profileService.updateProfile(updates);
      updateUser(user);

      // Upload photos
      const photoUris = photos.filter(Boolean);
      for (const uri of photoUris) {
        try {
          await profileService.uploadPhoto(uri);
        } catch (e) {
          if (__DEV__) console.warn('Photo upload failed:', e.message);
        }
      }

      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      saveProfileToApi();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      navigation.goBack();
    }
  };

  const handleDateChange = (text) => {
    const digits = text.replace(/\D/g, '');
    let formatted = '';
    if (digits.length <= 2) {
      formatted = digits;
    } else if (digits.length <= 4) {
      formatted = digits.slice(0, 2) + '/' + digits.slice(2);
    } else {
      formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
    }
    setBirthDate(formatted);
  };

  const togglePronoun = (p) => {
    if (selectedPronouns.includes(p)) {
      setSelectedPronouns(selectedPronouns.filter((x) => x !== p));
    } else if (selectedPronouns.length < 4) {
      setSelectedPronouns([...selectedPronouns, p]);
    }
  };

  const toggleInterest = (interest) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const handlePhotoTap = async (index) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setPhotos((prev) => {
        const updated = [...prev];
        updated[index] = result.assets[0].uri;
        return updated;
      });
    }
  };

  const isStepValid = () => {
    switch (step.key) {
      case 'name': return firstName.trim().length > 0;
      case 'birthday': return birthDate.length === 10;
      case 'gender': return !!selectedGender;
      case 'pronouns': return selectedPronouns.length > 0;
      case 'sexuality': return !!selectedSexuality;
      case 'datePref': return !!selectedDatePref;
      case 'intention': return !!selectedIntention;
      case 'ethnicity': return !!selectedEthnicity;
      case 'education': return !!selectedEducation;
      case 'children': return !!selectedChildren;
      case 'photos': return true; // optional for now
      case 'prompts': return !!selectedPrompt && promptAnswer.trim().length > 0;
      case 'interests': return selectedInterests.length >= 3;
      default: return true;
    }
  };

  const canSkip = ['education', 'children', 'photos', 'prompts'].includes(step.key);

  // ─── Render Helpers ───
  const renderRadioOption = (option, selected, onSelect) => (
    <TouchableOpacity
      key={option}
      style={[styles.radioRow, selected === option && styles.radioRowActive]}
      onPress={() => onSelect(option)}
      activeOpacity={0.7}
    >
      <Text style={[styles.radioText, selected === option && styles.radioTextActive]}>
        {option}
      </Text>
      <View style={[styles.radioCircle, selected === option && styles.radioCircleActive]}>
        {selected === option && <View style={styles.radioCircleInner} />}
      </View>
    </TouchableOpacity>
  );

  const renderCheckOption = (option, selectedArr, onToggle) => {
    const isSelected = selectedArr.includes(option);
    return (
      <TouchableOpacity
        key={option}
        style={[styles.radioRow, isSelected && styles.radioRowActive]}
        onPress={() => onToggle(option)}
        activeOpacity={0.7}
      >
        <Text style={[styles.radioText, isSelected && styles.radioTextActive]}>
          {option}
        </Text>
        <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
          {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
        </View>
      </TouchableOpacity>
    );
  };

  const renderVisibilityToggle = (label, value, onToggle) => (
    <View style={styles.visibilityRow}>
      <Text style={styles.visibilityLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.gray200, true: colors.accent }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={colors.gray200}
      />
    </View>
  );

  // ─── Step Content ───
  const renderStepContent = () => {
    switch (step.key) {
      case 'name':
        return (
          <View style={styles.stepContent}>
            <TextInput
              style={styles.textInput}
              placeholder="Your first name"
              placeholderTextColor={colors.gray400}
              value={firstName}
              onChangeText={setFirstName}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              autoFocus
            />
            <Text style={styles.helperText}>This cannot be changed later.</Text>
          </View>
        );

      case 'birthday':
        return (
          <View style={styles.stepContent}>
            <TextInput
              style={styles.textInput}
              placeholder="MM/DD/YYYY"
              placeholderTextColor={colors.gray400}
              value={birthDate}
              onChangeText={handleDateChange}
              keyboardType="number-pad"
              maxLength={10}
              autoFocus
            />
            <Text style={styles.helperText}>You must be 18 or older to use AnaJubin.</Text>
          </View>
        );

      case 'gender':
        return (
          <View style={styles.stepContent}>
            {GENDER_OPTIONS.map((opt) => renderRadioOption(opt, selectedGender, setSelectedGender))}
            {renderVisibilityToggle('Visible on profile', showGender, setShowGender)}
          </View>
        );

      case 'pronouns':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.selectHint}>Select up to 4</Text>
            {PRONOUN_OPTIONS.map((opt) => renderCheckOption(opt, selectedPronouns, togglePronoun))}
            {renderVisibilityToggle('Visible on profile', showPronouns, setShowPronouns)}
          </View>
        );

      case 'sexuality':
        return (
          <View style={styles.stepContent}>
            {SEXUALITY_OPTIONS.map((opt) => renderRadioOption(opt, selectedSexuality, setSelectedSexuality))}
            {renderVisibilityToggle('Visible on profile', showSexuality, setShowSexuality)}
          </View>
        );

      case 'datePref':
        return (
          <View style={styles.stepContent}>
            {DATE_PREF_OPTIONS.map((opt) => renderRadioOption(opt, selectedDatePref, setSelectedDatePref))}
          </View>
        );

      case 'intention':
        return (
          <View style={styles.stepContent}>
            {INTENTION_OPTIONS.map((opt) => renderRadioOption(opt, selectedIntention, setSelectedIntention))}
          </View>
        );

      case 'ethnicity':
        return (
          <View style={styles.stepContent}>
            {ETHNICITY_OPTIONS.map((opt) => renderRadioOption(opt, selectedEthnicity, setSelectedEthnicity))}
            {renderVisibilityToggle('Visible on profile', showEthnicity, setShowEthnicity)}
          </View>
        );

      case 'education':
        return (
          <View style={styles.stepContent}>
            {EDUCATION_OPTIONS.map((opt) => renderRadioOption(opt, selectedEducation, setSelectedEducation))}
          </View>
        );

      case 'children':
        return (
          <View style={styles.stepContent}>
            {CHILDREN_OPTIONS.map((opt) => renderRadioOption(opt, selectedChildren, setSelectedChildren))}
          </View>
        );

      case 'photos':
        return (
          <View style={styles.stepContent}>
            <View style={styles.photoGrid}>
              {photos.map((photo, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.photoSlot, index === 0 && styles.photoSlotPrimary]}
                  onPress={() => handlePhotoTap(index)}
                  activeOpacity={0.7}
                >
                  {photo ? (
                    <Image source={{ uri: photo }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  ) : (
                    <View style={styles.photoAddCircle}>
                      <Ionicons name="add" size={28} color={colors.accent} />
                    </View>
                  )}
                  {index === 0 && (
                    <View style={styles.photoPrimaryBadge}>
                      <Text style={styles.photoPrimaryText}>Main</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.helperText}>
              Tip: Profiles with 4+ photos get 3x more matches!
            </Text>
          </View>
        );

      case 'prompts':
        return (
          <View style={styles.stepContent}>
            {!selectedPrompt ? (
              <>
                <Text style={styles.selectHint}>Choose a prompt</Text>
                {PROMPT_OPTIONS.map((prompt) => (
                  <TouchableOpacity
                    key={prompt}
                    style={styles.promptOption}
                    onPress={() => setSelectedPrompt(prompt)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.promptOptionText}>{prompt}</Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.selectedPromptHeader}
                  onPress={() => { setSelectedPrompt(''); setPromptAnswer(''); }}
                >
                  <Text style={styles.selectedPromptText}>{selectedPrompt}</Text>
                  <Ionicons name="close-circle" size={20} color={colors.gray400} />
                </TouchableOpacity>
                <TextInput
                  style={styles.promptInput}
                  placeholder="Write your answer..."
                  placeholderTextColor={colors.gray400}
                  value={promptAnswer}
                  onChangeText={setPromptAnswer}
                  multiline
                  maxLength={250}
                  textAlignVertical="top"
                  autoFocus
                />
                <Text style={styles.charCount}>{promptAnswer.length}/250</Text>
              </>
            )}
          </View>
        );

      case 'interests':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.selectHint}>
              {selectedInterests.length}/3 minimum selected
            </Text>
            <View style={styles.chipGrid}>
              {INTEREST_OPTIONS.map((interest) => {
                const isActive = selectedInterests.includes(interest);
                return (
                  <TouchableOpacity
                    key={interest}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() => toggleInterest(interest)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                      {interest}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={{ flex: 1 }}>
          {/* ── Header ── */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={24} color={colors.black} />
            </TouchableOpacity>

            {/* Progress Dots (BLK style) */}
            <View style={styles.progressDots}>
              {STEPS.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressDot,
                    i <= currentStep && styles.progressDotActive,
                    i === currentStep && styles.progressDotCurrent,
                  ]}
                />
              ))}
            </View>

            {canSkip ? (
              <TouchableOpacity onPress={handleNext}>
                <Text style={styles.skipBtn}>Skip</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>

          {/* ── Step Icon ── */}
          <View style={styles.stepIconWrap}>
            <View style={styles.stepIconCircle}>
              <Ionicons name={step.icon} size={28} color={colors.accent} />
            </View>
          </View>

          {/* ── Title ── */}
          <View style={styles.titleSection}>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepSubtitle}>{step.subtitle}</Text>
          </View>

          {/* ── Content ── */}
          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContentInner}
          >
            {renderStepContent()}
          </ScrollView>

          {/* ── Footer ── */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.footerLeft}>
              <Text style={styles.stepCounter}>
                {currentStep + 1} of {totalSteps}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.nextCircle, (!isStepValid() || saving) && styles.nextCircleDisabled]}
              onPress={handleNext}
              disabled={!isStepValid() || saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Ionicons
                  name={currentStep === totalSteps - 1 ? 'checkmark' : 'arrow-forward'}
                  size={28}
                  color="#FFFFFF"
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  progressDot: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.gray200,
    maxWidth: 24,
  },
  progressDotActive: {
    backgroundColor: colors.accent,
  },
  progressDotCurrent: {
    backgroundColor: colors.accent,
    height: 4,
  },
  skipBtn: {
    ...Typography.label,
    color: colors.accent,
    width: 40,
    textAlign: 'right',
  },

  // ─── Step Icon ───
  stepIconWrap: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  stepIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accentTint08,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.accentTint15,
  },

  // ─── Title ───
  titleSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: colors.black,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  stepSubtitle: {
    ...Typography.bodySmall,
    color: colors.gray500,
    lineHeight: 22,
  },

  // ─── Scroll Content ───
  scrollContent: {
    flex: 1,
  },
  scrollContentInner: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  stepContent: {
    flex: 1,
  },

  // ─── Text Input ───
  textInput: {
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    fontSize: 18,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.black,
  },
  helperText: {
    ...Typography.caption,
    color: colors.gray400,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  selectHint: {
    ...Typography.caption,
    color: colors.accent,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    marginBottom: 12,
  },

  // ─── Radio Options ───
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.inputBg,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
  },
  radioRowActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentTint04,
  },
  radioText: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: FontFamily.medium,
    color: colors.gray600,
    flex: 1,
  },
  radioTextActive: {
    color: colors.black,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.gray300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleActive: {
    borderColor: colors.accent,
  },
  radioCircleInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.accent,
  },

  // ─── Checkbox ───
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.gray300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },

  // ─── Visibility Toggle ───
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 4,
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
  },
  visibilityLabel: {
    ...Typography.bodySmallMedium,
    color: colors.gray500,
  },

  // ─── Photo Grid ───
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoSlot: {
    width: (width - 48 - 24) / 3,
    aspectRatio: 3 / 4,
    backgroundColor: colors.inputBg,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.inputBorder,
    borderStyle: 'dashed',
  },
  photoSlotPrimary: {
    width: (width - 48 - 12) / 2,
    borderColor: colors.accent,
    borderWidth: 2,
  },
  photoAddCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentTint08,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPrimaryBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  photoPrimaryText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
  },

  // ─── Prompts ───
  promptOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: colors.inputBg,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  promptOptionText: {
    fontSize: 15,
    fontWeight: '500',
    fontFamily: FontFamily.medium,
    color: colors.gray600,
    flex: 1,
    marginRight: 8,
  },
  selectedPromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accentTint06,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.accentTint15,
  },
  selectedPromptText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: colors.accent,
    flex: 1,
  },
  promptInput: {
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    fontSize: 16,
    color: colors.black,
    minHeight: 120,
    lineHeight: 24,
  },
  charCount: {
    ...Typography.caption,
    color: colors.gray400,
    textAlign: 'right',
    marginTop: 8,
  },

  // ─── Interest Chips ───
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    backgroundColor: colors.white,
  },
  chipActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.gray500,
  },
  chipTextActive: {
    color: isDark ? colors.gray900 : '#FFFFFF',
  },

  // ─── Footer ───
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
  },
  footerLeft: {
    flex: 1,
  },
  stepCounter: {
    ...Typography.caption,
    color: colors.gray400,
    fontWeight: '600',
  },
  nextCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  nextCircleDisabled: {
    opacity: 0.3,
  },
});

export default ProfileSetupScreen;
