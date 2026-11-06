const OPACITY_LIGHT = { sm: 0.08, md: 0.12, lg: 0.18, xl: 0.24 };
const OPACITY_DARK = { sm: 0.3, md: 0.38, lg: 0.45, xl: 0.52 };
const RADIUS_MAP = { sm: 4, md: 8, lg: 14, xl: 22 };
const HEIGHT_MAP = { sm: 2, md: 4, lg: 8, xl: 12 };
const ELEVATION_MAP = { sm: 2, md: 4, lg: 8, xl: 12 };

export const getShadow = (level = 'sm', isDark = false, color) => {
  const defaultColor = isDark ? '#000000' : '#262626';
  const shadowColor = color || defaultColor;
  const opacityMap = isDark ? OPACITY_DARK : OPACITY_LIGHT;

  return {
    shadowColor,
    shadowOffset: { width: 0, height: HEIGHT_MAP[level] || HEIGHT_MAP.md },
    shadowOpacity: opacityMap[level] || opacityMap.md,
    shadowRadius: RADIUS_MAP[level] || RADIUS_MAP.md,
    elevation: ELEVATION_MAP[level] || ELEVATION_MAP.md,
  };
};
