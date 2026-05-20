import { apiFetch } from "./client";

export async function login(username, password) {
  return apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function register(nama, username, password) {
  return apiFetch("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ nama, username, password }),
  });
}

export async function getMe() {
  return apiFetch("/api/auth/me");
}

// Alias for backward compatibility
export const getCurrentUser = getMe;
