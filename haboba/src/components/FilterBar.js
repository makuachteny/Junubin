// AnaJunubin — Filter Bar
// Scrollable filter pills with bottom-sheet wheel-picker dropdowns

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  ScrollView,
  Modal,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontFamily, useTheme, getShadow, getSurface, Typography } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Age range options
const AGE_OPTIONS = [
  { label: '18 – 20', value: '18-20' },
  { label: '18 – 24', value: '18-24' },
  { label: '18 – 29', value: '18-29' },
  { label: '21 – 25', value: '21-25' },
  { label: '21 – 30', value: '21-30' },
  { label: '21 – 35', value: '21-35' },
  { label: '25 – 30', value: '25-30' },
  { label: '25 – 35', value: '25-35' },
  { label: '25 – 40', value: '25-40' },
  { label: '30 – 35', value: '30-35' },
  { label: '30 – 40', value: '30-40' },
  { label: '30 – 45', value: '30-45' },
  { label: '35 – 40', value: '35-40' },
  { label: '35 – 45', value: '35-45' },
  { label: '35 – 50', value: '35-50' },
  { label: '40 – 50', value: '40-50' },
  { label: '45 – 55', value: '45-55' },
  { label: '50+', value: '50+' },
];

// Build individual height options 4'10" – 6'8"+
const HEIGHT_OPTIONS = [];
for (let feet = 4; feet <= 6; feet++) {
  const startIn = feet === 4 ? 10 : 0;
  const endIn = feet === 6 ? 8 : 11;
  for (let inches = startIn; inches <= endIn; inches++) {
    const label = `${feet}'${inches}"`;
    const totalInches = feet * 12 + inches;
    HEIGHT_OPTIONS.push({ label, value: String(totalInches) });
  }
}
HEIGHT_OPTIONS.push({ label: "6'9\"+", value: '81' });

// Distance options (miles)
const DISTANCE_OPTIONS = [
  { label: '1 mile', value: '1' },
  { label: '2 miles', value: '2' },
  { label: '5 miles', value: '5' },
  { label: '10 miles', value: '10' },
  { label: '15 miles', value: '15' },
  { label: '25 miles', value: '25' },
  { label: '50 miles', value: '50' },
  { label: '100 miles', value: '100' },
  { label: 'Anywhere', value: 'any' },
];

// Ethnicity options (South Sudanese tribes)
const ETHNICITY_OPTIONS = [
  { label: 'Any ethnicity', value: 'any' },
  { label: 'Dinka', value: 'Dinka' },
  { label: 'Nuer', value: 'Nuer' },
  { label: 'Bari', value: 'Bari' },
  { label: 'Shilluk', value: 'Shilluk' },
  { label: 'Azande', value: 'Azande' },
  { label: 'Mundari', value: 'Mundari' },
  { label: 'Acholi', value: 'Acholi' },
  { label: 'Lotuko', value: 'Lotuko' },
  { label: 'Toposa', value: 'Toposa' },
  { label: 'Murle', value: 'Murle' },
  { label: 'Madi', value: 'Madi' },
  { label: 'Other', value: 'Other' },
];

// Education options
const EDUCATION_OPTIONS = [
  { label: 'Any education', value: 'any' },
  { label: 'High school', value: 'High school' },
  { label: "Associate's degree", value: "Associate's degree" },
  { label: "Bachelor's degree", value: "Bachelor's degree" },
  { label: "Master's degree", value: "Master's degree" },
  { label: 'Doctorate', value: 'Doctorate' },
  { label: 'Trade school', value: 'Trade school' },
];

// Children options
const CHILDREN_OPTIONS = [
  { label: "Doesn't matter", value: 'any' },
  { label: 'No children', value: 'No children' },
  { label: 'Has children', value: 'Has children' },
  { label: 'Want children', value: 'Want children' },
  { label: "Don't want children", value: "Don't want children" },
  { label: 'Open to children', value: 'Open to children' },
];

