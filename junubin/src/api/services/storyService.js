// Story service — talks to the `Story` table + `stories` storage
// bucket added in migration 00017. Stories are 24h-ephemeral; the
// expiresAt column auto-defaults to NOW() + 24h, and listActiveStoryGroups
// filters out expired rows at query time. (A pg_cron job can later
// physically delete expired rows; until then they stay in the table.)

import { supabase } from '../../config/supabase';

const ACTIVE_WINDOW_HOURS = 24;
const DEFAULT_DURATION_MS = 5000;

function makeId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function resolveAppUser() {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;
  const { data: appUser } = await supabase
    .from('User')
    .select('id, displayName, photos:Photo(url)')
    .eq('auth_id', authUser.id)
    .maybeSingle();
  return appUser || null;
}

/**
 * Upload a local image URI to the `stories` storage bucket and return
 * { url, path }. Returns null if no image given.
 */
async function uploadStoryImage(imageUri, userId) {
  if (!imageUri || !userId) return null;
  if (imageUri.startsWith('http')) {
    return { url: imageUri, path: null };
  }
  const ext = (imageUri.split('.').pop() || 'jpg').replace(/[?#].*/, '');
  const path = `${userId}/${Date.now()}.${ext}`;
  const fileResponse = await fetch(imageUri);
  const fileBlob = await fileResponse.blob();
  const { error } = await supabase.storage
    .from('stories')
    .upload(path, fileBlob, { contentType: `image/${ext}`, upsert: false });
  if (error) throw error;
  const { data: pub } = supabase.storage.from('stories').getPublicUrl(path);
  return { url: pub.publicUrl, path };
}

/**
 * Upload a local video URI to the `stories` storage bucket and return
 * { url, path }. Mirrors uploadStoryImage but writes with a video MIME
 * type so downstream playback (expo-av Video) gets the right hint.
 */
async function uploadStoryVideo(videoUri, userId) {
  if (!videoUri || !userId) return null;
  if (videoUri.startsWith('http')) {
    return { url: videoUri, path: null };
  }
  const ext = (videoUri.split('.').pop() || 'mp4').replace(/[?#].*/, '');
  const path = `${userId}/${Date.now()}.${ext}`;
  const fileResponse = await fetch(videoUri);
  const fileBlob = await fileResponse.blob();
  const { error } = await supabase.storage
    .from('stories')
    .upload(path, fileBlob, { contentType: 'video/mp4', upsert: false });
  if (error) throw error;
  const { data: pub } = supabase.storage.from('stories').getPublicUrl(path);
  return { url: pub.publicUrl, path };
}

/**
 * Create a new story. Returns the inserted Story row in the shape the
 * StoriesViewScreen consumes (single-story group).
 *
 * `mode` is the legacy CreateStoryScreen vocabulary ('text' | 'photo').
 * Internally maps to mediaType 'text' / 'image' / 'video' — the latter
 * triggered when `videoUri` is provided (takes precedence over photoUri).
 */
export async function createStory({ mode, text, photoUri, videoUri, bgColor }) {
  const me = await resolveAppUser();
  if (!me) throw new Error('Not authenticated');

  const isMedia = mode === 'photo';
  const isVideo = isMedia && !!videoUri;
  const isPhoto = isMedia && !isVideo;
  if (!isMedia && !text?.trim()) throw new Error('text required for text stories');
  if (isMedia && !videoUri && !photoUri) throw new Error('photoUri or videoUri required for media stories');

  let uploaded = null;
  if (isVideo) {
    uploaded = await uploadStoryVideo(videoUri, me.id);
  } else if (isPhoto) {
    uploaded = await uploadStoryImage(photoUri, me.id);
  }

  const id = makeId();
  const row = {
    id,
    userId: me.id,
    mediaType: isVideo ? 'video' : (isPhoto ? 'image' : 'text'),
    mediaUrl: uploaded?.url || null,
    mediaPath: uploaded?.path || null,
    content: isMedia ? null : text.trim(),
    bgColor: !isMedia ? (bgColor || null) : null,
  };

  const { data, error } = await supabase
    .from('Story')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;

  return normalizeStory(data, me);
}

/**
 * List all active stories (non-expired) across all users, grouped by
 * author. Returns the shape StoriesViewScreen expects:
 *   [{ id, userId, userName, avatar, stories: [...] }, ...]
 *
 * Cutoff is computed client-side instead of relying solely on the
 * column default so a clock skew on either side doesn't produce a
 * surprise empty list.
 */
export async function listActiveStoryGroups() {
  const cutoff = new Date(Date.now() - ACTIVE_WINDOW_HOURS * 3600 * 1000).toISOString();

  const { data, error } = await supabase
    .from('Story')
    .select(`
      id, userId, mediaType, mediaUrl, content, bgColor, createdAt, expiresAt,
      author:User!userId(id, displayName, photos:Photo(url))
    `)
    .gt('expiresAt', new Date().toISOString())
    .gt('createdAt', cutoff)
    .order('createdAt', { ascending: false })
    .limit(200);
  if (error) throw error;

  // Group by author
  const groups = new Map();
  for (const row of data || []) {
    const author = row.author || {};
    const key = row.userId;
    if (!groups.has(key)) {
      groups.set(key, {
        id: `g-${key}`,
        userId: key,
        userName: author.displayName || 'Junubin',
        avatar: author.photos?.[0]?.url || null,
        stories: [],
      });
    }
    groups.get(key).stories.push(rowToStoryItem(row));
  }
  // Each user's stories oldest-first inside the group (so the viewer
  // plays them in the order they were posted), but groups themselves
  // ordered by most-recent-story to surface fresh content first.
  const out = Array.from(groups.values());
  for (const g of out) g.stories.reverse();
  return out;
}

/**
 * Delete one of your own stories. RLS enforces ownership; storage
 * cleanup is best-effort.
 */
export async function deleteStory(storyId) {
  const { data: existing } = await supabase
    .from('Story')
    .select('mediaPath')
    .eq('id', storyId)
    .maybeSingle();

  const { error } = await supabase
    .from('Story')
    .delete()
    .eq('id', storyId);
  if (error) throw error;

  if (existing?.mediaPath) {
    try { await supabase.storage.from('stories').remove([existing.mediaPath]); } catch {}
  }
  return { ok: true };
}

function normalizeStory(row, author = {}) {
  return {
    id: `g-${row.userId}`,
    userId: row.userId,
    userName: author.displayName || 'Junubin',
    avatar: author.photos?.[0]?.url || null,
    stories: [rowToStoryItem(row)],
  };
}

function rowToStoryItem(row) {
  return {
    id: row.id,
    type: row.mediaType === 'image' ? 'image' : (row.mediaType === 'video' ? 'video' : 'text'),
    uri: row.mediaUrl || null,
    text: row.mediaType === 'text' ? row.content : null,
    bgColor: row.bgColor || null,
    duration: DEFAULT_DURATION_MS,
    createdAt: new Date(row.createdAt).getTime(),
  };
}
