// Community feed posts — server-backed.
//
// Replaces the navigation-params-only flow that used to pass posts
// from CreatePostScreen to CommunityScreen via route state. Posts now
// persist to the `Post` table; the Community feed pulls from there
// and stays fresh via a Realtime postgres-changes subscription.

import { supabase } from '../../config/supabase';
import { formatTimestamp } from '../../utils/formatTime';

const PAGE_SIZE = 30;

function makeId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Detect media type from a local URI's extension. Falls back to
 * 'image' so posts without a clear extension still render via the
 * <Image> path rather than mounting a Video player on a still.
 */
function detectMediaType(uri) {
  if (!uri) return null;
  const m = uri.toLowerCase().match(/\.([a-z0-9]+)(?:[?#].*)?$/);
  const ext = m ? m[1] : '';
  if (['mp4', 'mov', 'm4v', 'webm', 'avi', '3gp'].includes(ext)) return 'video';
  return 'image';
}

const MIME_BY_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic',
  heif: 'image/heif', webp: 'image/webp', gif: 'image/gif',
  mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v',
  webm: 'video/webm', avi: 'video/x-msvideo', '3gp': 'video/3gpp',
};

/**
 * Upload a local media URI (image OR video) to the `posts` Storage
 * bucket and return { url, path, mediaType }. Returns null if no
 * media. Caller passes the uri + optional explicit mediaType (saves a
 * re-detect when CreatePostScreen has already inspected the picker
 * asset). The bucket is the same for both types — videos and images
 * share the per-user path prefix policies set up in 00012.
 */
async function uploadMediaIfPresent(uri, userId, mediaType) {
  if (!uri || !userId) return null;
  const type = mediaType || detectMediaType(uri);
  if (uri.startsWith('http')) {
    // Already a remote URL (re-edit or share-from-link case) — pass through.
    return { url: uri, path: null, mediaType: type };
  }
  const m = uri.split('?')[0].split('#')[0].split('.');
  const ext = (m[m.length - 1] || (type === 'video' ? 'mp4' : 'jpg')).toLowerCase();
  const path = `${userId}/${Date.now()}.${ext}`;
  const contentType = MIME_BY_EXT[ext] || (type === 'video' ? 'video/mp4' : `image/${ext}`);
  const fileResponse = await fetch(uri);
  const fileBlob = await fileResponse.blob();
  const { error } = await supabase.storage
    .from('posts')
    .upload(path, fileBlob, { contentType, upsert: false });
  if (error) throw error;
  const { data: pub } = supabase.storage.from('posts').getPublicUrl(path);
  return { url: pub.publicUrl, path, mediaType: type };
}

/**
 * Create a post. Uploads the image first (if local), then writes the
 * Post row. Returns the post with the API-ready shape used by PostCard.
 */
export async function createPost({
  content,
  imageUri,        // legacy single-image alias — still accepted
  mediaUri,        // new: photo OR video URI
  mediaType,       // new: 'image' | 'video' (optional, detected from extension if omitted)
  aspectRatio,     // new: width/height ratio measured at picker time
  location,
  tags,
  cardTheme,
  signupLink,
  signupTitle,
}) {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error('Not authenticated');

  const { data: appUser } = await supabase
    .from('User')
    .select('id, displayName, photos:Photo(url)')
    .eq('auth_id', authUser.id)
    .single();
  if (!appUser) throw new Error('User not found');

  // Accept the legacy `imageUri` arg for back-compat; new callers
  // should pass `mediaUri` + `mediaType`.
  const sourceUri = mediaUri || imageUri;
  const uploaded = await uploadMediaIfPresent(sourceUri, appUser.id, mediaType);

  const id = makeId();
  const row = {
    id,
    userId: appUser.id,
    content: content || null,
    imageUrl: uploaded?.url || null,
    imagePath: uploaded?.path || null,
    mediaType: uploaded?.mediaType || null,
    aspectRatio: aspectRatio && Number.isFinite(aspectRatio) ? aspectRatio : null,
    location: location || null,
    tags: tags || [],
    cardTheme: cardTheme || 'default',
    signupLink: signupLink || null,
    signupTitle: signupTitle || null,
  };

  const { data, error } = await supabase
    .from('Post')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;

  // Image moderation — runs async after the row exists so the post
  // creation doesn't block on a third-party scan. The Edge Function
  // updates Post.moderationStatus when it gets a verdict; until then
  // the row stays at its default 'pending' and is filtered out of the
  // public feed by listPosts. The author always sees their own post
  // because the listPosts query OR-includes their own userId.
  if (uploaded?.url) {
    supabase.functions
      .invoke('moderate-image', {
        method: 'POST',
        body: { imageUrl: uploaded.url, postId: data.id, kind: 'post' },
      })
      .catch(() => {});
  } else {
    // Text-only post: nothing to moderate visually. Auto-approve so
    // listPosts surfaces it. Text moderation is a separate concern
    // (out of scope for the image pipeline).
    supabase
      .from('Post')
      .update({ moderationStatus: 'approved' })
      .eq('id', data.id)
      .then(() => {}, () => {});
  }

  return normalizePost(data, appUser);
}

/**
 * List recent posts — paginated. The default returns the latest
 * PAGE_SIZE posts; pass `cursor` (the oldest id from the previous
 * page) for the next page.
 *
 * Filters out anything still in moderation (status != 'approved'),
 * EXCEPT the caller's own posts — the author should see their own
 * pending content immediately so the feed feels responsive even when
 * moderation is slow. The `userId` filter is computed from auth.uid
 * via the User table.
 */
export async function listPosts({ cursor } = {}) {
  // Resolve the caller's app user id so we can scope an "or-mine"
  // filter. If unauthenticated, we just show approved content.
  let myId = null;
  try {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data: appUser } = await supabase
        .from('User')
        .select('id')
        .eq('auth_id', authUser.id)
        .maybeSingle();
      myId = appUser?.id || null;
    }
  } catch {
    // Best-effort; fall through to public-feed view.
  }

  let query = supabase
    .from('Post')
    .select(`
      id, userId, content, imageUrl, mediaType, aspectRatio,
      location, tags, cardTheme, signupLink, signupTitle,
      likeCount, commentCount, repostCount, waveCount, createdAt, moderationStatus,
      quotedPostId,
      author:User!userId(id, displayName, isVerified, city, photos:Photo(url)),
      quoted:Post!quotedPostId(
        id, userId, content, imageUrl, mediaType, aspectRatio, createdAt,
        author:User!userId(id, displayName, isVerified, city, photos:Photo(url))
      )
    `)
    .order('createdAt', { ascending: false })
    .limit(PAGE_SIZE);

  if (myId) {
    // approved OR mine — viewer sees their own pending posts
    query = query.or(`moderationStatus.eq.approved,userId.eq.${myId}`);
  } else {
    query = query.eq('moderationStatus', 'approved');
  }

  if (cursor) {
    query = query.lt('createdAt', cursor);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((row) => normalizePost(row, row.author, row.quoted));
}

/**
 * Update the text body of a post you authored. Text-only by design —
 * media swaps would invalidate the moderation check, and the
 * signupLink/title belong to the original publishing intent. The
 * Post UPDATE RLS in 00012 already gates this to the author.
 *
 * Returns the freshly-normalized post so the caller can patch its
 * in-memory copy without waiting on the realtime UPDATE echo.
 */
export async function updatePostContent(postId, nextContent) {
  const trimmed = (nextContent ?? '').trim();
  // Empty edits would wipe the caption silently; force callers to
  // delete the post instead if that's what they want.
  if (!trimmed) throw new Error('Post text cannot be empty');
  const { data, error } = await supabase
    .from('Post')
    .update({ content: trimmed, updatedAt: new Date().toISOString() })
    .eq('id', postId)
    .select(`
      id, userId, content, imageUrl, mediaType, aspectRatio,
      location, tags, cardTheme, signupLink, signupTitle,
      likeCount, commentCount, repostCount, waveCount, createdAt, moderationStatus,
      author:User!userId(id, displayName, isVerified, city, photos:Photo(url))
    `)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Post not found');
  return normalizePost(data, data.author);
}

/**
 * Delete one of your own posts. Storage cleanup runs best-effort
 * after the row is gone — we don't fail the call on storage error.
 */
export async function deletePost(postId) {
  const { data: post } = await supabase
    .from('Post')
    .select('imagePath')
    .eq('id', postId)
    .maybeSingle();

  const { error } = await supabase
    .from('Post')
    .delete()
    .eq('id', postId);
  if (error) throw error;

  if (post?.imagePath) {
    try { await supabase.storage.from('posts').remove([post.imagePath]); } catch {}
  }
  return { ok: true };
}

/**
 * Resolve the caller's app User.id from their auth session. Returns
 * null if unauthenticated (so callers can decide whether to throw or
 * silently no-op). Used by the like/repost helpers below.
 */
async function resolveAppUserId() {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;
  const { data: appUser } = await supabase
    .from('User')
    .select('id')
    .eq('auth_id', authUser.id)
    .maybeSingle();
  return appUser?.id || null;
}

/**
 * Toggle a like on a post. Inserts or deletes a `PostLike` row; the
 * 00017 trigger keeps Post.likeCount in sync. Returns { liked } so the
 * caller can confirm the new state when it differs from optimistic UI.
 *
 * Idempotent on the unique (postId, userId) constraint — a duplicate
 * INSERT is treated as "already liked" and the function returns the
 * current state without raising.
 */
export async function toggleLike(postId) {
  const userId = await resolveAppUserId();
  if (!userId) throw new Error('Not authenticated');

  // Read current state — cheaper than relying on insert-conflict
  // because we want to know which branch (insert vs. delete) to take.
  const { data: existing } = await supabase
    .from('PostLike')
    .select('id')
    .eq('postId', postId)
    .eq('userId', userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('PostLike')
      .delete()
      .eq('id', existing.id);
    if (error) throw error;
    return { liked: false };
  }

  const { error } = await supabase
    .from('PostLike')
    .insert({ id: makeId(), postId, userId });
  // Race: another tap landed first. Treat as already liked.
  if (error && error.code !== '23505') throw error;
  return { liked: true };
}

/**
 * Whether the caller has liked a set of posts. Returns a Set of postIds
 * the caller has liked — empty set if unauthenticated. Caller passes a
 * batch (e.g. the visible feed page) to avoid N round-trips.
 */
export async function getLikedPostIds(postIds) {
  if (!postIds || postIds.length === 0) return new Set();
  const userId = await resolveAppUserId();
  if (!userId) return new Set();

  const { data, error } = await supabase
    .from('PostLike')
    .select('postId')
    .eq('userId', userId)
    .in('postId', postIds);
  if (error) throw error;
  return new Set((data || []).map((r) => r.postId));
}

/**
 * Toggle a repost. Same shape as toggleLike — inserts or deletes a
 * `PostRepost` row; 00017 trigger keeps Post.repostCount in sync.
 */
export async function toggleRepost(postId) {
  const userId = await resolveAppUserId();
  if (!userId) throw new Error('Not authenticated');

  const { data: existing } = await supabase
    .from('PostRepost')
    .select('id')
    .eq('postId', postId)
    .eq('userId', userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('PostRepost')
      .delete()
      .eq('id', existing.id);
    if (error) throw error;
    return { reposted: false };
  }

  const { error } = await supabase
    .from('PostRepost')
    .insert({ id: makeId(), postId, userId });
  if (error && error.code !== '23505') throw error;
  return { reposted: true };
}

/**
 * Quote-repost: creates a NEW Post that embeds the original (via
 * Post.quotedPostId, added in 00036) and ALSO writes the silent
 * PostRepost row so the original author's repostCount + the existing
 * 00017 trigger fire as if it were a plain repost. Comment is
 * optional — an empty string makes this behave like a "share to my
 * feed" without commentary, but the new Post is still created so
 * the repostor's followers see something in their timeline (vs the
 * plain PostRepost row which is invisible).
 *
 * Returns the new Post row (normalized) so the caller can prepend
 * it to the feed immediately.
 */
export async function createQuoteRepost({ originalPostId, comment = '' }) {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error('Not authenticated');

  const { data: appUser } = await supabase
    .from('User')
    .select('id, displayName, photos:Photo(url)')
    .eq('auth_id', authUser.id)
    .single();
  if (!appUser) throw new Error('User not found');

  // 1. New Post row that quotes the original. moderationStatus defaults
  //    to 'pending' for media posts, but a quote with no new media is
  //    just text — auto-approve so it surfaces in feeds immediately.
  const id = makeId();
  const trimmedComment = (comment || '').trim() || null;
  const { data: created, error: insertErr } = await supabase
    .from('Post')
    .insert({
      id,
      userId: appUser.id,
      content: trimmedComment,
      quotedPostId: originalPostId,
      cardTheme: 'default',
      moderationStatus: 'approved',
    })
    .select(`
      id, userId, content, imageUrl, mediaType, aspectRatio,
      location, tags, cardTheme, signupLink, signupTitle,
      likeCount, commentCount, repostCount, waveCount, createdAt, moderationStatus,
      quotedPostId
    `)
    .single();
  if (insertErr) throw insertErr;

  // 2. Silent PostRepost row so the original's repostCount bumps
  //    and the existing trigger pushes the original's author. We
  //    swallow the 23505 unique-constraint error: a user can only
  //    have one PostRepost row per original, so re-quoting bumps
  //    nothing but the new Post still lands in the feed.
  const { error: repostErr } = await supabase
    .from('PostRepost')
    .insert({ id: makeId(), postId: originalPostId, userId: appUser.id });
  if (repostErr && repostErr.code !== '23505') {
    // The new Post is committed regardless — log but don't unwind.
    if (__DEV__) console.warn('[createQuoteRepost] repost-row insert failed:', repostErr.message);
  }

  return normalizePost(created, appUser);
}

/**
 * Toggle a wave. Same shape as toggleLike / toggleRepost — inserts
 * or deletes a `PostWave` row; the 00034 trigger keeps Post.waveCount
 * in sync. Waves are a public "I see you / I support this" gesture;
 * count is durable across sessions.
 */
export async function toggleWave(postId) {
  const userId = await resolveAppUserId();
  if (!userId) throw new Error('Not authenticated');

  const { data: existing } = await supabase
    .from('PostWave')
    .select('id')
    .eq('postId', postId)
    .eq('userId', userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('PostWave')
      .delete()
      .eq('id', existing.id);
    if (error) throw error;
    return { waved: false };
  }

  const { error } = await supabase
    .from('PostWave')
    .insert({ id: makeId(), postId, userId });
  if (error && error.code !== '23505') throw error;
  return { waved: true };
}

export async function getWavedPostIds(postIds) {
  if (!postIds || postIds.length === 0) return new Set();
  const userId = await resolveAppUserId();
  if (!userId) return new Set();

  const { data, error } = await supabase
    .from('PostWave')
    .select('postId')
    .eq('userId', userId)
    .in('postId', postIds);
  if (error) throw error;
  return new Set((data || []).map((r) => r.postId));
}

export async function getRepostedPostIds(postIds) {
  if (!postIds || postIds.length === 0) return new Set();
  const userId = await resolveAppUserId();
  if (!userId) return new Set();

  const { data, error } = await supabase
    .from('PostRepost')
    .select('postId')
    .eq('userId', userId)
    .in('postId', postIds);
  if (error) throw error;
  return new Set((data || []).map((r) => r.postId));
}

/**
 * Reshape a raw `Post` row into the object PostCard expects.
 * Keeps a single transformation point so backend column names can
 * evolve without touching dozens of UI sites. `quotedRaw` (when
 * supplied) is the joined original-post row for a quote-repost; we
 * normalize it shallowly (no further quoted nesting — one level deep
 * is plenty visually and prevents an unbounded join chain).
 */
function normalizePost(raw, author = {}, quotedRaw = null) {
  const avatar = author?.photos?.[0]?.url || author?.avatar || null;
  // mediaType is null on legacy posts that pre-date 00018 — fall back
  // to 'image' if there's a URL, since those rows could only ever
  // have held images.
  const mediaType = raw.mediaType || (raw.imageUrl ? 'image' : null);

  let quoted = null;
  if (quotedRaw && quotedRaw.id) {
    const qAuthor = quotedRaw.author || {};
    const qAvatar = qAuthor?.photos?.[0]?.url || null;
    const qMediaType = quotedRaw.mediaType || (quotedRaw.imageUrl ? 'image' : null);
    quoted = {
      id: quotedRaw.id,
      user: {
        id: quotedRaw.userId,
        name: qAuthor?.displayName || 'Junubin',
        avatar: qAvatar,
        verified: !!qAuthor?.isVerified,
      },
      content: quotedRaw.content || '',
      image: qMediaType === 'image' ? (quotedRaw.imageUrl || null) : null,
      video: qMediaType === 'video' ? (quotedRaw.imageUrl || null) : null,
      mediaType: qMediaType,
      aspectRatio: quotedRaw.aspectRatio || null,
      timestamp: formatTimestamp(quotedRaw.createdAt),
    };
  }

  return {
    id: raw.id,
    user: {
      id: raw.userId,
      name: author?.displayName || 'Junubin',
      avatar,
      verified: !!author?.isVerified,
      location: raw.location || author?.city || '',
    },
    // Computed from createdAt so freshly-fetched posts render with the
    // right relative time (Instagram-style: "now" → "Xm" → "Xh" →
    // "Xd" → "Mar 15"). The list isn't subscribed to a 1s tick, so
    // counters drift slightly until the next refetch / realtime
    // update — fine for posts where seconds-precision doesn't matter.
    timestamp: formatTimestamp(raw.createdAt),
    content: raw.content || '',
    image: mediaType === 'image' ? (raw.imageUrl || null) : null,
    video: mediaType === 'video' ? (raw.imageUrl || null) : null,
    mediaType,
    aspectRatio: raw.aspectRatio || null,
    likes: raw.likeCount || 0,
    comments: raw.commentCount || 0,
    reposts: raw.repostCount || 0,
    waves: raw.waveCount || 0,
    cardTheme: raw.cardTheme || 'default',
    signupLink: raw.signupLink,
    signupTitle: raw.signupTitle,
    createdAt: raw.createdAt,
    quotedPostId: raw.quotedPostId || null,
    quoted,
  };
}
