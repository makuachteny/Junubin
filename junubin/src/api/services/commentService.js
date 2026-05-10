// PostComment service — talks to the `PostComment` table added in
// migration 00017. Comments are public (any authenticated user can
// read), authored only by the caller, and support one level of
// threading via `parentId`.

import { supabase } from '../../config/supabase';

const PAGE_SIZE = 100;

function makeId() {
  return (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function resolveAppUserId() {
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
 * List comments for a post (top-level + replies, returned flat;
 * PostDetailScreen groups them by parentId for rendering). Ordered
 * oldest-first so threading reads naturally top-to-bottom.
 */
export async function listComments(postId) {
  if (!postId) return [];
  const { data, error } = await supabase
    .from('PostComment')
    .select(`
      id, postId, userId, parentId, content, createdAt,
      author:User!userId(id, displayName, isVerified, photos:Photo(url))
    `)
    .eq('postId', postId)
    .order('createdAt', { ascending: true })
    .limit(PAGE_SIZE);
  if (error) throw error;
  return (data || []).map(normalizeComment);
}

/**
 * Add a comment (or reply if parentId is set). Returns the normalized
 * comment so the caller can prepend it to local state without a refetch.
 */
export async function addComment({ postId, content, parentId = null }) {
  if (!postId) throw new Error('postId required');
  const trimmed = (content || '').trim();
  if (trimmed.length === 0) throw new Error('content required');
  if (trimmed.length > 2000) throw new Error('content too long');

  const me = await resolveAppUserId();
  if (!me) throw new Error('Not authenticated');

  const id = makeId();
  const row = {
    id,
    postId,
    userId: me.id,
    parentId,
    content: trimmed,
  };

  const { data, error } = await supabase
    .from('PostComment')
    .insert(row)
    .select(`
      id, postId, userId, parentId, content, createdAt,
      author:User!userId(id, displayName, isVerified, photos:Photo(url))
    `)
    .single();
  if (error) throw error;
  return normalizeComment(data);
}

/**
 * Delete one of your own comments. RLS enforces that the caller owns
 * the row; this is just a best-effort wrapper that resolves to the new
 * row count.
 */
export async function deleteComment(commentId) {
  const { error } = await supabase
    .from('PostComment')
    .delete()
    .eq('id', commentId);
  if (error) throw error;
  return { ok: true };
}

function normalizeComment(raw) {
  const author = raw?.author || {};
  const avatar = author?.photos?.[0]?.url || null;
  return {
    id: raw.id,
    postId: raw.postId,
    userId: raw.userId,
    parentId: raw.parentId,
    text: raw.content,
    time: formatRelativeTime(raw.createdAt),
    createdAt: raw.createdAt,
    likes: 0, // PostCommentLike isn't modelled yet; UI keeps a local likes counter
    user: {
      id: author?.id || raw.userId,
      name: author?.displayName || 'Junubin',
      avatar,
      verified: !!author?.isVerified,
    },
  };
}

// Mirrors the lightweight relative-time formatting used elsewhere in
// the app (utils/formatTime). Inlined here to avoid pulling a UI util
// into a service module.
function formatRelativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return new Date(iso).toLocaleDateString();
}
