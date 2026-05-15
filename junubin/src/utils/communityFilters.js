// JuNubin — Community filter predicates
//
// Each filter id maps to a predicate that runs against a feed item (post,
// group, or event). Predicates are designed to work on real backend data;
// where mock data is structured differently we accept richer shapes (e.g.
// timestamp strings like "1h ago" alongside ISO `createdAt`).

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const parseHoursAgo = (timestamp) => {
  if (!timestamp || typeof timestamp !== 'string') return Number.POSITIVE_INFINITY;
  const m = timestamp.match(/(\d+)\s*([smhd])/i);
  if (!m) return Number.POSITIVE_INFINITY;
  const value = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (Number.isNaN(value)) return Number.POSITIVE_INFINITY;
  switch (unit) {
    case 's': return value / 3600;
    case 'm': return value / 60;
    case 'h': return value;
    case 'd': return value * 24;
    default: return Number.POSITIVE_INFINITY;
  }
};

const ageOfItemHours = (item) => {
  if (item?.createdAt) {
    const ms = Date.now() - new Date(item.createdAt).getTime();
    if (Number.isFinite(ms) && ms >= 0) return ms / HOUR_MS;
  }
  return parseHoursAgo(item?.timestamp);
};

const itemIsLocal = (item, viewerLocation) => {
  const target = (viewerLocation || '').trim().toLowerCase();
  if (!target) return true; // Without a viewer location anchor, treat all as local.
  const candidate = String(item?.user?.location || item?.location || '').toLowerCase();
  if (!candidate) return false;
  // Match on city/region tokens — split on commas/spaces.
  const targetTokens = target.split(/[,\s]+/).filter(Boolean);
  return targetTokens.some((tok) => tok.length >= 2 && candidate.includes(tok));
};

export const matchesCommunityFilter = (item, filterId, ctx = {}) => {
  switch (filterId) {
    case 'trending': {
      // Combined engagement signal — recent + popular.
      const engagement = (item.likes || 0) + (item.comments || 0) * 2 + (item.reposts || 0) * 3;
      const hoursOld = ageOfItemHours(item);
      // Hot if it has >= 30 weighted engagement points and is < 24h old, OR
      // an absolute floor of 80 engagement regardless of age.
      return (engagement >= 30 && hoursOld <= 24) || engagement >= 80;
    }
    case 'popular':
      return (item.likes || 0) >= 40 || (item.members || 0) >= 1200 || (item.attendees || 0) >= 120;
    case 'nearby':
      return itemIsLocal(item, ctx.viewerLocation);
    case 'new':
      return ageOfItemHours(item) <= 6;
    case 'friends': {
      // True for items whose author is in the viewer's follow set OR who is
      // marked as a friend on the item itself (e.g. mockMatches inject this).
      const followingIds = ctx.followingIds instanceof Set ? ctx.followingIds : null;
      const authorId = item?.user?.id || item?.authorId;
      if (followingIds && authorId && followingIds.has(authorId)) return true;
      return item?.user?.isFriend === true || item?.fromFriend === true;
    }
    case 'verified':
      // Author is a verified user. Reads both shapes since mockPosts use
      // `user.verified` and the normalized post payload uses
      // `user.verified` set from `author.isVerified`.
      return item?.user?.verified === true || item?.user?.isVerified === true;
    case 'photos':
      // Posts with an image attached. `image` is set in normalizePost
      // when mediaType === 'image'; mocks use the same field name.
      return !!item?.image;
    case 'videos':
      return !!item?.video;
    case 'thisWeek':
      return ageOfItemHours(item) <= 24 * 7;
    case 'questions': {
      // Posts that ask the community something. Trim then check the
      // last meaningful character so trailing emoji / whitespace don't
      // hide a genuine question.
      const text = typeof item?.content === 'string' ? item.content.trim() : '';
      if (!text) return false;
      // Strip trailing emoji / non-letter runes so "What's up? 🎉" still counts.
      const stripped = text.replace(/[\s\p{Extended_Pictographic}]+$/u, '');
      return stripped.endsWith('?');
    }
    case 'links':
      // Posts that carry a signup CTA — typically community
      // announcements, meetups, fundraisers. Useful as a "what's
      // actionable right now" filter.
      return !!item?.signupLink;
    default:
      return true;
  }
};

/**
 * Apply active filters with OR semantics — an item passes if it matches any
 * of the active filters. `ctx` carries viewer-state needed by some filters
 * (own location, set of followed userIds).
 */
export const applyCommunityFilters = (items, activeFilters, ctx = {}) => {
  if (!activeFilters?.length) return items;
  return items.filter((item) => activeFilters.some((id) => matchesCommunityFilter(item, id, ctx)));
};
