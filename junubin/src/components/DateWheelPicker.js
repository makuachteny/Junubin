// DateWheelPicker — a month / day / year drum picker for dates of
// birth. Renders as a tappable field that opens a bottom-sheet of three
// WheelPickers. Pure date helpers are exported for unit testing (the
// scroll behaviour itself isn't worth testing in jsdom).
//
// onChange receives an object so each caller can use whichever format it
// persists:  { date, iso, mmddyyyy, age }
//
//   ProfileSetup stores MM/DD/YYYY  → use payload.mmddyyyy
//   EditProfile  stores ISO string  → use payload.iso

import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, Typography, FontFamily } from '../theme';
import WheelPicker from './WheelPicker';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Pure helpers (exported for tests) ───────────────────────────────

export function daysInMonth(year, month1) {
  // month1 is 1-12. Day 0 of next month == last day of this month.
  return new Date(year, month1, 0).getDate();
}

export function clampDay(year, month1, day) {
  return Math.max(1, Math.min(day, daysInMonth(year, month1)));
}

export function computeAge(date, today = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return NaN;
  let age = today.getFullYear() - date.getFullYear();
  const m = today.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < date.getDate())) age -= 1;
  return age;
}

const pad2 = (n) => String(n).padStart(2, '0');

export function formatMMDDYYYY(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}/${date.getFullYear()}`;
}

export function toISODate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  // Midnight UTC so the calendar date can't drift across timezones.
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString();
}

// Accepts Date | ISO string | "MM/DD/YYYY" | "YYYY-MM-DD" → Date | null.
export function parseToDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const str = String(value).trim();
  let m;
  if ((m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))) {
    return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  }
  if ((m = str.match(/^(\d{4})-(\d{2})-(\d{2})/))) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Years a person of [minAge, maxAge] could have been born in, oldest
// first. Year-only bounds are coarse — exact age is re-checked on Set.
export function birthYearRange(minAge = 18, maxAge = 120, today = new Date()) {
  const newest = today.getFullYear() - minAge;
  const oldest = today.getFullYear() - maxAge;
  const years = [];
  for (let y = oldest; y <= newest; y += 1) years.push(y);
  return years;
}

// ── Component ───────────────────────────────────────────────────────

export default function DateWheelPicker({
  value,
  onChange,
  minAge = 18,
  maxAge = 120,
  placeholder = 'Select date',
  style,
  testID,
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [open, setOpen] = useState(false);
  const currentDate = useMemo(() => parseToDate(value), [value]);

  // Default the wheels to a sensible adult age (25) when there's no
  // value yet, so the user lands mid-range instead of at a boundary.
  const defaultYear = new Date().getFullYear() - 25;
  const [temp, setTemp] = useState(() => {
    const d = currentDate;
    return {
      year: d ? d.getFullYear() : defaultYear,
      month: d ? d.getMonth() + 1 : 1,
      day: d ? d.getDate() : 1,
    };
  });

  const years = useMemo(() => birthYearRange(minAge, maxAge), [minAge, maxAge]);
  const monthItems = useMemo(
    () => MONTH_LABELS.map((label, i) => ({ label, value: i + 1 })),
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

  const displayLabel = currentDate
    ? `${MONTH_LABELS[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`
    : placeholder;

  return (
    <>
      <TouchableOpacity
        style={[styles.field, style]}
        activeOpacity={0.7}
        onPress={openSheet}
        testID={testID}
      >
        <Ionicons name="calendar-outline" size={18} color={colors.gray500} style={{ marginRight: 10 }} />
        <Text style={[styles.fieldText, !currentDate && styles.fieldPlaceholder]}>{displayLabel}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.gray400} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <TouchableOpacity style={styles.backdropTap} activeOpacity={1} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.sheetHeader}>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.sheetTitle}>Date of birth</Text>
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
                testID="dob-month"
                items={monthItems}
                selectedValue={temp.month}
                onChange={(v) => setField('month', v)}
              />
              <WheelPicker
                testID="dob-day"
                items={dayItems}
                selectedValue={clampDay(temp.year, temp.month, temp.day)}
                onChange={(v) => setField('day', v)}
              />
              <WheelPicker
                testID="dob-year"
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
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.gray200,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
      backgroundColor: colors.cardBg,
    },
    fieldText: {
      ...Typography.body,
      color: colors.black,
      flex: 1,
    },
    fieldPlaceholder: {
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
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 16,
      paddingTop: 12,
    },
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.separator,
    },
    sheetTitle: {
      ...Typography.bodySemibold,
      color: colors.black,
    },
    cancelText: {
      ...Typography.body,
      color: colors.gray500,
    },
    setText: {
      ...Typography.bodySemibold,
      color: colors.accent,
    },
    setTextDisabled: {
      color: colors.gray400,
    },
    wheels: {
      flexDirection: 'row',
      paddingVertical: 8,
    },
    ageHint: {
      ...Typography.caption,
      color: colors.gray500,
      textAlign: 'center',
      paddingTop: 4,
    },
    ageHintWarn: {
      color: colors.accent,
    },
  });
