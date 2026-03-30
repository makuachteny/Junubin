import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, getShadow } from '../theme';
import { imageSource } from '../utils/imageSource';
import BrandLogo from './BrandLogo';

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
    <TouchableOpacity
      onPress={onAvatarPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Profile avatar"
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
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
      <View style={styles.leftSlot}>{left || (showLogo ? <BrandLogo size="small" /> : null)}</View>
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
    minWidth: 40,
    alignItems: 'flex-end',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
  },
});
