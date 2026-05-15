// AnaJunubin — Create Story Screen (photo or text)
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  Animated,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Video } from 'expo-av';
import { useTheme, Typography, FontFamily, Gradients } from '../theme';
import * as storyService from '../api/services/storyService';
import { promptToOpenSettings } from '../utils/permissionAlert';

// Background palette for text stories. Each entry is a gradient — solid
// colors render fine when both stops are equal, but using gradients gives
// the picker visual depth and lets a single tile express more brand range.
const TEXT_BACKGROUNDS = [
  { id: 'red', colors: ['#CE1126', '#8B1020'] },
  { id: 'green', colors: ['#2CB750', '#009739'] },
  { id: 'blue', colors: ['#1E5DD3', '#0047AB'] },
  { id: 'sunset', colors: ['#F04C55', '#FF8C42'] },
  { id: 'gold', colors: ['#FCCD12', '#D4A800'] },
  { id: 'rose', colors: ['#F05AA5', '#E84393'] },
  { id: 'royal', colors: ['#0047AB', '#002B66'] },
  { id: 'midnight', colors: ['#1A1A1A', '#0A0A0A'] },
];

const FONT_PRESETS = [
  { id: 'bold', label: 'Aa', font: FontFamily.extrabold, weight: '800' },
  { id: 'serif', label: 'Aa', font: FontFamily.semibold, weight: '600' },
  { id: 'light', label: 'Aa', font: FontFamily.regular, weight: '400' },
];

const TEXT_MAX = 200;

