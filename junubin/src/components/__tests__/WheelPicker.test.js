import React from 'react';
import { render } from '@testing-library/react-native';

import WheelPicker, { normalizeItems, indexOfValue } from '../WheelPicker';

const mockUseTheme = jest.fn();

jest.mock('../../theme', () => {
  const actual = jest.requireActual('../../theme');
  return { ...actual, useTheme: () => mockUseTheme() };
});

jest.mock('../../utils/haptics', () => ({ hapticSelection: jest.fn() }));

const COLORS = { black: '#111', gray400: '#A0A0A0' };

beforeEach(() => mockUseTheme.mockReturnValue({ isDark: false, colors: COLORS }));

describe('WheelPicker helpers', () => {
  it('normalizeItems handles strings and {label,value}', () => {
    expect(normalizeItems([1, 2])).toEqual([
      { label: '1', value: 1 },
      { label: '2', value: 2 },
    ]);
    expect(normalizeItems([{ label: 'Jan', value: 1 }])).toEqual([{ label: 'Jan', value: 1 }]);
  });

  it('indexOfValue finds the position or returns -1', () => {
    const items = [{ label: 'Jan', value: 1 }, { label: 'Feb', value: 2 }];
    expect(indexOfValue(items, 2)).toBe(1);
    expect(indexOfValue(items, 99)).toBe(-1);
  });
});

describe('WheelPicker component', () => {
  it('renders its option labels', () => {
    const { getByText } = render(
      <WheelPicker
        items={[{ label: 'Jan', value: 1 }, { label: 'Feb', value: 2 }]}
        selectedValue={1}
        onChange={() => {}}
      />,
    );
    expect(getByText('Jan')).toBeTruthy();
    expect(getByText('Feb')).toBeTruthy();
  });
});
