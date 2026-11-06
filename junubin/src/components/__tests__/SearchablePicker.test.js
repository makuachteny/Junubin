import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import SearchablePicker, { normalizeOptions, filterOptions } from '../SearchablePicker';

const mockUseTheme = jest.fn();

jest.mock('../../theme', () => {
  const actual = jest.requireActual('../../theme');
  return { ...actual, useTheme: () => mockUseTheme() };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const COLORS = {
  black: '#111', gray200: '#E8E8E8', gray300: '#D8D8D8', gray400: '#A0A0A0',
  gray500: '#888', cardBg: '#FFF', surface: '#FFF', separator: '#E7E7E7', accent: '#CE1126',
};

beforeEach(() => mockUseTheme.mockReturnValue({ isDark: false, colors: COLORS }));

describe('SearchablePicker helpers', () => {
  it('normalizeOptions accepts strings and objects', () => {
    expect(normalizeOptions(['Dinka', 'Nuer'])).toEqual([
      { label: 'Dinka', value: 'Dinka' },
      { label: 'Nuer', value: 'Nuer' },
    ]);
    const [first] = normalizeOptions([{ label: 'Bari', value: 'bari', description: 'Equatoria' }]);
    expect(first).toMatchObject({ label: 'Bari', value: 'bari', description: 'Equatoria' });
  });

  it('filterOptions matches label and description, case-insensitive', () => {
    const opts = [
      { label: 'Dinka', value: 'Dinka', description: 'Nilotic' },
      { label: 'Nuer', value: 'Nuer', description: 'Nilotic' },
      { label: 'Bari', value: 'Bari', description: 'Equatoria' },
    ];
    expect(filterOptions(opts, 'din').map((o) => o.value)).toEqual(['Dinka']);
    expect(filterOptions(opts, 'NILOTIC').map((o) => o.value)).toEqual(['Dinka', 'Nuer']);
    expect(filterOptions(opts, '').length).toBe(3);
    expect(filterOptions(opts, 'xyz').length).toBe(0);
  });
});

describe('SearchablePicker component', () => {
  const options = ['Dinka', 'Nuer', 'Bari', 'Shilluk', 'Azande'];

  it('filters the list as the user types and commits on tap', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const { getByPlaceholderText, getByText, queryByText } = render(
      <SearchablePicker
        visible
        onClose={onClose}
        title="Ethnicity"
        options={options}
        selectedValue={null}
        onSelect={onSelect}
        searchPlaceholder="Search tribes…"
      />,
    );

    // All present initially
    expect(getByText('Dinka')).toBeTruthy();

    fireEvent.changeText(getByPlaceholderText('Search tribes…'), 'sha');
    // No "sha" match -> empty state; Azande/Shilluk don't contain "sha"
    expect(queryByText('Dinka')).toBeNull();

    fireEvent.changeText(getByPlaceholderText('Search tribes…'), 'shi');
    const shilluk = getByText('Shilluk');
    fireEvent.press(shilluk);
    expect(onSelect).toHaveBeenCalledWith('Shilluk');
    expect(onClose).toHaveBeenCalled();
  });
});
