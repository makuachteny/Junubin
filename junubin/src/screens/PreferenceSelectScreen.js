// AnaJunubin — Preference Selection Screen
// Full-screen picker for a single dating preference

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily, getShadow } from '../theme';
import { filterOptions } from '../components/SearchablePicker';

// Lists longer than this get a search box so users aren't forced to
// scroll through dozens of rows (e.g. the 69-tribe ethnicity list).
const SEARCH_THRESHOLD = 12;

export default function PreferenceSelectScreen({ navigation, route }) {
  const { prefKey, title, options = [], currentValue, prefType, returnTo } = route.params || {};
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [selected, setSelected] = useState(currentValue);
  const [query, setQuery] = useState('');

  const showSearch = options.length > SEARCH_THRESHOLD;
  const visibleOptions = useMemo(
    () => (showSearch ? filterOptions(options, query) : options),
    [showSearch, options, query],
  );

  // Commit instantly on tap and return — single-select shouldn't need a
  // separate "Done" tap. Done remains as a no-change fallback.
  // Route back to the Preferences screen with the picked value. We pass
  // returnTo straight through so Preferences' own Done still knows the
  // originating screen after this sub-selection round-trip.
  const commit = (value) => {
    navigation.navigate('Preferences', {
      updatedPref: { key: prefKey, value, type: prefType },
      returnTo,
    });
  };

  const handleSelect = (value) => {
    setSelected(value);
    commit(value);
  };

  const handleDone = () => {
    commit(selected ?? currentValue);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleDone}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={colors.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <TouchableOpacity
          onPress={handleDone}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.doneBtn}
        >
          <Text style={styles.doneText} numberOfLines={1}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.contextCard}>
          <View style={styles.contextIconWrap}>
            <Ionicons name="options-outline" size={16} color={colors.accent} />
          </View>
          <Text style={styles.contextText}>Fine-tune your matches</Text>
        </View>
        <View style={{ alignItems: 'center', marginBottom: 8 }}>

        </View>

        <Text style={styles.subtitle}>Choose one option</Text>

        {showSearch && (
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={colors.gray400} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={`Search ${title?.toLowerCase() || 'options'}…`}
              placeholderTextColor={colors.gray400}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={colors.gray400} />
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.card}>
          {visibleOptions.length === 0 && (
            <Text style={styles.emptyText}>No matches for “{query}”.</Text>
          )}
          {visibleOptions.map((option, index) => {
            const isSelected = option.value === selected;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionRow,
                  index < visibleOptions.length - 1 && styles.optionBorder,
                  isSelected && styles.optionSelected,
                ]}
                activeOpacity={0.6}
                onPress={() => handleSelect(option.value)}
              >
                <View style={styles.optionLeft}>
                  <View style={[styles.selectionRing, isSelected && styles.selectionRingActive]}>
                    {isSelected && <View style={styles.selectionRingInner} />}
                  </View>
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
    backgroundColor: colors.surfaceMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 0,
  },
  backBtn: {
    width: 40,
    alignItems: 'flex-start',
  },
  doneBtn: {
    width: 64,
    minWidth: 64,
    alignItems: 'flex-end',
  },
  doneText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: colors.accent,
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: isDark ? colors.cardBorder : colors.gray200,
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  searchInput: {
    ...Typography.body,
    color: colors.black,
    flex: 1,
    padding: 0,
  },
  emptyText: {
    ...Typography.body,
    color: colors.gray500,
    textAlign: 'center',
    paddingVertical: 28,
  },
  contextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#ECECF0',
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8F8FA',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  contextIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : '#FFFFFF',
    marginRight: 8,
  },
  contextText: {
    fontSize: 13,
    fontFamily: FontFamily.semibold,
    fontWeight: '600',
    color: colors.gray700,
  },
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: isDark ? colors.cardBorder : colors.gray200,
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
    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8F8FA',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectionRing: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.gray300,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionRingActive: {
    borderColor: colors.accent,
  },
  selectionRingInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
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
    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E8E8EC',
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
