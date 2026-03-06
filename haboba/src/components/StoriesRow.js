// AnaJunubin — Stories Row (horizontal avatar circles)
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { imageSource } from '../utils/imageSource';
import { FontFamily, Gradients } from '../theme';
import { mockStories } from '../data/mockStories';

export default function StoriesRow({ onStoryPress, onCreateStory, colors }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {/* Add Story */}
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

      {/* Story cards — profile-style thumbnails */}
      {mockStories.map((story, index) => (
        <TouchableOpacity
          key={story.id}
          style={styles.storyItem}
          onPress={() => onStoryPress?.(story, index, mockStories)}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={['#F97316', '#EA580C', '#F59E0B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientRing}
          >
            <Image source={imageSource(story.avatar)} style={styles.avatar} />
          </LinearGradient>
          <Text style={[styles.name, { color: colors.black }]} numberOfLines={1}>{story.userName}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  gradientRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 3,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 31,
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
