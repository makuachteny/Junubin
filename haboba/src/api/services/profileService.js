import { apiRequest } from '../client';

export async function getMyProfile(token) {
  const data = await apiRequest('/auth/me', { token });
  return data.user;
}

export async function updateProfile(token, updates) {
  const data = await apiRequest('/users/me', {
    method: 'PATCH',
    token,
    body: updates,
  });
  return data.user;
}

export async function uploadPhoto(token, imageUri) {
  const formData = new FormData();
  const filename = imageUri.split('/').pop();
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';
  formData.append('photo', { uri: imageUri, name: filename, type });

  const data = await apiRequest('/users/me/photos', {
    method: 'POST',
    token,
    body: formData,
    multipart: true,
  });
  return data.photo;
}

export async function deletePhoto(token, photoId) {
  return apiRequest(`/users/me/photos/${photoId}`, {
    method: 'DELETE',
    token,
  });
}

export async function getTrendingCurrentlyInto(token) {
  return apiRequest('/currently-into', { token });
}

export async function updateCurrentlyInto(token, items) {
  const data = await apiRequest('/users/me', {
    method: 'PATCH',
    token,
    body: { currentlyInto: items },
  });
  return data.user;
}

/**
 * Converts an API user/profile response into the mock data shape
 * used by existing UI screens.
 */
export function normalizeProfile(apiUser) {
  if (!apiUser) return null;
  const profile = apiUser.profile || {};
  const photos = (apiUser.photos || []).map((p) => p.url);

  // Calculate age from dateOfBirth
  let age = null;
  if (apiUser.dateOfBirth) {
    const dob = new Date(apiUser.dateOfBirth);
    const now = new Date();
    age = now.getFullYear() - dob.getFullYear();
    if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) {
      age--;
    }
  }

  // Convert heightCm to feet/inches string
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
    // raw API data for editing
    _raw: apiUser,
  };
}
