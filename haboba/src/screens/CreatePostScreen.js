import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import { POST_THEMES, currentUser, imageSource } from '../data/mockProfiles';

const themeKeys = Object.keys(POST_THEMES);

export default function CreatePostScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [content, setContent] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('default');
  const theme = POST_THEMES[selectedTheme];
  const isDarkCard = theme.bg === '#1C1917' || theme.bg === '#0C4A6E' || theme.bg === '#14532D' || theme.bg === '#7C2D12';

  const handlePost = () => {
    if (!content.trim()) {
      Alert.alert('Empty Post', 'Please write something before posting.');
      return;
    }
    Alert.alert('Posted!', 'Your post has been shared with the community.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
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
        <Text style={styles.headerTitle}>New Post</Text>
        <TouchableOpacity
          style={[styles.postBtn, !content.trim() && styles.postBtnDisabled]}
          onPress={handlePost}
          disabled={!content.trim()}
          activeOpacity={0.8}
        >
          <Text style={[styles.postBtnText, !content.trim() && styles.postBtnTextDisabled]}>Post</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
        {/* User info */}
        <View style={styles.userRow}>
          <Image source={imageSource(currentUser.images?.[0])} style={styles.avatar} />
          <View>
            <Text style={styles.userName}>{currentUser.name}</Text>
            <Text style={styles.userSub}>Posting to Community</Text>
          </View>
        </View>

        {/* Post preview card */}
        <View style={[styles.previewCard, { backgroundColor: theme.bg }]}>
          <TextInput
            style={[
              styles.textInput,
              { color: theme.text },
              content.length === 0 && { color: isDarkCard ? 'rgba(255,255,255,0.4)' : colors.gray400 },
            ]}
            placeholder="What's on your mind?"
            placeholderTextColor={isDarkCard ? 'rgba(255,255,255,0.4)' : colors.gray400}
            multiline
            maxLength={500}
            value={content}
            onChangeText={setContent}
            textAlignVertical="top"
          />
          <Text style={[styles.charCount, { color: isDarkCard ? 'rgba(255,255,255,0.3)' : colors.gray400 }]}>
            {content.length}/500
          </Text>
        </View>

        {/* Theme selector */}
        <Text style={styles.sectionTitle}>Card Theme</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.themeRow}>
          {themeKeys.map((key) => {
            const t = POST_THEMES[key];
            const isSelected = key === selectedTheme;
            return (
              <TouchableOpacity
                key={key}
                style={[
                  styles.themeOption,
                  { backgroundColor: t.bg, borderColor: t.accent },
                  isSelected && styles.themeOptionSelected,
                ]}
                onPress={() => setSelectedTheme(key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.themeName, { color: t.text }]}>{t.name}</Text>
                {isSelected && (
                  <View style={[styles.themeCheck, { backgroundColor: t.accent }]}>
                    <Ionicons name="checkmark" size={12} color={t.bg === '#FFFFFF' || t.bg === '#FBE8E2' || t.bg === '#EDE9FE' ? '#FFF' : '#000'} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Add media */}
        <Text style={styles.sectionTitle}>Add to Post</Text>
        <View style={styles.mediaRow}>
          <TouchableOpacity
            style={styles.mediaBtn}
            onPress={() => Alert.alert('Photos', 'Photo picker coming soon!')}
          >
            <Ionicons name="image" size={22} color={colors.accent} />
            <Text style={styles.mediaBtnText}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.mediaBtn}
            onPress={() => Alert.alert('Location', 'Location sharing coming soon!')}
          >
            <Ionicons name="location" size={22} color="#3B82F6" />
            <Text style={styles.mediaBtnText}>Location</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.mediaBtn}
            onPress={() => Alert.alert('Tag', 'Tag friends coming soon!')}
          >
            <Ionicons name="people" size={22} color="#10B981" />
            <Text style={styles.mediaBtnText}>Tag</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.mediaBtn}
            onPress={() => Alert.alert('Poll', 'Polls coming soon!')}
          >
            <Ionicons name="bar-chart" size={22} color="#F59E0B" />
            <Text style={styles.mediaBtnText}>Poll</Text>
          </TouchableOpacity>
        </View>
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
  postBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postBtnDisabled: {
    backgroundColor: colors.gray200,
  },
  postBtnText: {
    ...Typography.label,
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  postBtnTextDisabled: {
    color: colors.gray400,
  },
  body: {
    flex: 1,
    paddingHorizontal: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.gray300,
  },
  userName: {
    ...Typography.sectionLabel,
    color: colors.black,
  },
  userSub: {
    ...Typography.caption,
    color: colors.gray400,
    marginTop: 2,
  },
  previewCard: {
    borderRadius: 16,
    padding: 18,
    minHeight: 180,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  textInput: {
    ...Typography.body,
    fontSize: 17,
    lineHeight: 26,
    minHeight: 120,
    paddingTop: 0,
  },
  charCount: {
    ...Typography.caption,
    textAlign: 'right',
    marginTop: 8,
  },
  sectionTitle: {
    ...Typography.sectionLabel,
    color: colors.black,
    marginBottom: 12,
    marginTop: 8,
  },
  themeRow: {
    marginBottom: 24,
  },
  themeOption: {
    width: 80,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1.5,
  },
  themeOptionSelected: {
    borderWidth: 2.5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  themeName: {
    ...Typography.caption,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  themeCheck: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 40,
  },
  mediaBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.gray200,
    gap: 6,
  },
  mediaBtnText: {
    ...Typography.caption,
    color: colors.black,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
});
