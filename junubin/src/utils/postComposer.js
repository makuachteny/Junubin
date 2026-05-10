// Polls and tags removed for v1 — no voting UI / no profile-linking yet.
export function buildPostContent({ content = '', location = '' }) {
  const blocks = [];
  const trimmedContent = content.trim();
  if (trimmedContent) blocks.push(trimmedContent);

  const trimmedLocation = location.trim();
  if (trimmedLocation) blocks.push(`📍 ${trimmedLocation}`);

  return blocks.join('\n\n');
}

