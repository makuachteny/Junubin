// AnaJunubin — Stories Viewer (full-screen, progress bars, tap nav)
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Dimensions, Animated, TextInput, Alert, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { imageSource } from '../utils/imageSource';
import { FontFamily } from '../theme';
import { interactiveStore } from '../utils/interactiveStore';
import { useSubscription } from '../payments';
import { hapticSelection } from '../utils/haptics';
import { useAccessibilityPreferences } from '../accessibility';

const { width: W, height: H } = Dimensions.get('window');
const STORY_DURATION = 5000;

export default function StoriesViewScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isCompact = width < 375;
  const { hasTier } = useSubscription();
  const { prefs } = useAccessibilityPreferences();
  const storyList = route.params?.storyList || [];
  const startIndex = route.params?.storyIndex ?? 0;
  const initialGroup = route.params?.story;
  const groups = storyList.length > 0 ? storyList : (initialGroup ? [initialGroup] : []);
  const initialGroupIndex = Math.max(0, Math.min(startIndex, Math.max(groups.length - 1, 0)));
  const [currentGroupIndex, setCurrentGroupIndex] = useState(initialGroupIndex);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reaction, setReaction] = useState('🔥');
  const [thread, setThread] = useState([]);
  const [threadInput, setThreadInput] = useState('');
  const [sentReaction, setSentReaction] = useState(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const dotSlideAnim = useRef(new Animated.Value(0)).current;
  const reactionScale = useRef(new Animated.Value(1)).current;
  const reactionFloat = useRef(new Animated.Value(0)).current;
  const reactionOpacity = useRef(new Animated.Value(0)).current;

  const handleReaction = useCallback((emoji) => {
    setReaction(emoji);
    hapticSelection?.();
    if (prefs?.reducedMotion) {
      setSentReaction(emoji);
      reactionFloat.setValue(-18);
      reactionOpacity.setValue(1);
      setTimeout(() => setSentReaction(null), 380);
      return;
    }
    // Bounce the chip
    Animated.sequence([
      Animated.timing(reactionScale, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.spring(reactionScale, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
    // Float-up burst
    setSentReaction(emoji);
    reactionFloat.setValue(0);
    reactionOpacity.setValue(1);
    Animated.parallel([
      Animated.timing(reactionFloat, { toValue: -120, duration: 800, useNativeDriver: true }),
      Animated.timing(reactionOpacity, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start(() => setSentReaction(null));
  }, [prefs, reactionScale, reactionFloat, reactionOpacity]);

  const storyGroup = groups[currentGroupIndex];
  const stories = storyGroup?.stories || [];
  const story = stories[currentIndex];
  const reactionSet = isCompact ? ['🔥', '✨', '😍', '💌'] : ['🔥', '✨', '💫', '😍', '💌'];
  const threadKey = useMemo(() => `${storyGroup?.id || 'story'}-${story?.id || currentIndex}`, [storyGroup?.id, story?.id, currentIndex]);

  useEffect(() => {
    const safeIndex = Math.max(0, Math.min(currentGroupIndex, Math.max(groups.length - 1, 0)));
    if (safeIndex !== currentGroupIndex) {
      setCurrentGroupIndex(safeIndex);
      setCurrentIndex(0);
    }
  }, [currentGroupIndex, groups.length]);

  useEffect(() => {
    interactiveStore.getStoryThreads().then((all) => {
      setThread(all?.[threadKey] || []);
    });
  }, [threadKey]);

  // Animate dot slide to current index
  useEffect(() => {
    Animated.spring(dotSlideAnim, {
      toValue: currentIndex,
      tension: 68,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [currentIndex, dotSlideAnim]);

  // Navigation must be declared BEFORE the auto-advance timer effect
  // below, because that effect lists goNext in its dependency array —
  // referencing a `const` before declaration would throw a TDZ
  // ReferenceError during render and the timer would never register.
  const goNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((i) => i + 1);
      return;
    }
    if (currentGroupIndex < groups.length - 1) {
      setCurrentGroupIndex((i) => i + 1);
      setCurrentIndex(0);
      return;
    }
    navigation.goBack();
  }, [currentIndex, stories.length, currentGroupIndex, groups.length, navigation]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      return;
    }
    if (currentGroupIndex > 0) {
      const prevGroup = groups[currentGroupIndex - 1];
      const prevStories = prevGroup?.stories || [];
      setCurrentGroupIndex((i) => i - 1);
      setCurrentIndex(Math.max(prevStories.length - 1, 0));
    }
  }, [currentIndex, currentGroupIndex, groups]);

  // Auto-advance timer. Resets when `story` changes — so each story in
  // each group gets its own fresh duration. When the timer fires, goNext
  // walks: next story in group → next group → if at the very end, close.
  useEffect(() => {
    if (!story) return;
    progressAnim.setValue(0);
    const anim = Animated.timing(progressAnim, {
      toValue: 1,
      duration: prefs?.reducedMotion ? Math.min(story.duration || STORY_DURATION, 3500) : (story.duration || STORY_DURATION),
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) goNext();
    });
    return () => anim.stop();
  }, [story, goNext, progressAnim, prefs]);

  const postReply = useCallback((rawValue) => {
    if (!hasTier('junub')) {
      Alert.alert('Junub Feature', 'Story reply threads are available on Junub and higher.', [
        { text: 'Upgrade', onPress: () => navigation.navigate('Elite') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    const value = (rawValue || '').trim();
    if (!value) return;
    const next = [value, ...thread].slice(0, 4);
    setThread(next);
    setThreadInput('');
    interactiveStore.getStoryThreads().then((all) => {
      const merged = { ...(all || {}), [threadKey]: next };
      interactiveStore.setStoryThreads(merged);
    });
  }, [hasTier, navigation, thread, threadKey]);

  const handlePostReply = useCallback(() => {
    postReply(threadInput);
  }, [postReply, threadInput]);

  if (!story) {
    navigation.goBack();
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Story content */}
      {story.type === 'image' ? (
        <Image source={imageSource(story.uri)} style={styles.fullImage} resizeMode="cover" />
      ) : (
        <View style={[styles.textBg, { backgroundColor: story.bgColor || '#0047AB' }]}>
          <Text style={styles.storyText}>{story.text}</Text>
        </View>
      )}

      {/* Progress dots */}
      <View style={[styles.dotsRow, { top: insets.top + 8 }]}>
        {stories.map((_, i) => {
          const isActive = i === currentIndex;
          const isPast = i < currentIndex;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                isPast && styles.dotPast,
                isActive && styles.dotActive,
              ]}
            >
              {isActive && (
                <Animated.View
                  style={[
                    styles.dotFill,
                    {
                      transform: [{
                        scaleX: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 1],
                        }),
                      }],
                    },
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>

      {/* Header */}
      <View style={[styles.header, { top: insets.top + 20 }]}>
        <Image source={imageSource(storyGroup?.avatar)} style={styles.avatar} />
        <Text style={styles.userName}>{storyGroup?.userName}</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Close story"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Tap zones */}
      <View style={styles.tapZones}>
        <TouchableOpacity style={styles.tapLeft} onPress={goPrev} activeOpacity={1} />
        <TouchableOpacity style={styles.tapRight} onPress={goNext} activeOpacity={1} />
      </View>

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.24)', 'rgba(0,0,0,0.42)', 'rgba(0,0,0,0.62)', 'rgba(0,0,0,0.78)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[styles.bottomShade, { height: insets.bottom + (isCompact ? 66 : 72) }]}
      />

      <View style={[styles.reactBarShell, { bottom: insets.bottom + 10 }]}>
        <View style={styles.reactBar}>
          {reactionSet.map((emoji) => (
            <Animated.View key={emoji} style={reaction === emoji ? { transform: [{ scale: reactionScale }] } : undefined}>
              <TouchableOpacity
                style={[
                  styles.reactChip,
                  isCompact && styles.reactChipCompact,
                  prefs?.largerTouchTargets && styles.reactChipLarge,
                  reaction === emoji && styles.reactChipActive,
                ]}
                onPress={() => handleReaction(emoji)}
                accessibilityRole="button"
                accessibilityLabel={`React with ${emoji}`}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Text style={[styles.reactEmoji, isCompact && styles.reactEmojiCompact]}>{emoji}</Text>
              </TouchableOpacity>
            </Animated.View>
          ))}
          <TextInput
            value={threadInput}
            onChangeText={setThreadInput}
            placeholder="Reply..."
            placeholderTextColor={prefs?.highContrast ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.55)'}
            style={[styles.threadInput, prefs?.largerTouchTargets && styles.threadInputLarge]}
            maxLength={80}
            accessibilityLabel="Reply to story"
          />
          <TouchableOpacity
            style={styles.sendBtn}
            onPress={handlePostReply}
            accessibilityRole="button"
            accessibilityLabel="Send reply"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-forward" size={15} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
      {/* Floating reaction burst */}
      {sentReaction && (
        <Animated.Text
          style={[
            styles.floatingReaction,
            {
              bottom: insets.bottom + 60,
              transform: [{ translateY: reactionFloat }, { scale: 1.5 }],
              opacity: reactionOpacity,
            },
          ]}
        >
          {sentReaction}
        </Animated.Text>
      )}
      {thread.length > 0 && (
        <View style={[styles.threadPreview, { bottom: insets.bottom + 64 }]}>
          {thread.slice(0, 2).map((item, idx) => (
            <Text key={`${item}-${idx}`} style={styles.threadText}>• {item}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  fullImage: { width: W, height: H },
  textBg: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  storyText: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 38,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  dotsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    zIndex: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  dotPast: {
    backgroundColor: '#CE1126',
  },
  dotActive: {
    width: 24,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    backgroundColor: '#CE1126',
    borderRadius: 4,
    transformOrigin: 'left',
  },
  header: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 20,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#CE1126',
  },
  userName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: '#FFFFFF',
  },
  closeBtn: { padding: 8 },
  tapZones: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 10,
  },
  bottomShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 18,
  },
  tapLeft: { flex: 1 },
  tapRight: { flex: 2 },
  reactBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reactBarShell: {
    position: 'absolute',
    left: 10,
    right: 10,
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 7,
    backgroundColor: 'transparent',
    zIndex: 25,
  },
  reactChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  reactChipCompact: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  reactChipLarge: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  reactChipActive: {
    backgroundColor: 'rgba(232,97,60,0.95)',
    borderColor: 'rgba(232,97,60,1)',
  },
  reactEmoji: {
    fontSize: 18,
  },
  reactEmojiCompact: {
    fontSize: 15,
  },
  floatingReaction: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 48,
    zIndex: 30,
  },
  threadInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.35)',
    color: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 12,
  },
  threadInputLarge: {
    minHeight: 42,
    fontSize: 14,
    paddingVertical: 8,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#CE1126',
  },
  threadPreview: {
    position: 'absolute',
    left: 12,
    right: 12,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 25,
  },
  threadText: {
    color: '#FFFFFF',
    fontSize: 11,
    lineHeight: 15,
  },
});
