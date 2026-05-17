import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '../../config/supabase';

/**
 * Resize + recompress a local image URI before upload. Caps the long
 * edge at 1600px (expo-image-manipulator preserves aspect ratio when
 * only `width` is given) and re-encodes as JPEG @ 0.7 quality. This
 * keeps Supabase Storage costs down and prevents cellular upload
 * timeouts on phones that hand us 4000px originals straight off the
 * camera roll.
 *
 * Pass-through cases:
 *   - falsy / non-string URIs
 *   - already-remote URLs (re-edit flows hand us back the previously
 *     uploaded HTTPS path)
 * Failure falls back to the raw URI rather than blocking the upload —
 * a big upload still beats a broken one.
 */
async function compressImageIfNeeded(uri) {
  if (!uri || typeof uri !== 'string') return uri;
  if (uri.startsWith('http')) return uri;
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1600 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri;
  } catch (e) {
    if (__DEV__) console.warn('[compress] failed, uploading raw:', e?.message);
    return uri;
  }
}

export async function getMyProfile() {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return null;

  const { data, error } = await supabase
    .from('User')
    .select('*, profile:Profile(*), photos:Photo(*)')
    .eq('auth_id', authUser.id)
    .single();

  if (error) throw error;
  return data;
}

export async function updateProfile(updates) {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error('Not authenticated');

  const { data: appUser } = await supabase
    .from('User')
    .select('id')
    .eq('auth_id', authUser.id)
    .single();

  if (!appUser) throw new Error('User not found');

  const userFields = {};
  const profileFields = {};

  const USER_KEYS = ['displayName', 'countryCode', 'city', 'latitude', 'longitude', 'dateOfBirth', 'gender'];
  const PROFILE_KEYS = [
    'bio', 'lookingFor', 'interests', 'stickers', 'education', 'job', 'school',
    'ethnicity', 'heightCm', 'pronouns', 'children', 'sexuality', 'datingIntentions',
    'relationshipType', 'currentlyInto', 'promptQuestion', 'promptAnswer',
    'minPreferredAge', 'maxPreferredAge', 'maxDistanceKm', 'showMe', 'lookingForGender',
    'profileComplete', 'accountPurpose', 'eulaAcceptedAt', 'eulaVersion',
    // Cross-device toggles — server is the source of truth so they
    // sync from phone to web to tablet.
    'incognito', 'appMode',
    // Snap-Map opt-in (00032). Default FALSE; client flips this from
    // Settings → Appear on map. The map component reads it via the
    // discover/profile fetch path.
    'shareLocation',
  ];

  for (const [key, value] of Object.entries(updates)) {
    if (USER_KEYS.includes(key)) userFields[key] = value;
    else if (PROFILE_KEYS.includes(key)) profileFields[key] = value;
  }

  if (profileFields.currentlyInto !== undefined) {
    profileFields.currentlyIntoSetAt = new Date().toISOString();
  }

  if (Object.keys(userFields).length > 0) {
    const { error } = await supabase
      .from('User')
      .update(userFields)
      .eq('id', appUser.id);
    if (error) throw error;
  }

  if (Object.keys(profileFields).length > 0) {
    const { error } = await supabase
      .from('Profile')
      .update(profileFields)
      .eq('userId', appUser.id);
    if (error) throw error;
  }

  const { data: updated } = await supabase
    .from('User')
    .select('*, profile:Profile(*), photos:Photo(*)')
    .eq('id', appUser.id)
    .single();

  return updated;
}

// Decorate Supabase errors with their PostgREST/Storage codes so we
// can tell schema/RLS/Storage issues apart in the warn log. Without
// this, supabase-js only surfaces `.message`, which is often a vague
// translation like "The database schema is invalid or incompatible."
const labeled = (where, err) => {
  if (!err) return new Error(where);
  const code = err.code || err.statusCode || '';
  const out = new Error(`${where}${code ? ` [${code}]` : ''}: ${err.message || String(err)}`);
  out.cause = err;
  return out;
};

