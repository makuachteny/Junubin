// Haboba — Preference Selection Screen
// Full-screen picker for a single dating preference

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily, getShadow } from '../theme';

export default function PreferenceSelectScreen({ navigation, route }) {
  const { prefKey, title, options = [], currentValue, prefType } = route.params || {};
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const handleSelect = (value) => {
    navigation.navigate('Preferences', {
      updatedPref: { key: prefKey, value, type: prefType },
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Text style={styles.subtitle}>Choose your preference</Text>

        <View style={styles.card}>
          {options.map((option, index) => {
            const isSelected = option.value === currentValue;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionRow,
                  index < options.length - 1 && styles.optionBorder,
                  isSelected && styles.optionSelected,
                ]}
                activeOpacity={0.6}
                onPress={() => handleSelect(option.value)}
              >
                <View style={styles.optionLeft}>
                  {option.icon && (
                    <View style={[styles.optionIconWrap, isSelected && styles.optionIconSelected]}>
                      <Ionicons
                        name={option.icon}
                        size={18}
                        color={isSelected ? colors.accent : colors.gray500}
                      />
                    </View>
                  )}
                  <View style={styles.optionTextWrap}>
                    <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                      {option.label}
                    </Text>
                    {option.description && (
                      <Text style={styles.optionDesc}>{option.description}</Text>
                    )}
                  </View>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const getStyles = (colors, isDark) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.separator,
  },
  backBtn: {
    width: 40,
    alignItems: 'flex-start',
  },
  headerTitle: {
    ...Typography.screenTitle,
    color: colors.black,
    flex: 1,
    textAlign: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: FontFamily.medium,
    color: colors.gray500,
    marginBottom: 16,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    overflow: 'hidden',
    ...getShadow('sm', isDark),
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  optionBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: colors.separator,
  },
  optionSelected: {
    backgroundColor: isDark ? 'rgba(229,107,140,0.08)' : 'rgba(229,107,140,0.05)',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  optionIconSelected: {
    backgroundColor: isDark ? 'rgba(229,107,140,0.15)' : 'rgba(229,107,140,0.1)',
  },
  optionTextWrap: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.black,
  },
  optionLabelSelected: {
    color: colors.accent,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  optionDesc: {
    fontSize: 13,
    fontWeight: '400',
    fontFamily: FontFamily.regular,
    color: colors.gray500,
    marginTop: 3,
    lineHeight: 18,
  },
});
