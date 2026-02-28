import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, getShadow } from '../theme';
import { imageSource } from '../data/mockProfiles';
import HabobaLogo from './HabobaLogo';

export default function ScreenHeader({
  left,
  right,
  avatarUri,
  onAvatarPress,
  showLogo = true,
  style,
}) {
  const { colors, isDark } = useTheme();

  const rightNode = right || (
    <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.8}>
      <Image
        source={imageSource(avatarUri)}
        style={[
          styles.avatar,
          getShadow('md', isDark),
          { borderColor: colors.accent, backgroundColor: colors.gray300 },
        ]}
      />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.header, style]}>
      <View style={styles.leftSlot}>{left || (showLogo ? <HabobaLogo size="small" /> : null)}</View>
      <View style={styles.rightSlot}>{rightNode}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  leftSlot: {
    flexShrink: 1,
  },
  rightSlot: {
    minWidth: 36,
    alignItems: 'flex-end',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
  },
});
