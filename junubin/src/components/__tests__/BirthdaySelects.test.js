import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import BirthdaySelects from '../BirthdaySelects';

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
  black: '#111', gray400: '#A0A0A0', gray500: '#888',
  cardBg: '#FFF', surface: '#FFF', separator: '#E7E7E7',
  inputBg: '#F4F1EA', accent: '#0F8FD6',
};

beforeEach(() => mockUseTheme.mockReturnValue({ isDark: false, colors: COLORS }));

describe('BirthdaySelects', () => {
  it('shows Day / Month / Year placeholders when there is no value', () => {
    const { getByText } = render(
      <BirthdaySelects value="" onChange={() => {}} testID="bday" />,
    );
    expect(getByText('Day')).toBeTruthy();
    expect(getByText('Month')).toBeTruthy();
    expect(getByText('Year')).toBeTruthy();
  });

  it('splits an MM/DD/YYYY value across the three selects', () => {
    const { getByText } = render(
      <BirthdaySelects value="03/14/1998" onChange={() => {}} testID="bday" />,
    );
    expect(getByText('14')).toBeTruthy();
    expect(getByText('March')).toBeTruthy();
    expect(getByText('1998')).toBeTruthy();
  });

  it('opens the shared wheel sheet from any of the three selects', () => {
    const { getByTestId, getByText } = render(
      <BirthdaySelects value="" onChange={() => {}} testID="bday" />,
    );
    fireEvent.press(getByTestId('bday-month'));
    expect(getByText('Set')).toBeTruthy();
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('commits the whole date as one payload on Set', () => {
    const onChange = jest.fn();
    const { getByTestId, getByText } = render(
      <BirthdaySelects value="03/14/1998" onChange={onChange} testID="bday" />,
    );
    fireEvent.press(getByTestId('bday-day'));
    fireEvent.press(getByText('Set'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].mmddyyyy).toBe('03/14/1998');
    expect(onChange.mock.calls[0][0].age).toBeGreaterThanOrEqual(18);
  });
});
