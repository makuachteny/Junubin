// SearchablePicker — a modal single-select list with a search box, for
// long option lists (e.g. the 69 South Sudanese tribes) where a chip
// wall or unfiltered scroll wastes time. Type to filter, tap to pick;
// selecting commits immediately and closes the sheet (no extra "Done").
//
// Controlled: the parent owns `visible` and closes it via onClose.

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';

export function normalizeOptions(options) {
  return (options || []).map((o) =>
    o != null && typeof o === 'object'
      ? { label: String(o.label ?? o.value ?? ''), value: o.value ?? o.label, description: o.description, icon: o.icon }
      : { label: String(o), value: o },
  );
}

// Case-insensitive substring match on label + description. Exported for
// tests so the filtering logic is verified without rendering.
export function filterOptions(options, query) {
  const norm = normalizeOptions(options);
  const q = String(query || '').trim().toLowerCase();
  if (!q) return norm;
  return norm.filter(
    (o) =>
      o.label.toLowerCase().includes(q) ||
      (o.description && String(o.description).toLowerCase().includes(q)),
  );
}

export default function SearchablePicker({
  visible,
  onClose,
  title = 'Select',
  options = [],
  selectedValue,
  onSelect,
  searchPlaceholder = 'Search…',
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [query, setQuery] = useState('');

  // Reset the query each time the sheet opens so a stale filter doesn't
  // hide everything next time.
  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const data = useMemo(() => filterOptions(options, query), [options, query]);

  const handlePick = useCallback(
    (value) => {
      onSelect?.(value);
      onClose?.();
    },
    [onSelect, onClose],
  );

  const renderItem = useCallback(
    ({ item }) => {
      const isSelected = item.value === selectedValue;
      return (
        <TouchableOpacity
          style={[styles.row, isSelected && styles.rowSelected]}
          activeOpacity={0.6}
          onPress={() => handlePick(item.value)}
        >
          {item.icon ? (
            <Ionicons
              name={item.icon}
              size={18}
              color={isSelected ? colors.accent : colors.gray500}
              style={{ marginRight: 12 }}
            />
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, isSelected && styles.rowLabelSelected]}>{item.label}</Text>
            {item.description ? <Text style={styles.rowDesc}>{item.description}</Text> : null}
          </View>
          {isSelected && <Ionicons name="checkmark-circle" size={22} color={colors.accent} />}
        </TouchableOpacity>
      );
    },
    [selectedValue, styles, colors, handlePick],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTap} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.sheet, { paddingBottom: insets.bottom }]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.black} />
            </TouchableOpacity>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={colors.gray400} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
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

          <FlatList
            data={data}
            keyExtractor={(item, i) => `${item.value}-${i}`}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>No matches for “{query}”.</Text>}
            initialNumToRender={14}
            showsVerticalScrollIndicator={false}
          />
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const getStyles = (colors, isDark) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    backdropTap: {
      flex: 1,
    },
    sheet: {
      backgroundColor: isDark ? colors.surface : colors.cardBg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 8,
      maxHeight: '80%',
    },
    handle: {
      alignSelf: 'center',
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.gray300,
      marginBottom: 8,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    title: {
      ...Typography.screenTitle,
      color: colors.black,
    },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.gray200,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 10 : 4,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F7F7F9',
      marginBottom: 8,
    },
    searchInput: {
      ...Typography.body,
      color: colors.black,
      flex: 1,
      padding: 0,
    },
    list: {
      flexGrow: 0,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.separator,
    },
    rowSelected: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8F8FA',
    },
    rowLabel: {
      ...Typography.bodyMedium,
      color: colors.black,
    },
    rowLabelSelected: {
      color: colors.accent,
      fontWeight: '700',
      fontFamily: FontFamily.bold,
    },
    rowDesc: {
      ...Typography.caption,
      color: colors.gray500,
      marginTop: 2,
    },
    empty: {
      ...Typography.body,
      color: colors.gray500,
      textAlign: 'center',
      paddingVertical: 30,
    },
  });
