import { apiRequest } from '../client';
import { normalizeProfile } from './profileService';

export async function getProfiles(token, filters = {}) {
  const params = new URLSearchParams();
  if (filters.minAge) params.set('minAge', filters.minAge);
  if (filters.maxAge) params.set('maxAge', filters.maxAge);
  if (filters.ethnicity) params.set('ethnicity', filters.ethnicity);
  if (filters.minHeightCm) params.set('minHeightCm', filters.minHeightCm);
  if (filters.maxHeightCm) params.set('maxHeightCm', filters.maxHeightCm);
  if (filters.datingIntentions) params.set('datingIntentions', filters.datingIntentions);
  if (filters.gender) params.set('gender', filters.gender);
  if (filters.cursor) params.set('cursor', filters.cursor);
  if (filters.limit) params.set('limit', filters.limit);
  if (filters.mode) params.set('mode', filters.mode);

  const qs = params.toString();
  const data = await apiRequest(`/discover${qs ? `?${qs}` : ''}`, { token });
  return {
    profiles: (data.profiles || []).map(normalizeProfile),
    nextCursor: data.nextCursor,
  };
}

export async function recordSwipe(token, toUserId, type) {
  return apiRequest('/swipes', {
    method: 'POST',
    token,
    body: { toUserId, type },
  });
}

export async function getDailyLikeStatus(token) {
  return apiRequest('/swipes/daily-status', { token });
}
