import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext.jsx';
import api, { restoredCsrfToken, tokenStore } from '../services/api.js';
import * as authApi from '../services/authApi.js';

vi.mock('../services/authApi.js', () => ({ loginApi: vi.fn(), logoutApi: vi.fn(), refreshApi: vi.fn(), registerApi: vi.fn() }));
const user = { id: 'test', name: 'Fictional', role: 'CITIZEN' };
const response = { user, access_token: 'access', csrf_token: 'csrf' };
function Probe() { const { user: current, loading } = useAuth(); return <p>{loading ? 'Loading' : current ? 'Signed in' : 'Signed out'}</p>; }
beforeEach(() => { vi.clearAllMocks(); tokenStore.clear(); sessionStorage.clear(); });
afterEach(() => { tokenStore.clear(); vi.restoreAllMocks(); });

it('stores only the CSRF nonce per-tab; access and refresh JWTs never enter storage', () => {
  tokenStore.set('secret-access-jwt', 'csrf');
  expect(restoredCsrfToken()).toBe('csrf');
  expect(JSON.stringify({ ...sessionStorage, ...localStorage })).not.toContain('secret-access-jwt');
  tokenStore.clear();
  expect(restoredCsrfToken()).toBeNull();
});

it('does not send a doomed refresh without a CSRF nonce', async () => {
  render(<AuthProvider><Probe /></AuthProvider>);
  expect(await screen.findByText('Signed out')).toBeInTheDocument();
  expect(authApi.refreshApi).not.toHaveBeenCalled();
});

it('restores after reload using the saved CSRF and updates in-memory tokens', async () => {
  sessionStorage.setItem('cmk.csrf.v1', 'csrf');
  authApi.refreshApi.mockResolvedValue(response);
  render(<AuthProvider><Probe /></AuthProvider>);
  expect(await screen.findByText('Signed in')).toBeInTheDocument();
  expect(authApi.refreshApi).toHaveBeenCalledWith('csrf');
  expect(tokenStore.accessToken).toBe('access');
});

it('clears stale signed-in UI when the token store expires', async () => {
  sessionStorage.setItem('cmk.csrf.v1', 'csrf');
  authApi.refreshApi.mockResolvedValue(response);
  render(<AuthProvider><Probe /></AuthProvider>);
  await screen.findByText('Signed in');
  act(() => tokenStore.clear());
  expect(await screen.findByText('Signed out')).toBeInTheDocument();
});

it('a conclusively invalid restore clears the saved nonce and remains signed out', async () => {
  sessionStorage.setItem('cmk.csrf.v1', 'bad');
  authApi.refreshApi.mockRejectedValue({ response: { status: 401 } });
  render(<AuthProvider><Probe /></AuthProvider>);
  await screen.findByText('Signed out');
  expect(restoredCsrfToken()).toBeNull();
});

it('fails closed when session storage is unavailable', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error(); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error(); });
  expect(() => tokenStore.set('access', 'csrf')).not.toThrow();
  expect(restoredCsrfToken()).toBeNull();
});

function failure(config, status) { return Object.assign(new Error('request failed'), { config, response: { status, data: { detail: 'Unauthorized' } } }); }

it('refreshes concurrent expired requests once and retries each with the new access token', async () => {
  tokenStore.set('old', 'csrf');
  const refresh = vi.spyOn(api, 'post').mockResolvedValue({ data: { access_token: 'new', csrf_token: 'csrf' } });
  const adapter = vi.fn(async (config) => {
    if (config.headers.Authorization === 'Bearer old') throw failure(config, 401);
    return { status: 200, data: 'ok', headers: {}, config };
  });
  const results = await Promise.all([api.get('/one', { adapter }), api.get('/two', { adapter })]);
  expect(results.map((r) => r.data)).toEqual(['ok', 'ok']);
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(refresh.mock.calls[0][2].headers['X-CSRF-Token']).toBe('csrf');
});

it('failed automatic refresh clears both token storage and subscribers', async () => {
  tokenStore.set('old', 'csrf');
  const listener = vi.fn();
  const unsubscribe = tokenStore.subscribe(listener);
  vi.spyOn(api, 'post').mockRejectedValue({ response: { status: 401 } });
  await expect(api.get('/one', { adapter: (config) => Promise.reject(failure(config, 401)) })).rejects.toBeDefined();
  expect(tokenStore.accessToken).toBeNull();
  expect(restoredCsrfToken()).toBeNull();
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
});

it('cannot resurrect an authenticated session after logout during pending refresh', async () => {
  tokenStore.set('old', 'csrf');
  let finish;
  const refresh = vi.spyOn(api, 'post').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const request = api.get('/one', { adapter: (config) => Promise.reject(failure(config, 401)) });
  const result = expect(request).rejects.toBeDefined();
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  tokenStore.clear();
  finish({ data: { access_token: 'late-access', csrf_token: 'csrf' } });
  await result;
  expect(tokenStore.accessToken).toBeNull();
  expect(restoredCsrfToken()).toBeNull();
});

it('clears signed-in state when a refreshed token is rejected, without a refresh loop', async () => {
  tokenStore.set('old', 'csrf');
  const refresh = vi.spyOn(api, 'post').mockResolvedValue({ data: { access_token: 'new', csrf_token: 'csrf' } });
  await expect(api.get('/one', { adapter: (config) => Promise.reject(failure(config, 401)) })).rejects.toBeDefined();
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(tokenStore.accessToken).toBeNull();
});
