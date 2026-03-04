import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useTheme, Typography, FontFamily } from '../theme';

export default function UnderlineTabs({
  tabs,
  activeTab,
  onChange,
  scrollable = false,
  style,
  activeColor,
}) {
  const { colors, isDark } = useTheme();
  const underlineColor = activeColor || colors.accent;

  const renderTabs = () => (
    <View style={[styles.row, !scrollable && styles.rowFill]}>
      {tabs.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, !scrollable && styles.tabFill]}
            activeOpacity={0.75}
            onPress={() => onChange(tab)}
            accessibilityRole="tab"
            accessibilityLabel={tab}
            accessibilityState={{ selected: isActive }}
          >
            <Text
              style={[
                styles.label,
                { color: isDark ? colors.gray600 : colors.gray500 },
                isActive && { color: colors.black, fontFamily: FontFamily.bold },
              ]}
            >
              {tab}
            </Text>
            {isActive && <View style={[styles.underline, { backgroundColor: underlineColor }]} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  if (scrollable) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, style]}>
        {renderTabs()}
      </ScrollView>
    );
  }

  return <View style={style}>{renderTabs()}</View>;
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingRight: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowFill: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 6,
  },
  tab: {
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  tabFill: {
    flex: 1,
    minWidth: 56,
  },
  label: {
    ...Typography.label,
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    fontWeight: '600',
  },
  underline: {
    marginTop: 4,
    width: 22,
    height: 2.5,
    borderRadius: 2,
  },
});
