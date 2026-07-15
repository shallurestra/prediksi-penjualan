export const API_BASE_URL = "https://web-production-1324d.up.railway.app";

const TOKEN_KEY = "sawangan-token";
const USER_KEY = "sawangan-user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getCurrentUserData() {
  const userData = localStorage.getItem(USER_KEY);
  return userData ? JSON.parse(userData) : null;
}

export function setCurrentUserData(user) {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function clearCurrentUserData() {
  localStorage.removeItem(USER_KEY);
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiFetchBlob(path) {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}
