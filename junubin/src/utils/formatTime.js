const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Converts a date string into an Instagram-style relative timestamp.
 *
 * - < 1 minute:  "now"
 * - < 1 hour:    "5m ago"
 * - < 24 hours:  "3h ago"
 * - < 7 days:    "2d ago"
 * - same year:   "Mar 15"        (after a week, switches to the
 *                                  actual date instead of weeks/months
 *                                  which lose precision)
 * - prior year:  "Mar 15, 2024"
 *
 * Returns '' for falsy input so call sites can safely render directly.
 */
export function formatTimestamp(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;

  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;

  // After a week, switch to the calendar date. Instagram does the same
  // because "37d" / "2w" loses the precision a reader actually wants
  // for older content. Year is dropped when it's the current calendar
  // year — same as Instagram / iOS Mail.
  const month = MONTHS[date.getMonth()];
  const day = date.getDate();
  if (date.getFullYear() === now.getFullYear()) {
    return `${month} ${day}`;
  }
  return `${month} ${day}, ${date.getFullYear()}`;
}
