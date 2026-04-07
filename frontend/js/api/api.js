function resolveApiBaseUrl() {
  const hostname = window.location.hostname;
  const isLocalhost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.localhost');

  if (isLocalhost) {
    return window.location.port === '3000'
      ? window.location.origin
      : 'http://localhost:3000';
  }

  // Production deploys should call the API through the same origin.
  return '/api';
}

export const API_BASE_URL = resolveApiBaseUrl();

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    },
    ...options
  });

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message =
      payload?.error ??
      payload?.errors?.name ??
      'Something went wrong while talking to the server';

    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export function getLevels() {
  return request('/levels');
}

export function startLevel(levelId) {
  return request(`/levels/${levelId}/start`, {
    method: 'POST'
  });
}

export function submitLevelClick(levelId, body) {
  return request(`/levels/${levelId}/click`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export function getLeaderboard(levelId) {
  const query = levelId ? `?levelId=${encodeURIComponent(levelId)}` : '';
  return request(`/leaderboard${query}`);
}

export function submitLeaderboard(name) {
  return request('/leaderboard', {
    method: 'POST',
    body: JSON.stringify({ name })
  });
}