export async function uploadPhoto(imageUri) {
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser();
  if (authErr) throw labeled('auth.getUser', authErr);
  if (!authUser) throw new Error('Not authenticated');

  const { data: appUser, error: lookupErr } = await supabase
    .from('User')
    .select('id')
    .eq('auth_id', authUser.id)
    .single();
  if (lookupErr) throw labeled('User lookup', lookupErr);
  if (!appUser) throw new Error('User not found');

  const { count, error: countErr } = await supabase
    .from('Photo')
    .select('id', { count: 'exact', head: true })
    .eq('userId', appUser.id);
  if (countErr) throw labeled('Photo count', countErr);

  if ((count || 0) >= 9) throw new Error('Maximum 9 photos allowed');

  // Resize + re-compress before upload. compressImageIfNeeded returns
  // a JPEG-encoded local URI; we override the extension/contentType
  // accordingly so the Storage object has the right MIME and the
  // Photo.url renders correctly. Pass-through for already-remote URIs
  // (re-edit flow) keeps the original ext below.
  const compressedUri = await compressImageIfNeeded(imageUri);
  const wasCompressed = compressedUri !== imageUri;

  const filename = (compressedUri.split('/').pop() || '').toLowerCase();
  const rawExt = wasCompressed ? 'jpg' : (filename.includes('.') ? filename.split('.').pop() : '');
  const ext = (rawExt || 'jpg').replace(/[^a-z0-9]/g, '') || 'jpg';
  const storagePath = `${appUser.id}/${Date.now()}.${ext}`;
  const contentType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  // React Native's fetch().blob() returns an opaque Blob that the
  // Supabase Storage upload silently truncates to zero bytes on
  // Hermes — the upload "succeeds" but the file is empty, and the
  // Photo row insert that follows then fails with a generic schema
  // error. Reading the body as an ArrayBuffer works around this and
  // produces a real binary upload. Don't switch back to blob() without
  // testing on a real device.
  const response = await fetch(compressedUri);
  if (!response.ok) throw new Error(`Could not read image file (HTTP ${response.status})`);
  const arrayBuffer = await response.arrayBuffer();
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error('Selected image was empty — re-pick the photo and try again.');
  }

  // Storage uploads can transiently 503 when PostgREST's schema cache
  // is being rebuilt right after a migration lands — the policy
  // planner throws "schema is invalid or incompatible" until the
  // cache catches up. Retry once with a short backoff covers the
  // common window; other status codes surface immediately.
  let uploadError = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabase.storage
      .from('photos')
      .upload(storagePath, arrayBuffer, { contentType, upsert: false });
    if (!error) { uploadError = null; break; }
    uploadError = error;
    const status = String(error?.statusCode || error?.status || '');
    if (status !== '503' || attempt === 1) break;
    await new Promise((r) => setTimeout(r, 600));
  }
  if (uploadError) throw labeled('Storage upload', uploadError);

  const { data: urlData } = supabase.storage
    .from('photos')
    .getPublicUrl(storagePath);

  // Use the server-side `append_photo` RPC (00030) so concurrent
  // uploads from the same account serialize on the database side and
  // can't race on sortOrder. The function reads the next position
  // atomically and the (userId, sortOrder) unique index added in the
  // same migration catches any remaining race. The fallback to a
  // direct INSERT below is only reached on installations where the
  // migration hasn't been applied yet — log a dev warning so we know.
  const { data: rpcPhoto, error: rpcError } = await supabase.rpc('append_photo', {
    _url: urlData.publicUrl,
    _storage_path: storagePath,
  });

  if (!rpcError && rpcPhoto) {
    return rpcPhoto;
  }

  if (__DEV__ && rpcError) {
    console.warn('[profileService] append_photo RPC failed; falling back to direct insert:', rpcError.message);
  }

  const { data: photo, error: insertError } = await supabase
    .from('Photo')
    .insert({
      userId: appUser.id,
      url: urlData.publicUrl,
      storagePath,
      sortOrder: count || 0,
      isPrimary: (count || 0) === 0,
    })
    .select('*')
    .single();

  if (insertError) {
    // Roll back the orphaned storage object so retries don't leak
    // files for every failed Photo insert. Best-effort.
    try { await supabase.storage.from('photos').remove([storagePath]); } catch {}
    throw labeled('Photo insert', insertError);
  }
  return photo;
}