const DEFAULT_FILTER_OPTIONS = {
  Age: AGE_OPTIONS,
  Height: HEIGHT_OPTIONS,
  Distance: DISTANCE_OPTIONS,
  Ethnicity: ETHNICITY_OPTIONS,
  Education: EDUCATION_OPTIONS,
  Children: CHILDREN_OPTIONS,
  'Dating Intentions': [
    { label: 'Serious relationship', value: 'serious' },
    { label: 'Marriage', value: 'marriage' },
    { label: 'Casual dating', value: 'casual' },
    { label: 'Still figuring out', value: 'figuring-out' },
    { label: 'Open to all', value: 'open' },
  ],
};

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 3;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const DEFAULT_FILTERS = [
  { label: 'Age', hasChevron: true, icon: 'calendar-outline' },
  { label: 'Distance', hasChevron: true, icon: 'location-outline' },
  { label: 'Ethnicity', hasChevron: true, icon: 'people-outline' },
  { label: 'Height', hasChevron: true, icon: 'resize-outline' },
  { label: 'Dating Intentions', hasChevron: true, icon: 'heart-outline' },
  { label: 'Education', hasChevron: true, icon: 'school-outline' },
  { label: 'Children', hasChevron: true, icon: 'happy-outline' },
  { label: 'Verified', hasChevron: false, icon: 'checkmark-circle-outline' },
];

