import { API_BASE_URL } from '../config/api';

const REQUEST_TIMEOUT_MS = 15000;

const jsonHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

export async function apiRequest(path, { method = 'GET', token, body, multipart = false } = {}) {
  const headers = {
    ...(multipart ? {} : jsonHeaders),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const fetchBody = multipart ? body : body ? JSON.stringify(body) : undefined;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      signal: controller.signal,
      ...(fetchBody ? { body: fetchBody } : {}),
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : null;

    if (!response.ok) {
      const message = data?.error || `Request failed (${response.status})`;
      const err = new Error(message);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}
