export function buildPostContent({ content = '', location = '', tags = [], pollQuestion = '', pollOptions = [] }) {
  const blocks = [];
  const trimmedContent = content.trim();
  if (trimmedContent) blocks.push(trimmedContent);

  const trimmedLocation = location.trim();
  if (trimmedLocation) blocks.push(`📍 ${trimmedLocation}`);

  const cleanTags = tags.map((t) => t.trim()).filter(Boolean);
  if (cleanTags.length) {
    blocks.push(`👥 with ${cleanTags.map((name) => `@${name.replace(/^@+/, '')}`).join(', ')}`);
  }

  const question = pollQuestion.trim();
  const options = pollOptions.map((o) => o.trim()).filter(Boolean);
  if (question && options.length >= 2) {
    blocks.push(`📊 Poll: ${question}\n• ${options.join('\n• ')}`);
  }

  return blocks.join('\n\n');
}

