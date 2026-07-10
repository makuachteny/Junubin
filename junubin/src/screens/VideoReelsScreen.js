// VideoReelsScreen — fullscreen vertical pager (TikTok / IG Reels style).
//
// Entered when a user taps a video in the main feed. We re-fetch the
// video-only slice of the feed so the user can keep scrolling between
// reels even if the starting post was in the middle of a mixed feed.
//
// Behaviour:
//   • Paged vertical scroll, one video per screen height.
//   • The visible video autoplays unmuted; adjacent items are paused
//     and muted (saves bandwidth + prevents audio bleed).
//   • Tap the video to toggle play/pause.
//   • Like / comment / repost rail on the right; author + caption at
//     the bottom; close (X) top-left.
//   • Pauses everything when the screen loses focus (push to
//     PostDetail, app backgrounded, etc).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Image, StyleSheet, FlatList, Dimensions, Pressable,
  TouchableOpacity, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as postService from '../api/services/postService';
import { imageSource } from '../utils/imageSource';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Snap-to-screen tolerance. ViewabilityConfig fires onViewableItemsChanged
// once an item crosses this threshold — high enough that we don't toggle
// playback mid-swipe, low enough that we don't miss a true page change.
const VIEWABILITY_THRESHOLD = 80;

function ReelItem({ post, isActive, onTapClose }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  // Drive playback off the `isActive` prop — when the user pages to this
  // item it plays; when they page away it stops. We also reset the
  // playhead so re-visiting a video starts from the beginning rather
  // than the previous pause point.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let cancelled = false;
    (async () => {
      try {
        if (isActive) {
          await v.setStatusAsync({ shouldPlay: true, positionMillis: 0, isMuted: muted });
        } else {
          await v.pauseAsync();
        }
      } catch {
        // Video unloaded mid-transition; harmless.
      }
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [isActive, muted]);

  const handleTap = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      await v.pauseAsync();
      setShowOverlay(true);
    } else {
      await v.playAsync();
      setShowOverlay(false);
    }
  }, [playing]);

  const mediaUri = post.video || post.image;
  const authorName = post.user?.name || 'Anonymous';
  const authorAvatar = post.user?.avatar;
  const caption = post.content || '';
  const likes = post.likeCount ?? post.likes ?? 0;
  const comments = post.commentCount ?? post.comments ?? 0;
  const reposts = post.repostCount ?? post.reposts ?? 0;

  return (
    <Pressable style={styles.reel} onPress={handleTap}>
      <Video
        ref={videoRef}
        source={{ uri: mediaUri }}
        style={StyleSheet.absoluteFill}
        // contain → preserve native ratio with letterboxing. Reels are
        // typically 9:16 so this fills almost edge-to-edge; non-vertical
        // sources letterbox cleanly instead of being cropped.
        resizeMode={ResizeMode.CONTAIN}
        isLooping
        isMuted={muted}
        shouldPlay={false} // controlled by the effect above
        onPlaybackStatusUpdate={(status) => {
          if (!status?.isLoaded) return;
          setPlaying(!!status.isPlaying);
        }}
      />

      {/* Center play icon — only visible while paused */}
      {showOverlay && (
        <View style={styles.playOverlay} pointerEvents="none">
          <Ionicons name="play" size={72} color="rgba(255,255,255,0.9)" />
        </View>
      )}

      {/* Close (X) — top-left */}
      <SafeAreaView style={styles.topBar} edges={['top']} pointerEvents="box-none">
        <TouchableOpacity
          onPress={onTapClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setMuted((m) => !m)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.muteBtn}
        >
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Right-hand action rail — like / comment / repost */}
      <SafeAreaView style={styles.actionsRail} edges={['bottom']} pointerEvents="box-none">
        <ActionButton icon="heart-outline" label={formatCount(likes)} />
        <ActionButton icon="chatbubble-outline" label={formatCount(comments)} />
        <ActionButton icon="repeat-outline" label={formatCount(reposts)} />
      </SafeAreaView>

      {/* Bottom info — author + caption */}
      <SafeAreaView style={styles.bottomInfo} edges={['bottom']} pointerEvents="box-none">
        <View style={styles.authorRow}>
          {authorAvatar ? (
            <Image source={imageSource(authorAvatar)} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]} />
          )}
          <Text style={styles.authorName} numberOfLines={1}>{authorName}</Text>
        </View>
        {!!caption && (
          <Text style={styles.caption} numberOfLines={3}>{caption}</Text>
        )}
      </SafeAreaView>
    </Pressable>
  );
}

function ActionButton({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.action} onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Ionicons name={icon} size={32} color="#FFFFFF" />
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function formatCount(n) {
  if (!n) return '';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export default function VideoReelsScreen({ navigation, route }) {
  const startingPost = route?.params?.startingPost || null;
  const [posts, setPosts] = useState(startingPost ? [startingPost] : []);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [screenFocused, setScreenFocused] = useState(true);

  // Fetch the full video feed on mount, then place the starting post at
  // index 0 (followed by every other video — the user can scroll from
  // their chosen entry point into the rest of the catalogue).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const live = await postService.listVideoPosts();
        if (cancelled) return;
        if (startingPost?.id) {
          const others = live.filter((p) => p.id !== startingPost.id);
          setPosts([startingPost, ...others]);
        } else {
          setPosts(live);
        }
      } catch (err) {
        if (!cancelled) {
          Alert.alert('Could not load reels', err?.message || 'Try again in a moment.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [startingPost]);

  // Pause all playback when this screen is unfocused (user navigates to
  // PostDetail, app backgrounded, etc). We do this by clearing the
  // active index so every ReelItem's effect pauses its <Video>.
  useFocusEffect(
    useCallback(() => {
      setScreenFocused(true);
      return () => setScreenFocused(false);
    }, []),
  );

  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: VIEWABILITY_THRESHOLD }),
    [],
  );

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    const top = viewableItems[0];
    if (top && Number.isInteger(top.index)) setActiveIndex(top.index);
  }).current;

  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const renderItem = useCallback(
    ({ item, index }) => (
      <ReelItem
        post={item}
        isActive={screenFocused && index === activeIndex}
        onTapClose={handleClose}
      />
    ),
    [activeIndex, screenFocused, handleClose],
  );

  if (loading && posts.length === 0) {
    return (
      <View style={styles.loadingRoot}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" hidden />
      <FlatList
        data={posts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_H}
        snapToAlignment="start"
        decelerationRate="fast"
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        // Window only renders ~3 items at a time to keep memory low — we
        // can't have N <Video> instances alive at once on Android.
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        removeClippedSubviews
        getItemLayout={(_, index) => ({
          length: SCREEN_H,
          offset: SCREEN_H * index,
          index,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  loadingRoot: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  reel: {
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: '#000',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  closeBtn: {
    padding: 8,
  },
  muteBtn: {
    padding: 8,
  },
  actionsRail: {
    position: 'absolute',
    right: 12,
    bottom: 0,
    paddingBottom: 24,
    gap: 22,
  },
  action: {
    alignItems: 'center',
    gap: 4,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bottomInfo: {
    position: 'absolute',
    left: 0, right: 80,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  avatarFallback: {
    backgroundColor: '#333',
  },
  authorName: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  caption: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 19,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
