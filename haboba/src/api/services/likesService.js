import { apiRequest } from '../client';
import { normalizeProfile } from './profileService';

export async function getReceivedLikes(token) {
  const data = await apiRequest('/swipes/received', { token });
  return (data.likes || []).map((like) => {
    const profile = normalizeProfile(like.user);
    return {
      ...profile,
      likeId: like.id,
      likeType: like.type,
      likedAt: like.createdAt,
    };
  });
}
