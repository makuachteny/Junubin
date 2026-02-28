import { apiRequest } from '../client';

export async function refreshAccessToken(refreshToken) {
  return apiRequest('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  });
}

export async function getMe(token) {
  return apiRequest('/auth/me', { token });
}
