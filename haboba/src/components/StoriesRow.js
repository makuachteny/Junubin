// AnaJunubin — Stories Row (horizontal avatar circles with LIVE badges)
import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { imageSource } from '../utils/imageSource';
import { FontFamily } from '../theme';
import { mockStories, mockLiveStreams } from '../data/mockStories';

function LiveBadge() {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.2, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={[styles.liveBadge, { transform: [{ scale: pulse }] }]}>
      <Text style={styles.liveText}>LIVE</Text>
    </Animated.View>
  );
}

function LiveRing({ children }) {
  return (
    <LinearGradient
      colors={['#EF4444', '#F97316', '#EF4444']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.liveGradientRing}
    >
      {children}
    </LinearGradient>
  );
}

export default function StoriesRow({ onStoryPress, onCreateStory, onGoLive, onViewLive, colors }) {
  // Sort: live users first
  const sortedStories = [...mockStories].sort((a, b) => {
    if (a.isLive && !b.isLive) return -1;
    if (!a.isLive && b.isLive) return 1;
    return 0;
  });

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {/* Add Story / Go Live */}
      <View style={styles.addGroup}>
        <TouchableOpacity style={styles.storyItem} onPress={onCreateStory} activeOpacity={0.7}>
          <LinearGradient
            colors={['#F97316', '#EA580C', '#F59E0B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientRing}
          >
            <View style={styles.addCenter}>
              <Ionicons name="add" size={28} color="#FFFFFF" />
            </View>
          </LinearGradient>
          <Text style={[styles.name, { color: colors.black }]}>Add Story</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.storyItem} onPress={onGoLive} activeOpacity={0.7}>
          <LinearGradient
            colors={['#EF4444', '#DC2626', '#F97316']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientRing}
          >
            <View style={styles.liveCenter}>
              <Ionicons name="radio" size={24} color="#FFFFFF" />
            </View>
          </LinearGradient>
          <Text style={[styles.name, { color: colors.accent || '#EF4444' }]}>Go Live</Text>
        </TouchableOpacity>
      </View>

      {/* Story cards — live users get a special ring + badge */}
      {sortedStories.map((story, index) => {
        const isLive = story.isLive;
        const liveData = isLive
          ? mockLiveStreams.find((l) => l.userId === story.userId)
          : null;

        return (
          <TouchableOpacity
            key={story.id}
            style={styles.storyItem}
            onPress={() => {
              if (isLive && onViewLive && liveData) {
                onViewLive(liveData);
              } else {
                onStoryPress?.(story, index, sortedStories);
              }
            }}
            activeOpacity={0.7}
          >
            {isLive ? (
              <View style={styles.liveAvatarWrap}>
                <LiveRing>
                  <Image source={imageSource(story.avatar)} style={styles.avatar} />
                </LiveRing>
                <LiveBadge />
              </View>
            ) : (
              <LinearGradient
                colors={['#F97316', '#EA580C', '#F59E0B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientRing}
              >
                <Image source={imageSource(story.avatar)} style={styles.avatar} />
              </LinearGradient>
            )}
            <Text
              style={[styles.name, { color: isLive ? '#EF4444' : colors.black }]}
              numberOfLines={1}
            >
              {story.userName}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 14,
  },
  addGroup: {
    flexDirection: 'row',
    gap: 14,
  },
  storyItem: {
    alignItems: 'center',
    width: 72,
  },
  addCenter: {
    width: '100%',
    height: '100%',
    borderRadius: 31,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveCenter: {
    width: '100%',
    height: '100%',
    borderRadius: 31,
    backgroundColor: 'rgba(239,68,68,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 3,
  },
  liveGradientRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 3,
  },
  liveAvatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 31,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  liveBadge: {
    position: 'absolute',
    bottom: -2,
    alignSelf: 'center',
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#FFF',
  },
  liveText: {
    fontSize: 8,
    fontWeight: '900',
    fontFamily: FontFamily.black,
    color: '#FFF',
    letterSpacing: 1,
  },
  name: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: FontFamily.medium,
    marginTop: 4,
    textAlign: 'center',
  },
});
