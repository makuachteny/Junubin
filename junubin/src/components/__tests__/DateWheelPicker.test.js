import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import DateWheelPicker, {
  daysInMonth,
  clampDay,
  computeAge,
  formatMMDDYYYY,
  toISODate,
  parseToDate,
  birthYearRange,
} from '../DateWheelPicker';

const mockUseTheme = jest.fn();

jest.mock('../../theme', () => {
  const actual = jest.requireActual('../../theme');
  return { ...actual, useTheme: () => mockUseTheme() };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../../utils/haptics', () => ({ hapticSelection: jest.fn() }));

const COLORS = {
  black: '#111', gray200: '#E8E8E8', gray400: '#A0A0A0', gray500: '#888',
  cardBg: '#FFF', surface: '#FFF', separator: '#E7E7E7', accent: '#CE1126',
};

beforeEach(() => mockUseTheme.mockReturnValue({ isDark: false, colors: COLORS }));

describe('DateWheelPicker helpers', () => {
  it('daysInMonth handles 31/30/Feb + leap years', () => {
    expect(daysInMonth(2025, 1)).toBe(31); // Jan
    expect(daysInMonth(2025, 4)).toBe(30); // Apr
    expect(daysInMonth(2025, 2)).toBe(28); // Feb non-leap
    expect(daysInMonth(2024, 2)).toBe(29); // Feb leap
  });

  it('clampDay caps the day to the month length', () => {
    expect(clampDay(2025, 2, 31)).toBe(28); // Feb non-leap
    expect(clampDay(2024, 2, 31)).toBe(29); // Feb leap
    expect(clampDay(2025, 1, 15)).toBe(15);
    expect(clampDay(2025, 1, 0)).toBe(1);
  });

  it('computeAge respects whether the birthday has passed this year', () => {
    const today = new Date(2026, 4, 22); // 2026-05-22
    expect(computeAge(new Date(2000, 4, 22), today)).toBe(26); // birthday today
    expect(computeAge(new Date(2000, 4, 23), today)).toBe(25); // tomorrow
    expect(computeAge(new Date(2008, 0, 1), today)).toBe(18);
    expect(computeAge(new Date(2008, 11, 31), today)).toBe(17); // not yet 18
  });

  it('formatMMDDYYYY and toISODate are stable', () => {
    const d = new Date(2000, 0, 5); // Jan 5 2000
    expect(formatMMDDYYYY(d)).toBe('01/05/2000');
    expect(toISODate(d)).toBe('2000-01-05T00:00:00.000Z');
    expect(formatMMDDYYYY(null)).toBe('');
  });

  it('parseToDate accepts Date, ISO, MM/DD/YYYY, YYYY-MM-DD', () => {
    expect(parseToDate('01/05/2000').getFullYear()).toBe(2000);
    expect(parseToDate('2000-01-05').getMonth()).toBe(0);
    expect(parseToDate('2000-01-05T00:00:00.000Z').getDate()).toBe(5);
    expect(parseToDate(new Date(2000, 0, 5)).getDate()).toBe(5);
    expect(parseToDate('')).toBeNull();
    expect(parseToDate(null)).toBeNull();
  });

  it('birthYearRange covers minAge..maxAge inclusive, oldest first', () => {
    const today = new Date(2026, 0, 1);
    const years = birthYearRange(18, 120, today);
    expect(years[0]).toBe(2026 - 120);
    expect(years[years.length - 1]).toBe(2026 - 18);
    expect(years).toContain(2008);
  });
});

describe('DateWheelPicker component', () => {
  it('shows the placeholder when no value', () => {
    const { getByText } = render(
      <DateWheelPicker value={null} onChange={() => {}} placeholder="Pick date" />,
    );
    expect(getByText('Pick date')).toBeTruthy();
  });

  it('renders a formatted label when given a value', () => {
    const { getByText } = render(
      <DateWheelPicker value="2000-01-05" onChange={() => {}} />,
    );
    expect(getByText('Jan 5, 2000')).toBeTruthy();
  });

  it('opens the wheel sheet on press', () => {
    const { getByTestId, getByText } = render(
      <DateWheelPicker testID="dob" value={null} onChange={() => {}} />,
    );
    fireEvent.press(getByTestId('dob'));
    expect(getByText('Set')).toBeTruthy();
  });
});
