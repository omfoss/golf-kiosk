const BASE = '/api';

// ── Token-håndtering ────────────────────────────────────────────────────
let authToken = null;

export function setToken(token) {
  authToken = token;
  if (token) {
    sessionStorage.setItem('kiosk-token', token);
  } else {
    sessionStorage.removeItem('kiosk-token');
  }
}

export function getToken() {
  if (!authToken) {
    authToken = sessionStorage.getItem('kiosk-token') || null;
  }
  return authToken;
}

export function clearToken() {
  authToken = null;
  sessionStorage.removeItem('kiosk-token');
}

// ── Helpers ─────────────────────────────────────────────────────────────
function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse(res) {
  if (res.status === 401) {
    clearToken();
    throw new Error('SESSION_EXPIRED');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  return handleResponse(res);
}

async function authGet(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

async function authPut(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

async function authPost(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

async function authDelete(path) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// ── Offentlige endpoints ────────────────────────────────────────────────
export const api = {
  getTeetimes:   (courseId) => get(courseId ? `/teetimes?courseId=${encodeURIComponent(courseId)}` : '/teetimes'),
  getCourses:    ()         => get('/courses'),
  getWeather:    ()         => get('/weather'),
  getContent:    key        => get(`/content/${key}`),
  getScreen:     id         => get(`/screens/${id}`),
  getAllScreens: ()          => get('/screens'),
  getBilder:     ()         => get('/bilder'),
};

// ── Admin endpoints (JWT-beskyttet) ─────────────────────────────────────
export const adminApi = {
  // Login – returnerer { ok, token }
  login: async (password) => {
    const res = await fetch(`${BASE}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await handleResponse(res);
    if (data.token) setToken(data.token);
    return data;
  },

  changePassword: (currentPassword, newPassword) =>
    authPost('/admin/change-password', { currentPassword, newPassword }),

  // Innhold
  updateContent:  (key, val) => authPut(`/admin/content/${key}`, val),

  // Skjermer
  getScreens:    ()          => authGet('/admin/screens'),
  updateScreen:  (id, s)     => authPut(`/admin/screens/${id}`, s),
  createScreen:  (s)         => authPost('/admin/screens', s),
  deleteScreen:  (id)        => authDelete(`/admin/screens/${id}`),

  // Baner
  getCourses:    ()          => authGet('/admin/courses'),
  createCourse:  (c)         => authPost('/admin/courses', c),
  updateCourse:  (id, c)     => authPut(`/admin/courses/${id}`, c),
  deleteCourse:  (id)        => authDelete(`/admin/courses/${id}`),

  // Golfbox
  refreshTeetimes: (courseId) => authPost('/admin/refresh-teetimes', courseId ? { courseId } : {}),
  getGolfboxStatus: ()        => authGet('/admin/golfbox/status'),
  updateGolfboxCookie: (cookie) => authPut('/admin/golfbox/cookie', { cookie }),
  deleteGolfboxCookie: ()     => authDelete('/admin/golfbox/cookie'),

  // Golfbox credentials
  updateGolfboxCredentials: (username, password) =>
    authPut('/admin/golfbox/credentials', { username, password }),
  getGolfboxCredentials: () => authGet('/admin/golfbox/credentials'),

  // Bildeopplasting
  uploadImage: async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await fetch(`${BASE}/admin/upload`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    return handleResponse(res);
  },
};
