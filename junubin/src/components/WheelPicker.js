// WheelPicker — a dependency-free drum/wheel picker.
//
// A single scrollable column the user flicks through; the row that
// lands in the centre band is the selection. Pure JS + a snapping
// ScrollView, so it works in Expo Go with no native module and no app
// rebuild. Compose three of these (month / day / year) to make a date
// picker — see DateWheelPicker.js.
//
// Props:
//   items        Array<string | { label, value }>
//   selectedValue  the currently-selected value
//   onChange(value)  fired when the centred row changes
//   itemHeight   row height in px (default 44)
//   visibleCount odd number of rows visible (default 5)
//   width        column width (default 'auto'/flex)

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { useTheme, FontFamily } from '../theme';
import { hapticSelection } from '../utils/haptics';

// Normalise items into { label, value } pairs. Accepts plain strings or
// objects so callers can pass either a vocabulary list or label/value
// pairs without wrapping.
export function normalizeItems(items) {
  return (items || []).map((it) =>
    it != null && typeof it === 'object'
      ? { label: String(it.label ?? it.value ?? ''), value: it.value ?? it.label }
      : { label: String(it), value: it },
  );
}

// Index of value within items (−1 if absent). Exported for tests.
export function indexOfValue(items, value) {
  const norm = normalizeItems(items);
  return norm.findIndex((it) => it.value === value);
}

export default function WheelPicker({
  items,
  selectedValue,
  onChange,
  itemHeight = 44,
  visibleCount = 5,
  width,
  testID,
}) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark, itemHeight), [colors, isDark, itemHeight]);
  const data = useMemo(() => normalizeItems(items), [items]);
  const scrollRef = useRef(null);
  const lastIndexRef = useRef(-1);
  const isMountedRef = useRef(false);

  // Pad so the first and last rows can scroll into the centre band.
  const pad = Math.floor(visibleCount / 2) * itemHeight;
  const height = visibleCount * itemHeight;

  const selectedIndex = useMemo(() => {
    const i = data.findIndex((it) => it.value === selectedValue);
    return i >= 0 ? i : 0;
  }, [data, selectedValue]);

  // Snap to the selected row on mount and whenever the value changes
  // from outside (e.g. the parent resets it). Guard against feeding our
  // own onChange back in by comparing to lastIndexRef.
  useEffect(() => {
    if (selectedIndex === lastIndexRef.current) return;
    lastIndexRef.current = selectedIndex;
    const y = selectedIndex * itemHeight;
    // Defer to next frame so the ScrollView has measured.
    const id = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: isMountedRef.current });
    });
    return () => cancelAnimationFrame(id);
  }, [selectedIndex, itemHeight]);

  useEffect(() => {
    isMountedRef.current = true;
  }, []);

  const commitFromOffset = useCallback(
    (offsetY) => {
      if (data.length === 0) return;
      let index = Math.round(offsetY / itemHeight);
      index = Math.max(0, Math.min(index, data.length - 1));
      if (index === lastIndexRef.current) return;
      lastIndexRef.current = index;
      hapticSelection();
      onChange?.(data[index].value);
    },
    [data, itemHeight, onChange],
  );

  const handleMomentumEnd = useCallback(
    (e) => commitFromOffset(e.nativeEvent.contentOffset.y),
    [commitFromOffset],
  );

  // On iOS momentum end is reliable; on Android short flicks sometimes
  // skip it, so also commit on drag end.
  const handleDragEnd = useCallback(
    (e) => {
      if (Platform.OS === 'android') commitFromOffset(e.nativeEvent.contentOffset.y);
    },
    [commitFromOffset],
  );

  return (
    <View style={[styles.wrap, { height, width }]} testID={testID}>
      {/* Centre selection band */}
      <View pointerEvents="none" style={[styles.band, { top: pad, height: itemHeight }]} />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        onMomentumScrollEnd={handleMomentumEnd}
        onScrollEndDrag={handleDragEnd}
        contentContainerStyle={{ paddingVertical: pad }}
        nestedScrollEnabled
      >
        {data.map((it, i) => {
          const active = i === selectedIndex;
          return (
            <View key={`${it.value}-${i}`} style={[styles.row, { height: itemHeight }]}>
              <Text
                numberOfLines={1}
                style={[styles.rowText, active ? styles.rowTextActive : styles.rowTextDim]}
              >
                {it.label}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const getStyles = (colors, isDark, itemHeight) =>
  StyleSheet.create({
    wrap: {
      flex: 1,
      overflow: 'hidden',
      position: 'relative',
    },
    band: {
      position: 'absolute',
      left: 6,
      right: 6,
      borderRadius: 10,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F1F4',
    },
    row: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
    },
    rowText: {
      fontSize: 18,
      fontFamily: FontFamily.semibold,
      textAlign: 'center',
    },
    rowTextActive: {
      color: colors.black,
      fontWeight: '700',
      fontFamily: FontFamily.bold,
    },
    rowTextDim: {
      color: colors.gray400,
    },
  });
