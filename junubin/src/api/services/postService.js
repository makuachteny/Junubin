// Community feed posts — server-backed.
//
// Replaces the navigation-params-only flow that used to pass posts
// from CreatePostScreen to CommunityScreen via route state. Posts now
// persist to the `Post` table; the Community feed pulls from there
// and stays fresh via a Realtime postgres-changes subscription.

import { supabase } from '../../config/supabase';

const PAGE_SIZE = 30;

function makeId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Upload a local image URI to the `posts` Storage bucket and return
 * { url, path }. Returns null if no image.
 */
async function uploadImageIfPresent(imageUri, userId) {
  if (!imageUri || !userId) return null;
  if (imageUri.startsWith('http')) {
    // Already a remote URL (re-edit or share-from-link case) — pass through.
    return { url: imageUri, path: null };
  }
  const ext = (imageUri.split('.').pop() || 'jpg').replace(/[?#].*/, '');
  const path = `${userId}/${Date.now()}.${ext}`;
  const fileResponse = await fetch(imageUri);
  const fileBlob = await fileResponse.blob();
  const { error } = await supabase.storage
    .from('posts')
    .upload(path, fileBlob, { contentType: `image/${ext}`, upsert: false });
  if (error) throw error;
  const { data: pub } = supabase.storage.from('posts').getPublicUrl(path);
  return { url: pub.publicUrl, path };
}

/**
 * Create a post. Uploads the image first (if local), then writes the
 * Post row. Returns the post with the API-ready shape used by PostCard.
 */
export async function createPost({
  content,
  imageUri,
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

  const uploaded = await uploadImageIfPresent(imageUri, appUser.id);

  const id = makeId();
  const row = {
    id,
    userId: appUser.id,
    content: content || null,
    imageUrl: uploaded?.url || null,
    imagePath: uploaded?.path || null,
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
      .then(() => {});
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
      id, userId, content, imageUrl, location, tags, cardTheme,
      signupLink, signupTitle, likeCount, commentCount, repostCount,
      createdAt, moderationStatus,
      author:User!userId(id, displayName, isVerified, city, photos:Photo(url))
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
  return (data || []).map((row) => normalizePost(row, row.author));
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
 * Reshape a raw `Post` row into the object PostCard expects.
 * Keeps a single transformation point so backend column names can
 * evolve without touching dozens of UI sites.
 */
function normalizePost(raw, author = {}) {
  const avatar = author?.photos?.[0]?.url || author?.avatar || null;
  return {
    id: raw.id,
    user: {
      id: raw.userId,
      name: author?.displayName || 'Junubin',
      avatar,
      verified: !!author?.isVerified,
      location: raw.location || author?.city || '',
    },
    timestamp: 'Just now',
    content: raw.content || '',
    image: raw.imageUrl || null,
    likes: raw.likeCount || 0,
    comments: raw.commentCount || 0,
    reposts: raw.repostCount || 0,
    cardTheme: raw.cardTheme || 'default',
    signupLink: raw.signupLink,
    signupTitle: raw.signupTitle,
    createdAt: raw.createdAt,
  };
}
