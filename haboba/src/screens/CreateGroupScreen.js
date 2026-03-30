import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import { GraffitiCommunity } from '../components/icons';

const GROUP_CATEGORIES = [
  { id: 'social', label: 'Social', icon: 'people' },
  { id: 'culture', label: 'Culture', icon: 'globe' },
  { id: 'sports', label: 'Sports', icon: 'football' },
  { id: 'faith', label: 'Faith', icon: 'heart' },
  { id: 'professional', label: 'Professional', icon: 'briefcase' },
  { id: 'food', label: 'Food', icon: 'restaurant' },
  { id: 'music', label: 'Music', icon: 'musical-notes' },
  { id: 'diaspora', label: 'Diaspora', icon: 'airplane' },
];

const PRIVACY_OPTIONS = [
  { id: 'public', label: 'Public', desc: 'Anyone can find and join', icon: 'earth' },
  { id: 'private', label: 'Private', desc: 'Members must be approved', icon: 'lock-closed' },
];

export default function CreateGroupScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(null);
  const [privacy, setPrivacy] = useState('public');
  const [rules, setRules] = useState(['']);

  const canCreate = name.trim().length >= 3 && category;

  const handleAddRule = () => {
    if (rules.length >= 5) return;
    setRules((prev) => [...prev, '']);
  };

  const handleUpdateRule = (index, text) => {
    setRules((prev) => prev.map((r, i) => (i === index ? text : r)));
  };

  const handleRemoveRule = (index) => {
    if (rules.length <= 1) {
      setRules(['']);
      return;
    }
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = () => {
    if (!canCreate) return;

    const newGroup = {
      id: `g_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      category,
      privacy,
      rules: rules.filter((r) => r.trim()),
      members: 1,
      createdAt: new Date().toISOString(),
    };

    navigation.navigate('Main', {
      screen: 'CommunityTab',
      params: { createdGroup: newGroup },
    });
    navigation.goBack();
    Alert.alert('Group Created!', `"${newGroup.name}" is now live. Invite your friends!`);
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
        <Text style={styles.headerTitle}>New Group</Text>
        <TouchableOpacity
          style={[styles.createBtn, !canCreate && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!canCreate}
          activeOpacity={0.8}
        >
          <Text style={[styles.createBtnText, !canCreate && styles.createBtnTextDisabled]}>Create</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Group icon preview */}
        <View style={styles.iconPreview}>
          <View style={styles.iconCircle}>
            <GraffitiCommunity size={36} color={colors.accent} filled />
          </View>
          <Text style={styles.iconHint}>Group icon can be changed later</Text>
        </View>

        {/* Name */}
        <Text style={styles.label}>Group Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Junub in Minneapolis"
          placeholderTextColor={colors.gray400}
          value={name}
          onChangeText={setName}
          maxLength={50}
        />
        <Text style={styles.charHint}>{name.length}/50</Text>

        {/* Description */}
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="What's this group about?"
          placeholderTextColor={colors.gray400}
          value={description}
          onChangeText={setDescription}
          maxLength={200}
          multiline
          textAlignVertical="top"
        />
        <Text style={styles.charHint}>{description.length}/200</Text>

        {/* Category */}
        <Text style={styles.label}>Category *</Text>
        <View style={styles.categoryGrid}>
          {GROUP_CATEGORIES.map((cat) => {
            const isSelected = category === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                onPress={() => setCategory(cat.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={cat.icon}
                  size={18}
                  color={isSelected ? '#FFFFFF' : colors.gray600}
                />
                <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Privacy */}
        <Text style={styles.label}>Privacy</Text>
        <View style={styles.privacyRow}>
          {PRIVACY_OPTIONS.map((opt) => {
            const isSelected = privacy === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.privacyCard, isSelected && styles.privacyCardSelected]}
                onPress={() => setPrivacy(opt.id)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={opt.icon}
                  size={22}
                  color={isSelected ? colors.accent : colors.gray500}
                />
                <Text style={[styles.privacyLabel, isSelected && styles.privacyLabelSelected]}>
                  {opt.label}
                </Text>
                <Text style={styles.privacyDesc}>{opt.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Group Rules */}
        <View style={styles.rulesHeader}>
          <Text style={styles.label}>Group Rules</Text>
          {rules.length < 5 && (
            <TouchableOpacity onPress={handleAddRule} style={styles.addRuleBtn}>
              <Ionicons name="add-circle" size={20} color={colors.accent} />
              <Text style={styles.addRuleText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
        {rules.map((rule, index) => (
          <View key={index} style={styles.ruleInputRow}>
            <View style={styles.ruleNumber}>
              <Text style={styles.ruleNumberText}>{index + 1}</Text>
            </View>
            <TextInput
              style={styles.ruleInput}
              placeholder={`Rule ${index + 1}`}
              placeholderTextColor={colors.gray400}
              value={rule}
              onChangeText={(text) => handleUpdateRule(index, text)}
              maxLength={100}
            />
            <TouchableOpacity onPress={() => handleRemoveRule(index)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={20} color={colors.gray400} />
            </TouchableOpacity>
          </View>
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
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
    borderBottomWidth: 0,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    ...Typography.sectionLabel,
    color: colors.black,
  },
  createBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 20,
  },
  createBtnDisabled: {
    backgroundColor: colors.gray200,
  },
  createBtnText: {
    ...Typography.label,
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  createBtnTextDisabled: {
    color: colors.gray400,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
  },
  iconPreview: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: isDark ? colors.gray200 : colors.cream,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.gray200,
    borderStyle: 'dashed',
  },
  iconHint: {
    ...Typography.caption,
    color: colors.gray400,
    marginTop: 8,
  },
  label: {
    ...Typography.labelUpper,
    color: colors.gray600,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    ...Typography.bodySmall,
    color: colors.black,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: isDark ? colors.gray100 : colors.cream,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 12,
  },
  charHint: {
    ...Typography.caption,
    color: colors.gray400,
    textAlign: 'right',
    marginTop: 4,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: isDark ? colors.gray100 : colors.cream,
  },
  categoryChipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  categoryChipText: {
    ...Typography.caption,
    color: colors.gray600,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
  },
  privacyRow: {
    flexDirection: 'row',
    gap: 12,
  },
  privacyCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.gray200,
    backgroundColor: isDark ? colors.gray100 : colors.cream,
    gap: 6,
  },
  privacyCardSelected: {
    borderColor: colors.accent,
    backgroundColor: isDark ? 'rgba(206,17,38,0.1)' : 'rgba(206,17,38,0.05)',
  },
  privacyLabel: {
    ...Typography.captionBold,
    color: colors.black,
  },
  privacyLabelSelected: {
    color: colors.accent,
  },
  privacyDesc: {
    ...Typography.caption,
    color: colors.gray400,
    textAlign: 'center',
    fontSize: 12,
  },
  rulesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addRuleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 16,
  },
  addRuleText: {
    ...Typography.captionBold,
    color: colors.accent,
  },
  ruleInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  ruleNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: isDark ? colors.gray200 : colors.cream,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ruleNumberText: {
    ...Typography.captionBold,
    color: colors.accent,
  },
  ruleInput: {
    flex: 1,
    ...Typography.bodySmall,
    color: colors.black,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: isDark ? colors.gray100 : colors.cream,
  },
});
