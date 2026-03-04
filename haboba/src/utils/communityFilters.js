const parseHoursAgo = (timestamp) => {
  if (!timestamp || typeof timestamp !== 'string') return 999;
  const match = timestamp.match(/(\d+)\s*h/i);
  if (!match) return 999;
  return Number(match[1]) || 999;
};

export const matchesCommunityFilter = (item, filterId) => {
  switch (filterId) {
    case 'trending':
      return (item.likes || 0) + (item.comments || 0) >= 55;
    case 'popular':
      return (item.likes || 0) >= 40 || (item.members || 0) >= 1200 || (item.attendees || 0) >= 120;
    case 'nearby':
      return String(item.user?.location || item.location || '').toLowerCase().includes('dc');
    case 'new':
      return parseHoursAgo(item.timestamp) <= 5 || String(item.id || '').endsWith('7');
    case 'friends':
      return ['post1', 'post3', 'g1', 'g2', 'g3'].includes(item.id);
    default:
      return true;
  }
};

export const applyCommunityFilters = (items, activeFilters) => {
  if (!activeFilters.length) return items;
  return items.filter((item) => activeFilters.some((filterId) => matchesCommunityFilter(item, filterId)));
};
