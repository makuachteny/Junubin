export const getShadow = (level = 'sm', isDark = false, color = '#000000') => {
  const opacityMap = isDark
    ? { sm: 0.3, md: 0.38, lg: 0.45, xl: 0.52 }
    : { sm: 0.08, md: 0.12, lg: 0.18, xl: 0.24 };

  const radiusMap = { sm: 4, md: 8, lg: 14, xl: 22 };
  const heightMap = { sm: 2, md: 4, lg: 8, xl: 12 };
  const elevationMap = { sm: 2, md: 4, lg: 8, xl: 12 };

  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: heightMap[level] || heightMap.md },
    shadowOpacity: opacityMap[level] || opacityMap.md,
    shadowRadius: radiusMap[level] || radiusMap.md,
    elevation: elevationMap[level] || elevationMap.md,
  };
};