export async function deletePhoto(photoId) {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error('Not authenticated');

  const { data: appUser } = await supabase
    .from('User')
    .select('id')
    .eq('auth_id', authUser.id)
    .single();
  if (!appUser) throw new Error('User not found');

  // Look up the storage path BEFORE deleting so we can clean up the
  // S3 object after the DB row is gone. The RPC below does the
  // delete + atomic reindex in one round trip; the storage removal
  // is best-effort and shouldn't block the user's UI on failure.
  const { data: photoMeta } = await supabase
    .from('Photo')
    .select('storagePath')
    .eq('id', photoId)
    .eq('userId', appUser.id)
    .maybeSingle();

  // Prefer the atomic RPC (00030). Two concurrent deletes via the
  // RPC serialize correctly because each holds its row locks
  // through reindex. Falls back to the older client-side
  // read-then-loop if the RPC isn't deployed.
  const { data: rpcOk, error: rpcError } = await supabase.rpc('delete_photo', { _photo_id: photoId });
  if (!rpcError && rpcOk) {
    if (photoMeta?.storagePath) {
      await supabase.storage.from('photos').remove([photoMeta.storagePath]).catch(() => {});
    }
    return { success: true };
  }
  if (__DEV__ && rpcError) {
    console.warn('[profileService] delete_photo RPC failed; falling back to client reindex:', rpcError.message);
  }

  const { data: photo } = await supabase
    .from('Photo')
    .select('*')
    .eq('id', photoId)
    .eq('userId', appUser.id)
    .single();

  if (!photo) throw new Error('Photo not found');

  if (photo.storagePath) {
    await supabase.storage.from('photos').remove([photo.storagePath]);
  }

  await supabase.from('Photo').delete().eq('id', photoId);

  const { data: remaining } = await supabase
    .from('Photo')
    .select('id, sortOrder')
    .eq('userId', appUser.id)
    .order('sortOrder', { ascending: true });

  if (remaining) {
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].sortOrder !== i) {
        await supabase.from('Photo').update({ sortOrder: i, isPrimary: i === 0 }).eq('id', remaining[i].id);
      }
    }
  }

  return { success: true };
}

/**
 * Promote a photo to the user's primary (display) photo. Swaps the
 * target's sortOrder with whatever is currently at position 0 and
 * flips isPrimary on both rows in a single round trip from the
 * client's perspective. RLS handles the auth check — only the owner
 * can update their Photo rows. Returns the refreshed photos list.
 *
 * Two writes back-to-back rather than a transaction because supabase-js
 * doesn't expose multi-statement transactions; both writes hit the
 * Photo table only and an interrupted state still leaves the user
 * with a valid (non-duplicate) primary because sortOrder is the
 * ordering source of truth — a missing isPrimary just means a brief
 * flicker on next load.
 */
export async function setPrimaryPhoto(photoId) {
  if (!photoId) throw new Error('photoId required');

  // Atomic RPC (00030_photo_sortorder_rpc.sql). The unique index on
  // (userId, sortOrder) would block a naive two-statement swap from
  // the client (intermediate state would violate uniqueness); the
  // RPC does the swap inside a single UPDATE so there's no
  // intermediate state to fail on.
  const { error: rpcError } = await supabase.rpc('promote_photo', { _photo_id: photoId });
  if (rpcError) throw labeled('Promote photo', rpcError);
  return { success: true };
}

export async function getTrendingCurrentlyInto() {
  const { data, error } = await supabase.functions.invoke('trending');
  if (error) throw error;
  return data;
}

export async function updateCurrentlyInto(items) {
  return updateProfile({ currentlyInto: items });
}

/**
 * Converts an API user/profile response into the UI shape
 * used by existing screens.
 */
export function normalizeProfile(apiUser) {
  if (!apiUser) return null;
  const profile = apiUser.profile || {};
  const photos = (apiUser.photos || []).map((p) => p.url);

  let age = null;
  if (apiUser.dateOfBirth) {
    const dob = new Date(apiUser.dateOfBirth);
    const now = new Date();
    age = now.getFullYear() - dob.getFullYear();
    if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) {
      age--;
    }
  }

  let height = null;
  if (profile.heightCm) {
    const totalInches = Math.round(profile.heightCm / 2.54);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    height = `${feet}'${inches}"`;
  }

  return {
    id: apiUser.id,
    name: apiUser.displayName,
    age,
    distance: null,
    verified: apiUser.isVerified || false,
    bio: profile.bio || '',
    about: profile.bio || '',
    lookingFor: profile.lookingFor || profile.datingIntentions || '',
    job: profile.job || '',
    school: profile.school || '',
    images: photos,
    interests: profile.interests || [],
    stickers: profile.stickers || [],
    currentlyInto: profile.currentlyInto || [],
    height,
    ethnicity: profile.ethnicity || '',
    intention: profile.datingIntentions || '',
    pronouns: profile.pronouns || '',
    education: profile.education || '',
    children: profile.children || '',
    gender: apiUser.gender,
    _raw: apiUser,
  };
}
