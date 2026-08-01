// BirthdaySelects — the onboarding birthday row from the redesign
// mock: three select-style fields (day / month / year — 50pt tall,
// surface fill, hairline border, radius 4, flexes 1 / 1.4 / 1). RN has
// no native inline <select>, so the three fields act as one control:
// tapping any of them opens a single bottom sheet of drum wheels, and
// Set commits the whole date at once. That keeps the design's visual
// while avoiding three separate modal round-trips.
//
// onChange receives the same payload shape as DateWheelPicker
// ({ date, iso, mmddyyyy, age }) so ProfileSetup keeps storing
// payload.mmddyyyy unchanged.

import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, FontFamily } from '../theme';
import WheelPicker from './WheelPicker';
import {
  daysInMonth,
  clampDay,
  computeAge,
  formatMMDDYYYY,
  toISODate,
  parseToDate,
  birthYearRange,
} from './DateWheelPicker';

// Full month names — the design's month select shows "March", not "Mar".
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad2 = (n) => String(n).padStart(2, '0');

export default function BirthdaySelects({
  value,
  onChange,
  minAge = 18,
  maxAge = 120,
  testID = 'birthday',
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [open, setOpen] = useState(false);
  const currentDate = useMemo(() => parseToDate(value), [value]);

  // Default the wheels to a sensible adult age (25) when there's no
  // value yet, so the user lands mid-range instead of at a boundary.
  const defaultYear = new Date().getFullYear() - 25;
  const [temp, setTemp] = useState(() => ({
    year: currentDate ? currentDate.getFullYear() : defaultYear,
    month: currentDate ? currentDate.getMonth() + 1 : 1,
    day: currentDate ? currentDate.getDate() : 1,
  }));

  const years = useMemo(() => birthYearRange(minAge, maxAge), [minAge, maxAge]);
  const monthItems = useMemo(
    () => MONTH_NAMES.map((label, i) => ({ label, value: i + 1 })),
    [],
  );
  const dayItems = useMemo(() => {
    const count = daysInMonth(temp.year, temp.month);
    return Array.from({ length: count }, (_, i) => ({ label: pad2(i + 1), value: i + 1 }));
  }, [temp.year, temp.month]);

  const tempDate = useMemo(
    () => new Date(temp.year, temp.month - 1, clampDay(temp.year, temp.month, temp.day)),
    [temp],
  );
  const tempAge = useMemo(() => computeAge(tempDate), [tempDate]);
  const ageValid = Number.isFinite(tempAge) && tempAge >= minAge && tempAge <= maxAge;

  const openSheet = useCallback(() => {
    const d = parseToDate(value);
    setTemp({
      year: d ? d.getFullYear() : defaultYear,
      month: d ? d.getMonth() + 1 : 1,
      day: d ? d.getDate() : 1,
    });
    setOpen(true);
  }, [value, defaultYear]);

  const setField = useCallback((key, v) => {
    setTemp((prev) => {
      const next = { ...prev, [key]: v };
      // Re-clamp the day if the new month/year has fewer days.
      next.day = clampDay(next.year, next.month, next.day);
      return next;
    });
  }, []);

  const handleSet = useCallback(() => {
    if (!ageValid) return;
    const date = new Date(temp.year, temp.month - 1, clampDay(temp.year, temp.month, temp.day));
    onChange?.({
      date,
      iso: toISODate(date),
      mmddyyyy: formatMMDDYYYY(date),
      age: computeAge(date),
    });
    setOpen(false);
  }, [ageValid, temp, onChange]);

  const segments = [
    { key: 'day',   flex: 1,   text: currentDate ? String(currentDate.getDate()) : 'Day' },
    { key: 'month', flex: 1.4, text: currentDate ? MONTH_NAMES[currentDate.getMonth()] : 'Month' },
    { key: 'year',  flex: 1,   text: currentDate ? String(currentDate.getFullYear()) : 'Year' },
  ];

  return (
    <>
      <View style={styles.row}>
        {segments.map((seg) => (
          <TouchableOpacity
            key={seg.key}
            testID={`${testID}-${seg.key}`}
            style={[styles.select, { flex: seg.flex }]}
            activeOpacity={0.7}
            onPress={openSheet}
            accessibilityRole="button"
            accessibilityLabel={`Birthday ${seg.key}, ${currentDate ? seg.text : 'not set'}`}
          >
            <Text style={[styles.selectText, !currentDate && styles.selectPlaceholder]} numberOfLines={1}>
              {seg.text}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.gray400} />
          </TouchableOpacity>
        ))}
      </View>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <TouchableOpacity style={styles.backdropTap} activeOpacity={1} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>Birthday</Text>
              <TouchableOpacity
                onPress={handleSet}
                disabled={!ageValid}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.setText, !ageValid && styles.setTextDisabled]}>Set</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.wheels}>
              <WheelPicker
                testID="bday-day"
                items={dayItems}
                selectedValue={clampDay(temp.year, temp.month, temp.day)}
                onChange={(v) => setField('day', v)}
              />
              <WheelPicker
                testID="bday-month"
                items={monthItems}
                selectedValue={temp.month}
                onChange={(v) => setField('month', v)}
              />
              <WheelPicker
                testID="bday-year"
                items={years}
                selectedValue={temp.year}
                onChange={(v) => setField('year', v)}
              />
            </View>

            <Text style={[styles.ageHint, !ageValid && styles.ageHintWarn]}>
              {ageValid
                ? `You're ${tempAge}`
                : `You must be ${minAge} or older to use JuNubin.`}
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const getStyles = (colors, isDark) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 8,
    },
    select: {
      height: 50,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.separator,
      backgroundColor: colors.inputBg,
      borderRadius: 4,
      paddingHorizontal: 10,
    },
    selectText: {
      flex: 1,
      fontSize: 16,
      fontFamily: FontFamily.regular,
      color: colors.black,
      marginRight: 4,
    },
    selectPlaceholder: {
      color: colors.gray400,
    },
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
      borderTopWidth: 1,
      borderTopColor: colors.separator,
      paddingHorizontal: 18,
      paddingTop: 14,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 48,
      paddingBottom: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.separator,
    },
    sheetTitle: {
      fontFamily: FontFamily.heading,
      fontSize: 18,
      letterSpacing: 1.1,
      color: colors.black,
      textTransform: 'uppercase',
    },
    cancelText: {
      fontFamily: FontFamily.semibold,
      fontSize: 13.5,
      color: colors.gray500,
    },
    setText: {
      fontFamily: FontFamily.headingBold,
      fontSize: 14,
      letterSpacing: 1.1,
      color: colors.gold || colors.accent,
      textTransform: 'uppercase',
    },
    setTextDisabled: {
      color: colors.gray400,
    },
    wheels: {
      flexDirection: 'row',
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.separator,
    },
    ageHint: {
      fontFamily: FontFamily.medium,
      fontSize: 13,
      lineHeight: 18,
      color: colors.gray500,
      textAlign: 'center',
      paddingTop: 10,
    },
    ageHintWarn: {
      color: colors.error || colors.accent,
    },
  });