// ─── Wheel Picker ───────────────────────────────────────────
const WheelPicker = ({ options, selectedValue, onSelect, colors, isDark }) => {
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef(null);
  const paddingItems = Math.floor(VISIBLE_ITEMS / 2);

  const selectedIdx = options.findIndex((o) => o.value === selectedValue);
  const initialIdx = selectedIdx >= 0 ? selectedIdx : 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: initialIdx * ITEM_HEIGHT, animated: false });
    }, 50);
    return () => clearTimeout(timer);
  }, [initialIdx]);

  const handleMomentumEnd = useCallback(
    (e) => {
      const offsetY = e.nativeEvent.contentOffset.y;
      const index = Math.round(offsetY / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(index, options.length - 1));
      if (options[clamped]) {
        onSelect(options[clamped]);
      }
    },
    [options, onSelect],
  );

  return (
    <View style={{ height: PICKER_HEIGHT, overflow: 'hidden' }}>
      {/* Center highlight band */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: ITEM_HEIGHT * paddingItems,
          left: 16,
          right: 16,
          height: ITEM_HEIGHT,
          borderRadius: 14,
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
          zIndex: 1,
        }}
      />

      <Animated.ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        bounces={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleMomentumEnd}
        contentContainerStyle={{
          paddingTop: ITEM_HEIGHT * paddingItems,
          paddingBottom: ITEM_HEIGHT * paddingItems,
        }}
      >
        {options.map((option, index) => {
          const inputRange = [
            (index - 2) * ITEM_HEIGHT,
            (index - 1) * ITEM_HEIGHT,
            index * ITEM_HEIGHT,
            (index + 1) * ITEM_HEIGHT,
            (index + 2) * ITEM_HEIGHT,
          ];

          const scale = scrollY.interpolate({
            inputRange,
            outputRange: [0.7, 0.85, 1.15, 0.85, 0.7],
            extrapolate: 'clamp',
          });

          const opacity = scrollY.interpolate({
            inputRange,
            outputRange: [0.25, 0.5, 1, 0.5, 0.25],
            extrapolate: 'clamp',
          });

          const isSelected = option.value === selectedValue;

          return (
            <Animated.View
              key={option.value}
              style={{
                height: ITEM_HEIGHT,
                justifyContent: 'center',
                alignItems: 'center',
                transform: [{ scale }],
                opacity,
              }}
            >
              <TouchableOpacity
                onPress={() => {
                  const targetY = index * ITEM_HEIGHT;
                  scrollRef.current?.scrollTo({ y: targetY, animated: true });
                  setTimeout(() => onSelect(option), 250);
                }}
                activeOpacity={0.7}
                style={{ paddingVertical: 6, paddingHorizontal: 32 }}
              >
                <Text
                  style={{
                    fontSize: 22,
                    fontFamily: isSelected ? FontFamily.bold : FontFamily.regular,
                    fontWeight: isSelected ? '700' : '400',
                    color: isSelected
                      ? (isDark ? '#FFFFFF' : colors.black)
                      : (isDark ? 'rgba(255,255,255,0.5)' : colors.gray400),
                    textAlign: 'center',
                  }}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
};

// ─── Filter Bar ─────────────────────────────────────────────
const FilterBar = ({
  onFilterPress,
  onSettingsPress,
  activeFilters = [],
  filterSelections = {},
  onFilterSelect,
  showSettingsButton = true,
  filters = DEFAULT_FILTERS,
  options = DEFAULT_FILTER_OPTIONS,
  containerStyle,
}) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = getStyles(colors, isDark, insets);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [pendingSelection, setPendingSelection] = useState(null);
  const [dealbreaker, setDealbreaker] = useState({});
  const slideAnim = useRef(new Animated.Value(0)).current;
  const appliedCount = useMemo(() => {
    const selectedCount = Object.values(filterSelections).filter(Boolean).length;
    const activeCount = activeFilters.filter((label) => !filterSelections[label]).length;
    return selectedCount + activeCount;
  }, [activeFilters, filterSelections]);

  const isFilterActive = (filterLabel) => activeFilters.includes(filterLabel);

  const openSheet = (filterLabel) => {
    setPendingSelection(filterSelections[filterLabel] || null);
    setOpenDropdown(filterLabel);
    slideAnim.setValue(0);
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const closeSheet = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setOpenDropdown(null);
      setPendingSelection(null);
    });
  };

  const handlePillPress = (filter) => {
    if (filter.hasChevron) {
      if (openDropdown === filter.label) {
        closeSheet();
      } else {
        openSheet(filter.label);
      }
    } else {
      onFilterPress && onFilterPress(filter.label);
    }
  };

  const handleWheelSelect = (_filterLabel, option) => {
    setPendingSelection(option.value);
  };

  const handleApply = () => {
    if (openDropdown) {
      onFilterSelect && onFilterSelect(openDropdown, pendingSelection);
    }
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setOpenDropdown(null);
      setPendingSelection(null);
    });
  };

  const handleReset = () => {
    if (openDropdown) {
      onFilterSelect && onFilterSelect(openDropdown, null);
    }
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setOpenDropdown(null);
      setPendingSelection(null);
    });
  };

  const getDisplayLabel = (filterLabel) => {
    const selection = filterSelections[filterLabel];
    if (!selection) return filterLabel;
    const optionList = options[filterLabel];
    const match = optionList?.find((o) => o.value === selection);
    return match ? match.label : filterLabel;
  };

  const toggleDealbreaker = (filterLabel) => {
    setDealbreaker((prev) => ({ ...prev, [filterLabel]: !prev[filterLabel] }));
  };

  const sheetTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  const overlayOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, containerStyle]}>
        {showSettingsButton && (
          <TouchableOpacity
            style={styles.filterIconButton}
            onPress={onSettingsPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Filter settings"
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            <Ionicons name="options-outline" size={18} color={isDark ? '#FFFFFF' : colors.black} />
            {appliedCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{appliedCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scrollView}
          contentContainerStyle={styles.pillContainer}
        >
          {filters.map((filter, index) => {
            const hasSelection = !!filterSelections[filter.label];
            const isActive = isFilterActive(filter.label) || hasSelection;
            const isOpen = openDropdown === filter.label;

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.pill,
                  isActive ? styles.pillActive : styles.pillInactive,
                  isOpen && styles.pillOpen,
                ]}
                onPress={() => handlePillPress(filter)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${filter.label}`}
                accessibilityState={{ selected: isActive }}
              >
                {filter.icon && (
                  <Ionicons
                    name={filter.icon}
                    size={14}
                    color={isActive ? '#FFFFFF' : (isDark ? 'rgba(255,255,255,0.85)' : colors.gray600)}
                    style={styles.pillIcon}
                  />
                )}
                <Text
                  style={[
                    styles.pillText,
                    isActive ? styles.pillTextActive : styles.pillTextInactive,
                  ]}
                  numberOfLines={1}
                >
                  {filter.hasChevron ? getDisplayLabel(filter.label) : filter.label}
                </Text>
                {filter.hasChevron && (
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={13}
                    color={isActive ? '#FFFFFF' : (isDark ? 'rgba(255,255,255,0.85)' : colors.gray600)}
                    style={styles.chevron}
                  />
                )}
                {hasSelection && !isOpen && (
                  <View style={styles.selectionDot} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ─── Bottom Sheet Modal ─── */}
      {openDropdown && (
        <Modal
          visible
          transparent
          statusBarTranslucent
          animationType="none"
          onRequestClose={closeSheet}
        >
          {/* Translucent overlay */}
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} />
          </Animated.View>

          {/* Bottom sheet */}
          <Animated.View
            style={[
              styles.sheet,
              { transform: [{ translateY: sheetTranslateY }] },
            ]}
          >
            {/* Drag handle */}
            <View style={styles.handleRow}>
              <View style={styles.handle} />
            </View>

            {/* Title */}
            <Text style={styles.sheetTitle}>{openDropdown}</Text>

            {/* Subtitle */}
            <Text style={styles.sheetSubtitle}>
              Set your preferred range
            </Text>
            {/* Wheel Picker */}
            <View style={styles.pickerWrap}>
              <WheelPicker
                options={options[openDropdown] || []}
                selectedValue={pendingSelection}
                onSelect={(opt) => handleWheelSelect(openDropdown, opt)}
                colors={colors}
                isDark={isDark}
              />
            </View>

            {/* Dealbreaker toggle */}
            <TouchableOpacity
              style={styles.dealbreakerRow}
              onPress={() => toggleDealbreaker(openDropdown)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.checkbox,
                dealbreaker[openDropdown] && styles.checkboxChecked,
              ]}>
                {dealbreaker[openDropdown] && (
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                )}
              </View>
              <View style={styles.dealbreakerTextWrap}>
                <Text style={styles.dealbreakerLabel}>This is a dealbreaker</Text>
                <Text style={styles.dealbreakerDesc}>
                  This will limit who you see and who sees you
                </Text>
              </View>
            </TouchableOpacity>

            {/* Apply / Clear buttons */}
            <View style={styles.sheetActions}>
              {filterSelections[openDropdown] && (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={handleReset}
                  activeOpacity={0.7}
                >
                  <Text style={styles.clearText}>Reset</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.applyBtn, !pendingSelection && styles.applyBtnDisabled]}
                onPress={handleApply}
                activeOpacity={0.8}
                disabled={!pendingSelection}
              >
                <Text style={styles.applyText}>Apply</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom safe area padding */}
            <View style={{ height: insets.bottom }} />
          </Animated.View>
        </Modal>
      )}
    </View>
  );
};

const getStyles = (colors, isDark, insets) => StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
  },
  filterIconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: isDark ? colors.gray300 : colors.surfaceMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  filterBadge: {
    position: 'absolute',
    right: -5,
    top: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.green,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: isDark ? colors.gray100 : '#FFFFFF',
  },
  filterBadgeText: {
    fontSize: 9,
    fontFamily: FontFamily.bold,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 12,
  },
  scrollView: {
    flex: 1,
  },
  pillContainer: {
    alignItems: 'center',
    gap: 10,
    paddingRight: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 34,
  },
  pillActive: {
    backgroundColor: isDark ? colors.gray300 : colors.gray700,
    ...getShadow('md', isDark),
  },
  pillInactive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: isDark ? colors.gray800 : 'rgba(38,38,38,0.14)',
    ...getShadow('sm', isDark),
  },
  pillOpen: {
    borderColor: colors.green,
    borderWidth: 1,
  },
  pillIcon: {
    marginRight: 5,
  },
  pillText: {
    fontSize: 12,
    fontFamily: FontFamily.semibold,
  },
  pillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: FontFamily.bold,
  },
  pillTextInactive: {
    color: isDark ? 'rgba(255,255,255,0.92)' : colors.gray700,
    fontWeight: '600',
  },
  chevron: {
    marginLeft: 4,
  },
  selectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 6,
    backgroundColor: isDark ? '#FFFFFF' : colors.green,
  },

  // ─── Overlay ───
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  // ─── Bottom Sheet ───
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    ...getSurface('modal', colors, isDark),
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 6,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
  },

  // ─── Sheet Content ───
  sheetTitle: {
    ...Typography.h2,
    color: isDark ? '#FFFFFF' : colors.black,
    textAlign: 'center',
    marginTop: 8,
  },
  sheetSubtitle: {
    ...Typography.bodySmall,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  pickerWrap: {
    marginHorizontal: -8,
  },

  // ─── Dealbreaker ───
  dealbreakerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: isDark ? 'rgba(255,255,255,0.2)' : colors.gray300,
    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  checkboxChecked: {
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  dealbreakerTextWrap: {
    flex: 1,
  },
  dealbreakerLabel: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.semibold,
    color: isDark ? 'rgba(255,255,255,0.6)' : colors.gray500,
  },
  dealbreakerDesc: {
    fontSize: 13,
    fontWeight: '400',
    fontFamily: FontFamily.regular,
    color: isDark ? 'rgba(255,255,255,0.35)' : colors.gray400,
    marginTop: 2,
  },

  // ─── Sheet Actions ───
  sheetActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
    marginBottom: 12,
  },
  clearBtn: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: isDark ? 'rgba(255,255,255,0.2)' : colors.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: isDark ? 'rgba(255,255,255,0.7)' : colors.gray600,
    letterSpacing: 0.3,
  },
  applyBtn: {
    flex: 1,
    backgroundColor: colors.green,
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...getShadow('md', isDark),
  },
  applyBtnDisabled: {
    opacity: 0.4,
  },
  applyText: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: FontFamily.bold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});

export default React.memo(FilterBar);
