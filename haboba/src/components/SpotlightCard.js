// AnaJunubin — Weekly Spotlight Card (gold-bordered premium card)
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { imageSource } from '../utils/imageSource';
import { FontFamily } from '../theme';

export default function SpotlightCard({ profile, onPress, colors }) {
  if (!profile) return null;

  return (
    <TouchableOpacity onPress={() => onPress?.(profile)} activeOpacity={0.85} style={styles.container}>
      <LinearGradient
        colors={['#FFD700', '#FFA000', '#FFD700']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.goldBorder}
      >
        <View style={[styles.inner, { backgroundColor: colors.cardBg }]}>
          <Image source={imageSource(profile.images?.[0])} style={styles.image} />
          <View style={styles.badge}>
            <Ionicons name="star" size={12} color={colors.gold} />
            <Text style={[styles.badgeText, { color: colors.gold }]}>SPOTLIGHT</Text>
          </View>
          <View style={styles.info}>
            <Text style={[styles.name, { color: colors.black }]}>{profile.name}, {profile.age}</Text>
            <Text style={[styles.bio, { color: colors.gray }]} numberOfLines={1}>{profile.bio || 'No bio yet'}</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: 16, marginVertical: 8 },
  goldBorder: {
    borderRadius: 20,
    padding: 2.5,
  },
  inner: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 180,
    resizeMode: 'cover',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: FontFamily.extrabold,
    color: '#FFD700',
    letterSpacing: 1,
  },
  info: {
    padding: 12,
    gap: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  bio: {
    fontSize: 13,
    fontFamily: FontFamily.regular,
  },
});
