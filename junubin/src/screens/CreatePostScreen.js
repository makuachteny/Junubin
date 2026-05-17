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
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useTheme, Typography, FontFamily } from '../theme';
import { POST_THEMES } from '../data/postThemes';
import { imageSource } from '../utils/imageSource';
import { useCurrentUser } from '../hooks';
import { GraffitiLocation } from '../components/icons';
import { SpraySplatter } from '../components/GraffitiAccents';
import { buildPostContent } from '../utils/postComposer';
import PostCard from '../components/PostCard';
import { normalizeHttpUrl } from '../utils/links';
import * as postService from '../api/services/postService';
import { promptToOpenSettings } from '../utils/permissionAlert';

const themeKeys = Object.keys(POST_THEMES);

export default function CreatePostScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const { currentUser } = useCurrentUser();
  // When opened via "Repost with your thoughts" the original post
  // travels in route.params.quotedPost. We render it as an embedded
  // preview and forward its id on submit so postService writes the
  // Post.quotedPostId FK + the silent PostRepost row (00036/00035).
  const quotedPost = route?.params?.quotedPost || null;
  const isRepostMode = !!quotedPost;

  // ── State ──
  const [step, setStep] = useState('compose'); // 'compose' | 'preview'
  const [content, setContent] = useState('');
  const [postImage, setPostImage] = useState(null);
  // Media metadata captured at picker time so the new aspect-aware
  // PostCard can render the media at its natural ratio without doing
  // a deferred Image.getSize round trip on every feed render. Video
  // posts also need mediaType to render the right component.
  const [mediaType, setMediaType] = useState(null);    // 'image' | 'video' | null
  const [aspectRatio, setAspectRatio] = useState(null);
  const [selectedTheme, setSelectedTheme] = useState('default');
  const [location, setLocation] = useState('');
  const [liveLocationEnabled, setLiveLocationEnabled] = useState(false);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [signupLink, setSignupLink] = useState('');
  const [signupTitle, setSignupTitle] = useState('');
  const [activeComposerSection, setActiveComposerSection] = useState(null);
  const [signupError, setSignupError] = useState('');

  const theme = POST_THEMES[selectedTheme];
  const isDarkCard = theme.bg === '#262626' || theme.bg === '#0C4A6E' || theme.bg === '#14532D' || theme.bg === '#7C2D12'
    || theme.bg === '#0E4D64' || theme.bg === '#1A5276' || theme.bg === '#1B4332';

  const normalizedSignupLink = normalizeHttpUrl(signupLink);
  const hasInvalidSignup = Boolean(signupLink.trim()) && !normalizedSignupLink;

  const composedContent = buildPostContent({
    content,
    location,
  });
  // A quote-repost is always valid on its own — even with no extra
  // text or media the user is endorsing/relaying the original. So
  // when isRepostMode is true we skip the "must have something"
  // check.
  const canPost = isRepostMode
    || Boolean(composedContent.trim() || postImage || signupLink.trim());

  // ── Build the preview post object ──
  // Safe optional-chaining everywhere — currentUser can be null while the
  // profile fetch is in flight or when the user is in dev-bypass mode.
  // Without these guards, the preview render throws and the Post button
  // silently does nothing.
  const previewPost = useMemo(() => ({
    id: `preview_${Date.now()}`,
    user: {
      id: currentUser?.id,
      name: currentUser?.name || 'You',
      avatar: currentUser?.images?.[0] || currentUser?.avatar || null,
      location: location || currentUser?.preferences?.location || 'Your area',
      verified: !!currentUser?.verified,
    },
    timestamp: 'Just now',
    content: composedContent,
    image: mediaType === 'video' ? null : postImage,
    video: mediaType === 'video' ? postImage : null,
    mediaType: postImage ? mediaType : null,
    aspectRatio,
    likes: 0,
    comments: 0,
    cardTheme: selectedTheme,
    signupLink: normalizedSignupLink || signupLink.trim() || null,
    signupTitle: signupTitle.trim() || null,
  }), [composedContent, postImage, mediaType, aspectRatio, selectedTheme, signupLink, signupTitle, currentUser, location, normalizedSignupLink]);

  // ── Handlers ──
  // The picker accepts both photos and videos. ImagePicker returns
  // width + height on the asset, so we compute aspect ratio here
  // (instead of measuring after upload) and pass it through to the
  // Post row — the renderer reads it directly without a getSize call.
  const handlePickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      promptToOpenSettings({
        title: 'Photo access needed',
        message: 'JuNubin needs photo & video access to add media to your post. Open Settings to enable it.',
      });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      // Disabled for videos — Expo's editor only crops images. For
      // photos, allowsEditing locks 1:1 which we don't want now that
      // the renderer is aspect-aware. So leave it false.
      allowsEditing: false,
      quality: 0.8,
      videoMaxDuration: 60,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const isVideo = asset.type === 'video' || asset.mimeType?.startsWith('video/');
    const w = Number(asset.width) || 1;
    const h = Number(asset.height) || 1;
    setPostImage(asset.uri);
    setMediaType(isVideo ? 'video' : 'image');
    // Clamp the aspect ratio to a usable range. Anything more extreme
    // than 0.5..2.0 turns into a wall-of-card or a sliver in the feed
    // — Instagram does the same kind of clamp on uploads.
    const raw = w / h;
    setAspectRatio(Math.min(Math.max(raw, 0.5625), 1.91));
  };

  // Back-compat alias — older render branches reference `handlePickImage`.
  const handlePickImage = handlePickMedia;

  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    if (hasInvalidSignup) {
      setSignupError('Please enter a valid URL (e.g. https://example.com).');
      Alert.alert('Invalid Link', 'Please enter a valid event link.');
      return;
    }
    if (normalizedSignupLink && normalizedSignupLink !== signupLink.trim()) {
      setSignupLink(normalizedSignupLink);
    }
    if (posting) return;
    setPosting(true);
    try {
      const created = await postService.createPost({
        content: composedContent.trim(),
        mediaUri: postImage,
        mediaType,
        aspectRatio,
        location,
        cardTheme: selectedTheme,
        signupLink: normalizedSignupLink || null,
        signupTitle: signupTitle.trim() || null,
        quotedPostId: quotedPost?.id || null,
      });
      // Land back on Community with the freshly-persisted post in params
      // so the feed prepends it instantly without waiting for the next
      // refetch / Realtime delivery.
      navigation.navigate('Main', {
        screen: 'CommunityTab',
        params: { createdPost: created },
      });
    } catch (err) {
      Alert.alert('Could not post', err?.message || 'Try again in a moment.');
    } finally {
      setPosting(false);
    }
  };

  const handleNext = () => {
    // In repost-with-thoughts mode there's no second-screen preview
    // worth showing — the embedded original is already visible in the
    // compose card, and themes/media/signup are hidden. Submit straight
    // to the server so it feels like LinkedIn's "Post" button.
    if (isRepostMode) {
      handlePost();
      return;
    }
    if (!canPost) {
      Alert.alert('Empty Post', 'Add text, photo, or an event link before continuing.');
      return;
    }
    if (hasInvalidSignup) {
      setSignupError('Please enter a valid URL (e.g. https://example.com).');
      Alert.alert('Invalid Link', 'Please enter a valid event link.');
      return;
    }
    if (normalizedSignupLink && normalizedSignupLink !== signupLink.trim()) {
      setSignupLink(normalizedSignupLink);
    }
    setStep('preview');
  };

  const handleFetchLocation = async () => {
    if (liveLocationEnabled) {
      setLiveLocationEnabled(false);
      setLocation('');
      return;
    }
    setFetchingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        promptToOpenSettings({
          title: 'Location access needed',
          message: 'Share where you’re posting from. You can enable location for JuNubin in Settings.',
        });
        setFetchingLocation(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      const place = geo ? [geo.city, geo.region, geo.country].filter(Boolean).join(', ') : 'Unknown location';
      setLocation(place);
      setLiveLocationEnabled(true);
    } catch {
      Alert.alert('Error', 'Could not fetch your location. Try again.');
    } finally {
      setFetchingLocation(false);
    }
  };

  // ════════════════════════════════════════════════════════════
  // STEP 2: PREVIEW
  // ════════════════════════════════════════════════════════════
  if (step === 'preview') {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => setStep('compose')} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.black} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.headerTitle}>Preview</Text>
            <Text style={styles.headerSub}>This is how your post will look</Text>
          </View>
          <TouchableOpacity
            style={styles.postBtn}
            onPress={handlePost}
            activeOpacity={0.8}
          >
            <Text style={styles.postBtnText}>Post</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.previewBody}
          contentContainerStyle={styles.previewScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* The actual PostCard rendered exactly as it will appear in the feed */}
          <PostCard post={previewPost} />

          {/* Edit hint */}
          <TouchableOpacity style={styles.editHint} onPress={() => setStep('compose')} activeOpacity={0.7}>
            <Ionicons name="create-outline" size={16} color={colors.accent} />
            <Text style={styles.editHintText}>Tap to go back and edit</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ═════════════════════════════════��══════════════════════════
  // STEP 1: COMPOSE
  // ════════════════════════════════════════════════════════════
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="close" size={26} color={colors.black} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>New Post</Text>
        </View>
        <TouchableOpacity
          style={[styles.nextBtn, (!canPost || posting) && styles.nextBtnDisabled]}
          onPress={handleNext}
          disabled={!canPost || posting}
          activeOpacity={0.8}
        >
          <Text style={[styles.nextBtnText, (!canPost || posting) && styles.nextBtnTextDisabled]}>
            {isRepostMode ? (posting ? 'Posting…' : 'Post') : 'Next'}
          </Text>
          {!isRepostMode && (
            <Ionicons name="arrow-forward" size={16} color={canPost ? '#FFFFFF' : colors.gray400} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Ambient spray */}
        <View style={{ position: 'absolute', right: 8, top: 10 }} pointerEvents="none">
          <SpraySplatter size={30} color={colors.green} opacity={0.05} />
        </View>

        {/* User info */}
        <View style={styles.userRow}>
          <Image source={imageSource(currentUser?.images?.[0])} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{currentUser?.name || 'You'}</Text>
            <Text style={styles.userSub}>
              {isRepostMode ? `Reposting ${quotedPost?.user?.name || 'a post'}` : 'Posting to Community'}
            </Text>
          </View>
        </View>

        {/* ─── Post content card ─── */}
        <View style={[styles.composePreview, { backgroundColor: theme.bg, borderColor: isDarkCard ? 'rgba(255,255,255,0.1)' : colors.gray200 }]}>
          <TextInput
            style={[
              styles.textInput,
              { color: theme.text },
              content.length === 0 && { color: isDarkCard ? 'rgba(255,255,255,0.4)' : colors.gray400 },
            ]}
            placeholder={isRepostMode ? 'Share your thoughts…' : "What's on your mind?"}
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

          {/* Attached image / video */}
          {postImage && (
            <View style={styles.attachedImageWrap}>
              <Image source={{ uri: postImage }} style={styles.attachedImage} />
              {mediaType === 'video' && (
                <View style={styles.videoBadge} pointerEvents="none">
                  <Ionicons name="videocam" size={14} color="#FFF" />
                  <Text style={styles.videoBadgeText}>Video</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.removeImageBtn}
                onPress={() => {
                  setPostImage(null);
                  setMediaType(null);
                  setAspectRatio(null);
                }}
              >
                <Ionicons name="close" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Signup link preview inline */}
          {signupLink.trim() ? (
            <View style={[styles.inlineSignup, { borderColor: isDarkCard ? 'rgba(255,255,255,0.15)' : 'rgba(0,151,57,0.2)' }]}>
              <Ionicons name="ticket" size={16} color={isDarkCard ? '#48C9B0' : colors.green} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.inlineSignupTitle, { color: theme.text }]} numberOfLines={1}>
                  {signupTitle.trim() || 'Event Sign Up'}
                </Text>
                <Text style={[styles.inlineSignupUrl, { color: isDarkCard ? 'rgba(255,255,255,0.4)' : colors.gray400 }]} numberOfLines={1}>
                  {normalizedSignupLink || signupLink}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setSignupLink(''); setSignupTitle(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={isDarkCard ? 'rgba(255,255,255,0.4)' : colors.gray400} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* ─── Quoted post preview (repost-with-thoughts mode) ─── */}
        {isRepostMode && (
          <View style={[styles.quotedPreview, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255,255,255,0.10)' : colors.gray200,
          }]}>
            <View style={styles.quotedHeader}>
              <Image
                source={imageSource(quotedPost.user?.avatar)}
                style={styles.quotedAvatar}
              />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.quotedName} numberOfLines={1}>
                    {quotedPost.user?.name}
                  </Text>
                  {quotedPost.user?.verified && (
                    <Ionicons name="checkmark-circle" size={12} color="#0A66C2" />
                  )}
                </View>
                {quotedPost.timestamp && (
                  <Text style={styles.quotedMeta} numberOfLines={1}>{quotedPost.timestamp}</Text>
                )}
              </View>
            </View>
            {!!quotedPost.content && (
              <Text style={styles.quotedBody} numberOfLines={4}>
                {quotedPost.content}
              </Text>
            )}
            {quotedPost.image && (
              <Image
                source={imageSource(quotedPost.image)}
                style={styles.quotedMedia}
                resizeMode="cover"
              />
            )}
          </View>
        )}

        {/* Theme selector / Add-to-Post / Event link are HIDDEN in
            repost-with-thoughts mode. LinkedIn semantics: the
            reshare is just your text + the embed; no new media,
            no theme, no signup CTA gets attached to a repost.
            All the conditional blocks below collapse to nothing
            when isRepostMode is true. */}

        {!isRepostMode && (
          <>
        {/* ─── Theme selector ─── */}
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

        {/* ─── Add to Post ─── */}
        <Text style={styles.sectionTitle}>Add to Post</Text>
        <View style={styles.mediaGrid}>
          <TouchableOpacity style={styles.mediaBtn} onPress={handlePickImage}>
            <Ionicons name="image" size={20} color={colors.accent} />
            <Text style={styles.mediaBtnText}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.mediaBtn, activeComposerSection === 'location' && styles.mediaBtnActive]}
            onPress={() => setActiveComposerSection((prev) => (prev === 'location' ? null : 'location'))}
          >
            <GraffitiLocation size={20} color={colors.royal} filled />
            <Text style={styles.mediaBtnText}>Location</Text>
          </TouchableOpacity>
        </View>

        {/* Event link button */}
        <TouchableOpacity
          style={[styles.eventLinkBtn, activeComposerSection === 'signup' && styles.eventLinkBtnActive]}
          onPress={() => setActiveComposerSection((prev) => (prev === 'signup' ? null : 'signup'))}
          activeOpacity={0.8}
        >
          <Ionicons name="ticket-outline" size={20} color={activeComposerSection === 'signup' ? '#FFFFFF' : colors.green} />
          <Text style={[styles.eventLinkBtnText, activeComposerSection === 'signup' && styles.eventLinkBtnTextActive]}>
            {signupLink.trim() ? 'Event Link Added' : 'Add Event Sign Up Link'}
          </Text>
          {signupLink.trim() ? (
            <Ionicons name="checkmark-circle" size={18} color={activeComposerSection === 'signup' ? '#FFFFFF' : colors.green} />
          ) : (
            <Ionicons name="add-circle-outline" size={18} color={activeComposerSection === 'signup' ? '#FFFFFF' : colors.green} />
          )}
        </TouchableOpacity>

        {/* ─── Expandable sections ─── */}
        {activeComposerSection === 'location' && (
          <View style={styles.composeCard}>
            <Text style={styles.composeTitle}>Share your location</Text>
            <TouchableOpacity style={styles.liveLocationBtn} onPress={handleFetchLocation} activeOpacity={0.7}>
              {fetchingLocation ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <GraffitiLocation size={20} color={liveLocationEnabled ? '#FFFFFF' : colors.accent} filled={liveLocationEnabled} />
              )}
              <Text style={[styles.liveLocationText, liveLocationEnabled && styles.liveLocationTextActive]}>
                {fetchingLocation ? 'Finding you...' : liveLocationEnabled ? location : 'Use my current location'}
              </Text>
              {liveLocationEnabled && <View style={styles.liveLocationDot} />}
            </TouchableOpacity>
            {!liveLocationEnabled && (
              <>
                <Text style={styles.composeHint}>Or type a location manually</Text>
                <TextInput
                  style={styles.composeInput}
                  placeholder="Enter neighborhood or city"
                  placeholderTextColor={colors.gray400}
                  value={location}
                  onChangeText={setLocation}
                  maxLength={50}
                />
              </>
            )}
          </View>
        )}

        {activeComposerSection === 'signup' && (
          <View style={styles.composeCard}>
            <Text style={styles.composeTitle}>Event sign up link</Text>
            <Text style={styles.composeHint}>Share a link so people can sign up for your event</Text>
            <TextInput
              style={styles.composeInput}
              placeholder="Event name (e.g. Junubin Mixer)"
              placeholderTextColor={colors.gray400}
              value={signupTitle}
              onChangeText={setSignupTitle}
              maxLength={60}
            />
            <TextInput
              style={[styles.composeInput, styles.composeInputGap]}
              placeholder="https://eventbrite.com/your-event"
              placeholderTextColor={colors.gray400}
              value={signupLink}
              onChangeText={(text) => { setSignupLink(text); if (signupError) setSignupError(''); }}
              maxLength={200}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {signupError ? <Text style={styles.errorText}>{signupError}</Text> : null}
          </View>
        )}
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
  },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: isDark ? colors.gray200 : colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...Typography.sectionLabel,
    color: colors.black,
  },
  headerSub: {
    ...Typography.caption,
    color: colors.gray400,
    marginTop: 1,
  },

  // Next button (compose step)
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  nextBtnDisabled: {
    backgroundColor: colors.gray200,
  },
  nextBtnText: {
    ...Typography.label,
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  nextBtnTextDisabled: {
    color: colors.gray400,
  },

  // Post button (preview step)
  postBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postBtnText: {
    ...Typography.label,
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },

  body: {
    flex: 1,
    paddingHorizontal: 16,
  },

  // ─── User Row ───
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.accent,
    backgroundColor: colors.gray300,
  },
  userName: {
    ...Typography.bodySmallMedium,
    color: colors.black,
  },
  userSub: {
    ...Typography.caption,
    color: colors.gray400,
    marginTop: 2,
  },

  // ─── Compose card ───
  composePreview: {
    borderRadius: 18,
    padding: 16,
    minHeight: 140,
    marginBottom: 16,
    borderWidth: 1,
  },
  textInput: {
    ...Typography.body,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 100,
    paddingTop: 0,
  },
  charCount: {
    ...Typography.caption,
    textAlign: 'right',
    marginTop: 6,
    fontSize: 12,
  },
  attachedImageWrap: {
    marginTop: 10,
    borderRadius: 14,
    overflow: 'hidden',
  },
  attachedImage: {
    width: '100%',
    height: 180,
    borderRadius: 14,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 14,
    padding: 5,
  },
  videoBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  videoBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  inlineSignup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  inlineSignupTitle: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
  },
  inlineSignupUrl: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    marginTop: 1,
  },

  // ─── Quoted post preview (reshare with thoughts) ───
  quotedPreview: {
    marginTop: 12,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  quotedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quotedAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray300,
  },
  quotedName: {
    fontSize: 14,
    fontFamily: FontFamily.bold,
    color: colors.black,
  },
  quotedMeta: {
    fontSize: 12,
    fontFamily: FontFamily.regular,
    color: colors.gray500,
    marginTop: 1,
  },
  quotedBody: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FontFamily.regular,
    color: colors.black,
  },
  quotedMedia: {
    width: '100%',
    aspectRatio: 1.6,
    borderRadius: 8,
    backgroundColor: colors.gray200,
  },

  // ─── Sections ───
  sectionTitle: {
    ...Typography.label,
    fontSize: 15,
    color: colors.black,
    marginBottom: 10,
    marginTop: 4,
  },
  themeRow: {
    marginBottom: 16,
  },
  themeOption: {
    width: 76,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
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
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  themeCheck: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Media Grid ───
  mediaGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  mediaBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.cream,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : colors.gray200,
    gap: 4,
  },
  mediaBtnActive: {
    borderColor: colors.accent,
    backgroundColor: isDark ? 'rgba(206,17,38,0.08)' : 'rgba(206,17,38,0.04)',
  },
  mediaBtnText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.black,
  },

  // ─── Event Link ───
  eventLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(0,151,57,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(0,151,57,0.2)',
    borderStyle: 'dashed',
    marginBottom: 14,
  },
  eventLinkBtnActive: {
    backgroundColor: colors.green,
    borderColor: colors.green,
    borderStyle: 'solid',
  },
  eventLinkBtnText: {
    flex: 1,
    ...Typography.label,
    color: colors.green,
  },
  eventLinkBtnTextActive: {
    color: '#FFFFFF',
  },

  // ─── Compose Cards ───
  composeCard: {
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : colors.gray200,
    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : colors.cream,
    padding: 14,
  },
  composeTitle: {
    ...Typography.labelUpper,
    textTransform: undefined,
    color: colors.gray600,
    marginBottom: 8,
  },
  composeHint: {
    ...Typography.caption,
    color: colors.gray400,
    marginBottom: 10,
    lineHeight: 18,
  },
  composeInput: {
    ...Typography.caption,
    color: colors.black,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : colors.gray200,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : colors.white,
  },
  composeInputGap: {
    marginTop: 8,
  },

  // Location
  liveLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : colors.white,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.06)' : colors.gray200,
    marginBottom: 10,
  },
  liveLocationText: {
    flex: 1,
    fontSize: 14,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: colors.accent,
  },
  liveLocationTextActive: {
    color: colors.black,
  },
  liveLocationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green,
  },

  // Tags
  // ─── Preview Step ───
  previewBody: {
    flex: 1,
  },
  previewScrollContent: {
    paddingTop: 16,
    paddingBottom: 60,
  },
  editHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
  },
  editHintText: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
    color: colors.accent,
  },
  errorText: {
    ...Typography.caption,
    color: colors.error,
    marginTop: 6,
  },
});
