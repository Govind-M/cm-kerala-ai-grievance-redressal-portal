/**
 * Auth API service — thin wrappers around backend endpoints.
 *
 * Contracts verified against:
 *   POST /auth/register  → 201 UserResponse
 *   POST /auth/login     → 200 TokenResponse { access_token, token_type, expires_in, csrf_token, user }
 *   POST /auth/refresh   → 200 TokenResponse (requires X-CSRF-Token + cookie)
 *   POST /auth/logout    → 204 (requires X-CSRF-Token + cookie)
 *   GET  /auth/me        → 200 UserResponse
 */

import api, { announceSession, refreshSession, tokenStore, withSessionLock } from './api.js';

export async function loginApi({ email, password }) {
  return withSessionLock(async () => {
    const res = await api.post('/auth/login', { email, password });
    tokenStore.set(res.data.access_token, res.data.csrf_token, res.data);
    announceSession('login');
    return res.data;
  });
}

export async function registerApi({ name, email, mobile_number, password }) {
  const res = await api.post('/auth/register', { name, email, mobile_number, password });
  return res.data; // UserResponse
}

export async function refreshApi(csrfToken) {
  return refreshSession(csrfToken);
}

export async function logoutApi(csrfToken) {
  return endSession('/auth/logout', csrfToken);
}

export async function logoutAllApi(csrfToken) { return endSession('/auth/logout-all', csrfToken); }

async function endSession(path, csrf) {
  if (tokenStore.needsRefresh()) await refreshSession(csrf);
  return withSessionLock(async () => {
    await api.post(path, {}, { headers: { 'X-CSRF-Token': tokenStore.csrfToken ?? csrf ?? '' } });
    tokenStore.clear();
  });
}

export async function getMeApi() {
  const res = await api.get('/auth/me');
  return res.data; // UserResponse
}
