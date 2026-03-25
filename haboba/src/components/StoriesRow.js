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
      colors={['#CE1126', '#F97316', '#CE1126']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.liveGradientRing}
    >
      {children}
    </LinearGradient>
  );
}

export default function StoriesRow({ onStoryPress, onCreatePress, onViewLive, colors }) {
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
      {/* Create */}
      <View style={styles.addGroup}>
        <TouchableOpacity style={styles.storyItem} onPress={onCreatePress} activeOpacity={0.7}>
          <LinearGradient
            colors={['#F97316', '#EA580C', '#F59E0B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientRing}
          >
            <View style={styles.addCenter}>
              <Ionicons name="add" size={26} color="#FFFFFF" />
            </View>
          </LinearGradient>
          <Text style={[styles.name, { color: colors.black }]}>Create</Text>
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
              style={[styles.name, { color: isLive ? '#CE1126' : colors.black }]}
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
    gap: 12,
  },
  addGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  storyItem: {
    alignItems: 'center',
    width: 66,
  },
  addCenter: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    padding: 3,
  },
  liveGradientRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    padding: 3,
  },
  liveAvatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  liveBadge: {
    position: 'absolute',
    bottom: -2,
    alignSelf: 'center',
    backgroundColor: '#CE1126',
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
