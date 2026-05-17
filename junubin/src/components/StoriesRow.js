// AnaJunubin — Stories Row (horizontal avatar circles)
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { imageSource } from '../utils/imageSource';
import { FontFamily } from '../theme';
import * as storyService from '../api/services/storyService';
import { supabase } from '../config/supabase';
import { mockStories } from '../data/__dev__/mockStories';
import { DEMO_DATA_ENABLED } from '../config/demoData';

export default function StoriesRow({ onStoryPress, onCreatePress, colors, refreshKey }) {
  // Seed with demo stories when the flag is on so the row isn't empty
  // on first launch. Real stories appear at the top of the row as
  // they're posted via the realtime subscription below.
  const [stories, setStories] = useState(() => (DEMO_DATA_ENABLED ? mockStories : []));
  // Internal bump triggered by realtime Story INSERTs.
  const [realtimeBump, setRealtimeBump] = useState(0);

  // Pull real stories from storyService. `refreshKey` and `realtimeBump`
  // both trigger refetches — `refreshKey` is the imperative "I just
  // posted, refetch now" signal from the parent; `realtimeBump`
  // increments whenever any user posts a new Story row anywhere in
  // the system (subscribed via supabase_realtime, see 00031 migration).
  useEffect(() => {
    let cancelled = false;
    storyService.listActiveStoryGroups()
      .then((live) => {
        if (cancelled) return;
        // Real stories first; demo stories trail behind so they
        // disappear naturally once enough friends post.
        const liveList = live || [];
        if (liveList.length > 0) {
          // Real stories hide the demo seed — see CommunityScreen for
          // the same rule. A populated story row should never mix
          // seed entries with real ones; the moment the server has
          // any stories we show ONLY those.
          setStories(liveList);
        } else if (DEMO_DATA_ENABLED) {
          setStories(mockStories);
        } else {
          setStories([]);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [refreshKey, realtimeBump]);

  // Subscribe to Story INSERTs so new posts surface live in the row.
  // The subscription debounces on a short window so a flurry of
  // simultaneous inserts doesn't trigger N back-to-back refetches.
  useEffect(() => {
    const debounceRef = { current: null };
    const channel = supabase
      .channel('stories-row-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'Story' },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            setRealtimeBump((n) => n + 1);
          }, 400);
        },
      )
      .subscribe();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      try { supabase.removeChannel(channel); } catch {}
    };
  }, []);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {/* Create */}
      <TouchableOpacity style={styles.storyItem} onPress={onCreatePress} activeOpacity={0.7}>
        <View style={styles.createRing}>
          <View style={styles.addCenter}>
            <Ionicons name="add" size={26} color={colors.black} />
          </View>
        </View>
        <Text style={[styles.name, { color: colors.black }]} numberOfLines={1}>Create</Text>
      </TouchableOpacity>

      {/* Story cards */}
      {stories.map((story, index) => {
        const isViewed = story.viewed === true;

        // Unviewed stories get the theme accent ring (solid).
        // Viewed stories fade to a neutral gray.
        const ringColors = isViewed
          ? ['#D4D4D8', '#D4D4D8']
          : [colors.accent, colors.accent];

        return (
          <TouchableOpacity
            key={story.id}
            style={styles.storyItem}
            onPress={() => onStoryPress?.(story, index, stories)}
            activeOpacity={0.7}
          >
            <View style={styles.avatarOuter}>
              <LinearGradient
                colors={ringColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ringGradient}
              >
                <View style={styles.avatarInner}>
                  <Image source={imageSource(story.avatar)} style={styles.avatar} />
                </View>
              </LinearGradient>
            </View>
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
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    gap: 14,
  },
  storyItem: {
    alignItems: 'center',
    width: 72,
    // Explicit minHeight so the row never collapses around the children
    // and the name has guaranteed vertical space below the avatar.
    minHeight: 96,
  },
  // "Create" tile — subtle dashed-style placeholder, distinct from real stories
  createRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.12)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  addCenter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOuter: {
    width: 64,
    height: 64,
    position: 'relative',
  },
  ringGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2.5,
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    padding: 2,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  name: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
    fontFamily: FontFamily.medium,
    marginTop: 8,
    textAlign: 'center',
    width: '100%',
    // Reserve enough vertical room for descenders (g, y, j, p) so the
    // glyphs aren't sliced by the row's bottom padding.
    paddingBottom: 2,
  },
});
