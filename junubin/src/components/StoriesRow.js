// AnaJunubin — Stories Row (horizontal avatar circles with LIVE badges)
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { imageSource } from '../utils/imageSource';
import { FontFamily } from '../theme';
import { mockStories, mockLiveStreams } from '../data/mockStories';

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
          <View style={styles.avatarWrap}>
            <View style={styles.addCenter}>
              <Ionicons name="add" size={24} color="#FFFFFF" />
            </View>
          </View>
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
                <View style={styles.avatarWrap}>
                  <Image source={imageSource(story.avatar)} style={styles.avatar} />
                </View>
                <View style={styles.liveDot} />
              </View>
            ) : (
              <View style={styles.avatarWrap}>
                <Image source={imageSource(story.avatar)} style={styles.avatar} />
              </View>
            )}
            <Text
              style={[styles.name, { color: colors.black }]}
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
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    padding: 2,
  },
  liveAvatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 29,
  },
  liveDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  name: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: FontFamily.medium,
    marginTop: 4,
    textAlign: 'center',
  },
});