export default function CreateStoryScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [mode, setMode] = useState('text'); // 'text' or 'photo'
  const [text, setText] = useState('');
  const [bg, setBg] = useState(TEXT_BACKGROUNDS[0]);
  const [fontPreset, setFontPreset] = useState(FONT_PRESETS[0]);
  const [mediaUri, setMediaUri] = useState(null);
  const [mediaKind, setMediaKind] = useState('image'); // 'image' | 'video'
  const [posting, setPosting] = useState(false);

  // Animated mode-toggle indicator — slides between Text/Photo positions
  // for a segmented-control feel without a layout library.
  const indicatorAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(indicatorAnim, {
      toValue: mode === 'text' ? 0 : 1,
      useNativeDriver: true,
      stiffness: 220,
      damping: 22,
      mass: 0.6,
    }).start();
  }, [mode, indicatorAnim]);

  const requestAndPick = async (source) => {
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      promptToOpenSettings({
        title: source === 'camera' ? 'Camera access needed' : 'Photo access needed',
        message: source === 'camera'
          ? 'JuNubin needs camera access to capture a story. Enable it in Settings.'
          : 'JuNubin needs photo access to choose a story. Enable it in Settings.',
      });
      return;
    }
    const opts = {
      mediaTypes: ['images', 'videos'],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.85,
    };
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (!result.canceled) {
      const asset = result.assets[0];
      // expo-image-picker exposes `type: 'image' | 'video'` per asset.
      // Fall back to mimeType sniffing if the field is missing (older SDKs).
      const isVideo = asset?.type === 'video'
        || (typeof asset?.mimeType === 'string' && asset.mimeType.startsWith('video'));
      setMediaUri(asset.uri);
      setMediaKind(isVideo ? 'video' : 'image');
    }
  };

  const canPost = mode === 'text' ? text.trim().length > 0 : !!mediaUri;

  const handlePost = async () => {
    if (!canPost || posting) return;
    setPosting(true);
    try {
      // Persist via storyService — uploads media (photo/video) and writes
      // the Story row with a 24h expiry. The viewer will pick it up on
      // the next listActiveStoryGroups() call.
      const isVideoMedia = mode === 'photo' && mediaKind === 'video';
      const created = await storyService.createStory({
        mode,
        text: mode === 'text' ? text.trim() : null,
        photoUri: mode === 'photo' && !isVideoMedia ? mediaUri : null,
        videoUri: isVideoMedia ? mediaUri : null,
        // Persist the gradient's first color so existing readers that
        // expect a single bgColor string still render correctly. The
        // viewer can pull both stops from `bg` once it's gradient-aware.
        bgColor: mode === 'text' ? bg.colors[0] : null,
      });
      navigation.navigate({
        name: 'Main',
        params: { createdStory: created },
        merge: true,
      });
      navigation.goBack();
    } catch (err) {
      Alert.alert('Couldn’t post', err?.message || 'Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const charsLeft = TEXT_MAX - text.length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerIconBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={22} color={colors.black} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>New story</Text>

        <Pressable
          onPress={handlePost}
          disabled={!canPost || posting}
          style={({ pressed }) => [
            styles.postBtn,
            !canPost && styles.postBtnDisabled,
            pressed && canPost && { opacity: 0.85 },
          ]}
        >
          {canPost ? (
            <LinearGradient
              colors={Gradients.warm}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <Text style={[styles.postBtnText, !canPost && styles.postBtnTextDisabled]}>
            {posting ? 'Posting…' : 'Share'}
          </Text>
        </Pressable>
      </View>

      {/* ─── Mode Toggle (segmented control) ─── */}
      <View style={styles.modeWrap}>
        <View style={styles.modeTrack}>
          <Animated.View
            style={[
              styles.modeIndicator,
              {
                transform: [{
                  translateX: indicatorAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 100],
                  }),
                }],
              },
            ]}
          />
          <TouchableOpacity
            style={styles.modeSlot}
            onPress={() => setMode('text')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="text"
              size={15}
              color={mode === 'text' ? '#FFFFFF' : colors.gray500}
            />
            <Text style={[styles.modeLabel, mode === 'text' && styles.modeLabelActive]}>
              Text
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modeSlot}
            onPress={() => setMode('photo')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="image-outline"
              size={15}
              color={mode === 'photo' ? '#FFFFFF' : colors.gray500}
            />
            <Text style={[styles.modeLabel, mode === 'photo' && styles.modeLabelActive]}>
              Photo
            </Text>
          </TouchableOpacity>
        </View>

      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {mode === 'text' ? (
          <View style={styles.canvas}>
            {/* Story canvas — gradient background with centered text. */}
            <View style={styles.canvasFrame}>
              <LinearGradient
                colors={bg.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.canvasGradient}
              >
                <TextInput
                  style={[
                    styles.storyInput,
                    { fontFamily: fontPreset.font, fontWeight: fontPreset.weight },
                  ]}
                  placeholder="What's on your mind?"
                  placeholderTextColor="rgba(255,255,255,0.55)"
                  value={text}
                  onChangeText={setText}
                  multiline
                  maxLength={TEXT_MAX}
                  textAlign="center"
                  textAlignVertical="center"
                  selectionColor="rgba(255,255,255,0.95)"
                />
                {/* Character counter — only appears once you start typing. */}
                {text.length > 0 && (
                  <View style={styles.charCount}>
                    <Text style={styles.charCountText}>{charsLeft}</Text>
                  </View>
                )}
              </LinearGradient>
            </View>

            {/* Font preset chooser */}
            <View style={styles.fontRow}>
              {FONT_PRESETS.map((f) => {
                const active = fontPreset.id === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.fontChip, active && styles.fontChipActive]}
                    onPress={() => setFontPreset(f)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={{
                        fontFamily: f.font,
                        fontWeight: f.weight,
                        fontSize: 14,
                        color: active ? '#FFFFFF' : colors.black,
                      }}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Background swatch row */}
            <View style={styles.swatchRow}>
              {TEXT_BACKGROUNDS.map((opt) => {
                const active = bg.id === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => setBg(opt)}
                    activeOpacity={0.85}
                    style={styles.swatchHit}
                  >
                    <View style={[styles.swatchOuter, active && styles.swatchOuterActive]}>
                      <LinearGradient
                        colors={opt.colors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.swatchInner}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.canvas}>
            <View style={styles.canvasFrame}>
              {mediaUri ? (
                <View style={styles.photoLoaded}>
                  {mediaKind === 'video' ? (
                    <Video
                      source={{ uri: mediaUri }}
                      useNativeControls={false}
                      isLooping
                      shouldPlay
                      resizeMode="cover"
                      style={styles.photoFill}
                    />
                  ) : (
                    <Image source={{ uri: mediaUri }} style={styles.photoFill} resizeMode="cover" />
                  )}
                  <TouchableOpacity
                    style={styles.photoChangeBtn}
                    onPress={() => requestAndPick('library')}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="repeat" size={14} color="#FFFFFF" />
                    <Text style={styles.photoChangeText}>Replace</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.photoRemoveBtn}
                    onPress={() => { setMediaUri(null); setMediaKind('image'); }}
                    activeOpacity={0.85}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.photoEmpty}>
                  {/* Subtle gradient hint — empty canvas isn't pure gray */}
                  <LinearGradient
                    colors={isDark
                      ? ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)']
                      : ['rgba(0,0,0,0.04)', 'rgba(0,0,0,0.01)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.photoEmptyIconWrap}>
                    <Ionicons name="image-outline" size={32} color={colors.gray500} />
                  </View>
                  <Text style={styles.photoEmptyTitle}>Pick a moment</Text>
                  <Text style={styles.photoEmptySub}>
                    Photo stories disappear after 24 hours
                  </Text>
                </View>
              )}
            </View>

            {/* Source actions — camera + library, only when no media yet */}
            {!mediaUri && (
              <View style={styles.sourceRow}>
                <TouchableOpacity
                  style={styles.sourceBtn}
                  onPress={() => requestAndPick('camera')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="camera-outline" size={18} color={colors.black} />
                  <Text style={styles.sourceBtnText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.sourceBtn, styles.sourceBtnPrimary]}
                  onPress={() => requestAndPick('library')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="images-outline" size={18} color="#FFFFFF" />
                  <Text style={[styles.sourceBtnText, { color: '#FFFFFF' }]}>
                    Library
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceMuted },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    height: 52,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    color: colors.black,
    letterSpacing: 0.2,
  },
  postBtn: {
    minWidth: 76,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.black,
  },
  postBtnDisabled: {
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
  },
  postBtnText: {
    fontSize: 14,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  postBtnTextDisabled: {
    color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
  },

  // ─── Mode Toggle ───
  modeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 14,
    gap: 12,
  },
  modeTrack: {
    flexDirection: 'row',
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    borderRadius: 22,
    padding: 4,
    position: 'relative',
    width: 208, // 100 per slot + 4*2 padding
  },
  modeIndicator: {
    position: 'absolute',
    left: 4,
    top: 4,
    bottom: 4,
    width: 100,
    borderRadius: 18,
    backgroundColor: colors.black,
  },
  modeSlot: {
    width: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    zIndex: 1,
  },
  modeLabel: {
    fontSize: 13,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: colors.gray500,
  },
  modeLabelActive: {
    color: '#FFFFFF',
  },
  // ─── Canvas (shared between text & photo modes) ───
  canvas: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 20,
  },
  canvasFrame: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    // Subtle elevation — separates the canvas from the surrounding chrome
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.4 : 0.08,
    shadowRadius: 16,
    elevation: 4,
  },

  // ─── Text mode ───
  canvasGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  storyInput: {
    fontSize: 26,
    color: '#FFFFFF',
    textAlign: 'center',
    width: '100%',
    minHeight: 120,
    textShadowColor: 'rgba(0,0,0,0.18)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  charCount: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  charCountText: {
    fontSize: 11,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  fontRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  fontChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fontChipActive: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  swatchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  swatchHit: { padding: 2 },
  swatchOuter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    padding: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchOuterActive: {
    borderColor: colors.black,
  },
  swatchInner: {
    flex: 1,
    borderRadius: 12,
  },

  // ─── Photo mode ───
  photoEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  photoEmptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
    borderStyle: 'dashed',
  },
  photoEmptyTitle: {
    fontSize: 18,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    color: colors.black,
    marginTop: 6,
  },
  photoEmptySub: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
    color: colors.gray500,
    textAlign: 'center',
  },
  photoLoaded: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  photoFill: { flex: 1 },
  photoChangeBtn: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  photoChangeText: {
    fontSize: 12,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sourceRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  sourceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
    backgroundColor: 'transparent',
  },
  sourceBtnPrimary: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  sourceBtnText: {
    fontSize: 14,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: colors.black,
  },
});
