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
        <View style={[styles.addCircle, { borderColor: colors.gray300, backgroundColor: colors.gray100 }]}>
          <Ionicons name="add" size={24} color={colors.accent} />
        </View>
        <Text style={[styles.name, { color: colors.black }]}>Add Story</Text>
      </TouchableOpacity>

      {/* Story circles */}
      {mockStories.map((story, index) => (
        <TouchableOpacity
          key={story.id}
          style={styles.storyItem}
          onPress={() => onStoryPress?.(story, index, mockStories)}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={Gradients.accent}
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
    width: 68,
  },
  addCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    padding: 3,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#FFFFFF', // always white gap between gradient ring and avatar
  },
  name: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: FontFamily.medium,
    marginTop: 4,
    textAlign: 'center',
  },
});
