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
import * as ImagePicker from 'expo-image-picker';
import { useTheme, Typography, FontFamily } from '../theme';
import { POST_THEMES } from '../data/mockProfiles';
import { imageSource } from '../utils/imageSource';
import { useCurrentUser } from '../hooks';
import { GraffitiLocation } from '../components/icons';
import { SpraySplatter } from '../components/GraffitiAccents';
import { buildPostContent } from '../utils/postComposer';

const themeKeys = Object.keys(POST_THEMES);

export default function CreatePostScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);
  const { currentUser } = useCurrentUser();

  const [content, setContent] = useState('');
  const [postImage, setPostImage] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState('default');
  const [location, setLocation] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionA, setPollOptionA] = useState('');
  const [pollOptionB, setPollOptionB] = useState('');
  const [activeComposerSection, setActiveComposerSection] = useState(null);
  const theme = POST_THEMES[selectedTheme];
  const isDarkCard = theme.bg === '#262626' || theme.bg === '#0C4A6E' || theme.bg === '#14532D' || theme.bg === '#7C2D12';
  const composedContent = buildPostContent({
    content,
    location,
    tags,
    pollQuestion,
    pollOptions: [pollOptionA, pollOptionB],
  });
  const canPost = Boolean(composedContent.trim() || postImage);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow photo access to add images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setPostImage(result.assets[0].uri);
    }
  };

  const handleAddTag = () => {
    const clean = tagInput.trim().replace(/^@+/, '');
    if (!clean) return;
    if (tags.some((name) => name.toLowerCase() === clean.toLowerCase())) {
      setTagInput('');
      return;
    }
    setTags((prev) => [...prev, clean]);
    setTagInput('');
  };

  const handleRemoveTag = (name) => {
    setTags((prev) => prev.filter((t) => t !== name));
  };

  const handlePost = () => {
    if (!canPost) {
      Alert.alert('Empty Post', 'Add text, photo, location, tags, or a poll before posting.');
      return;
    }

    const newPost = {
      id: `u_${Date.now()}`,
      user: {
        name: currentUser.name || 'You',
        avatar: currentUser.images?.[0] || currentUser.avatar,
        location: currentUser?.preferences?.location || 'Your area',
      },
      timestamp: 'Just now',
      content: composedContent,
      image: postImage,
      likes: 0,
      comments: 0,
      cardTheme: selectedTheme,
    };

    navigation.navigate('Main', {
      screen: 'CommunityTab',
      params: { createdPost: newPost },
    });
    navigation.goBack();
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
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>New Post</Text>

        </View>
        <TouchableOpacity
          style={[styles.postBtn, !canPost && styles.postBtnDisabled]}
          onPress={handlePost}
          disabled={!canPost}
          activeOpacity={0.8}
        >
          <Text style={[styles.postBtnText, !canPost && styles.postBtnTextDisabled]}>Post</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
        {/* Ambient spray accents */}
        <View style={{ position: 'absolute', right: 8, top: 10 }} pointerEvents="none">
          <SpraySplatter size={30} color="#22C55E" opacity={0.05} />
        </View>
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
          {postImage && (
            <View style={{ marginTop: 8, borderRadius: 12, overflow: 'hidden' }}>
              <Image source={{ uri: postImage }} style={{ width: '100%', height: 180, borderRadius: 12 }} />
              <TouchableOpacity
                style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 }}
                onPress={() => setPostImage(null)}
              >
                <Ionicons name="close" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}
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
        <View style={{ alignItems: 'center', marginBottom: 8 }}>

        </View>
        <Text style={styles.sectionTitle}>Add to Post</Text>
        <View style={styles.mediaRow}>
          <TouchableOpacity
            style={styles.mediaBtn}
            onPress={handlePickImage}
          >
            <Ionicons name="image" size={22} color={colors.accent} />
            <Text style={styles.mediaBtnText}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mediaBtn, activeComposerSection === 'location' && styles.mediaBtnActive]}
            onPress={() => setActiveComposerSection((prev) => (prev === 'location' ? null : 'location'))}
          >
            <GraffitiLocation size={22} color="#3B82F6" filled />
            <Text style={styles.mediaBtnText}>Location</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mediaBtn, activeComposerSection === 'tag' && styles.mediaBtnActive]}
            onPress={() => setActiveComposerSection((prev) => (prev === 'tag' ? null : 'tag'))}
          >
            <Ionicons name="people" size={22} color="#10B981" />
            <Text style={styles.mediaBtnText}>Tag</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mediaBtn, activeComposerSection === 'poll' && styles.mediaBtnActive]}
            onPress={() => setActiveComposerSection((prev) => (prev === 'poll' ? null : 'poll'))}
          >
            <Ionicons name="bar-chart" size={22} color="#F59E0B" />
            <Text style={styles.mediaBtnText}>Poll</Text>
          </TouchableOpacity>
        </View>

        {activeComposerSection === 'location' && (
          <View style={styles.composeCard}>
            <Text style={styles.composeTitle}>Add location</Text>
            <TextInput
              style={styles.composeInput}
              placeholder="Enter neighborhood or city"
              placeholderTextColor={colors.gray400}
              value={location}
              onChangeText={setLocation}
              maxLength={50}
            />
          </View>
        )}

        {activeComposerSection === 'tag' && (
          <View style={styles.composeCard}>
            <Text style={styles.composeTitle}>Tag people</Text>
            <View style={styles.tagInputRow}>
              <TextInput
                style={[styles.composeInput, styles.tagInput]}
                placeholder="Type a name"
                placeholderTextColor={colors.gray400}
                value={tagInput}
                onChangeText={setTagInput}
                onSubmitEditing={handleAddTag}
                returnKeyType="done"
                maxLength={20}
              />
              <TouchableOpacity style={styles.addTagBtn} onPress={handleAddTag} activeOpacity={0.8}>
                <Text style={styles.addTagBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
            {tags.length > 0 && (
              <View style={styles.tagChipWrap}>
                {tags.map((name) => (
                  <TouchableOpacity key={name} style={styles.tagChip} onPress={() => handleRemoveTag(name)}>
                    <Text style={styles.tagChipText}>@{name}</Text>
                    <Ionicons name="close" size={12} color={colors.accent} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {activeComposerSection === 'poll' && (
          <View style={styles.composeCard}>
            <Text style={styles.composeTitle}>Create poll</Text>
            <TextInput
              style={styles.composeInput}
              placeholder="Poll question"
              placeholderTextColor={colors.gray400}
              value={pollQuestion}
              onChangeText={setPollQuestion}
              maxLength={80}
            />
            <TextInput
              style={[styles.composeInput, styles.composeInputGap]}
              placeholder="Option 1"
              placeholderTextColor={colors.gray400}
              value={pollOptionA}
              onChangeText={setPollOptionA}
              maxLength={40}
            />
            <TextInput
              style={[styles.composeInput, styles.composeInputGap]}
              placeholder="Option 2"
              placeholderTextColor={colors.gray400}
              value={pollOptionB}
              onChangeText={setPollOptionB}
              maxLength={40}
            />
          </View>
        )}
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
  mediaBtnActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentTint05,
  },
  mediaBtnText: {
    ...Typography.caption,
    color: colors.black,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  composeCard: {
    marginTop: -2,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.gray200,
    backgroundColor: colors.cream,
    padding: 12,
  },
  composeTitle: {
    ...Typography.captionBold,
    color: colors.gray600,
    marginBottom: 8,
  },
  composeInput: {
    ...Typography.bodySmall,
    color: colors.black,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.white,
  },
  composeInputGap: {
    marginTop: 8,
  },
  tagInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  tagInput: {
    flex: 1,
  },
  addTagBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.accent,
  },
  addTagBtnText: {
    ...Typography.captionBold,
    color: '#FFFFFF',
  },
  tagChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.accentTint08,
    borderWidth: 1,
    borderColor: colors.accentTint15,
  },
  tagChipText: {
    ...Typography.caption,
    color: colors.accent,
    fontFamily: FontFamily.semibold,
  },
});
