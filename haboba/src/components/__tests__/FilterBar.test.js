import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import FilterBar from '../FilterBar';

const mockUseTheme = jest.fn();

jest.mock('../../theme', () => {
  const actual = jest.requireActual('../../theme');
  return {
    ...actual,
    useTheme: () => mockUseTheme(),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe('FilterBar', () => {
  beforeEach(() => {
    mockUseTheme.mockReturnValue({
      isDark: false,
      colors: {
        black: '#111111',
        white: '#FFFFFF',
        gray200: '#E8E8E8',
        gray300: '#D8D8D8',
        gray600: '#666666',
        accent: '#E8613C',
        accentTint10: '#FDE7E1',
        surface: '#FFFFFF',
      },
    });
  });

  it('calls onSettingsPress when settings button is tapped', () => {
    const onSettingsPress = jest.fn();
    const { getByLabelText } = render(
      <FilterBar onSettingsPress={onSettingsPress} />
    );

    fireEvent.press(getByLabelText('Filter settings'));
    expect(onSettingsPress).toHaveBeenCalled();
  });

  it('calls onFilterPress for non-chevron filters', () => {
    const onFilterPress = jest.fn();
    const filters = [{ label: 'Vibe', icon: 'sparkles-outline', hasChevron: false }];

    const { getByLabelText } = render(
      <FilterBar
        filters={filters}
        options={{}}
        onFilterPress={onFilterPress}
        showSettingsButton={false}
      />
    );

    fireEvent.press(getByLabelText('Filter by Vibe'));
    expect(onFilterPress).toHaveBeenCalledWith('Vibe');
  });
});
