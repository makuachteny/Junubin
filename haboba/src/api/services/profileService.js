import { supabase } from '../../config/supabase';

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
    'profileComplete',
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

export async function uploadPhoto(imageUri) {
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) throw new Error('Not authenticated');

  const { data: appUser } = await supabase
    .from('User')
    .select('id')
    .eq('auth_id', authUser.id)
    .single();
  if (!appUser) throw new Error('User not found');

  const { count } = await supabase
    .from('Photo')
    .select('id', { count: 'exact', head: true })
    .eq('userId', appUser.id);

  if ((count || 0) >= 9) throw new Error('Maximum 9 photos allowed');

  const filename = imageUri.split('/').pop();
  const ext = filename.split('.').pop() || 'jpg';
  const storagePath = `${appUser.id}/${Date.now()}.${ext}`;

  const response = await fetch(imageUri);
  const blob = await response.blob();

  const { error: uploadError } = await supabase.storage
    .from('photos')
    .upload(storagePath, blob, { contentType: `image/${ext}` });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('photos')
    .getPublicUrl(storagePath);

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

  if (insertError) throw insertError;
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
