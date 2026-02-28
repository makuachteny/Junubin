import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, FontFamily } from '../theme';

const MODES = ['Social', 'Dating'];

const ModeToggle = ({ mode, onModeChange, light = false }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, !light && styles.containerLight]}>
      {MODES.map((m) => {
        const isActive = mode === m;
        return (
          <TouchableOpacity
            key={m}
            onPress={() => onModeChange(m)}
            activeOpacity={0.7}
            style={[
              styles.tab,
              isActive && [styles.tabActive, { backgroundColor: colors.accent }],
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: light ? 'rgba(255,255,255,0.75)' : colors.gray600 },
                isActive && styles.tabTextActive,
              ]}
            >
              {m}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Spotlight pill */}
      <TouchableOpacity
        onPress={() => onModeChange('Spotlight')}
        activeOpacity={0.7}
        style={[
          styles.spotlightTab,
          {
            borderColor: mode === 'Spotlight'
              ? colors.accent
              : (light ? 'rgba(255,255,255,0.4)' : colors.gray300),
            backgroundColor: mode === 'Spotlight' ? colors.accent : 'transparent',
          },
        ]}
      >
        <Ionicons
          name="flash"
          size={14}
          color={mode === 'Spotlight' ? '#FFF' : (light ? 'rgba(255,255,255,0.75)' : colors.gray500)}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 24,
    padding: 3,
    gap: 2,
  },
  containerLight: {
    backgroundColor: '#F5F5F5',
  },
  tab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    letterSpacing: 0.2,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  spotlightTab: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
});

export default ModeToggle;
