import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import api, { refreshSession, restoredCsrfToken, tokenStore } from '../services/api.js';
import { logoutApi, logoutAllApi, refreshApi } from '../services/authApi.js';

const failure = (config, status) => Object.assign(new Error('Synthetic failure'), { config, response: { status, data: {} } });
beforeEach(() => { tokenStore.clear(); localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { tokenStore.clear(); vi.restoreAllMocks(); });

it.each([undefined, 503, 500, 429, 403])('preserves credentials after recoverable refresh failure %s', async (status) => {
  tokenStore.set('old-access', 'csrf');
  const error = status ? failure(null, status) : new Error('Offline');
  const post = vi.spyOn(api, 'post').mockRejectedValue(error);
  const listener = vi.fn(); const unsubscribe = tokenStore.subscribe(listener);
  await expect(api.get('/owned', { adapter: (config) => Promise.reject(failure(config, 401)) })).rejects.toBe(error);
  expect(tokenStore.accessToken).toBe('old-access');
  expect(restoredCsrfToken()).toBe('csrf');
  expect(listener).not.toHaveBeenCalled();
  expect(post).toHaveBeenCalledTimes(1);
  unsubscribe();
});

it('shares one flight between bootstrap, explicit restoration and an expired API request', async () => {
  tokenStore.set('old', 'csrf');
  let finish;
  const post = vi.spyOn(api, 'post').mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const adapter = vi.fn(async (config) => {
    if (config.headers.Authorization === 'Bearer old') throw failure(config, 401);
    return { data: 'ok', status: 200, config, headers: {} };
  });
  const a = refreshApi('csrf');
  const b = refreshSession('csrf');
  const c = api.get('/owned', { adapter });
  await vi.waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  finish({ data: { access_token: 'new', csrf_token: 'csrf' } });
  await Promise.all([a, b, c]);
  expect(post).toHaveBeenCalledTimes(1);
  expect(adapter).toHaveBeenCalledTimes(2);
});

it('serializes two isolated frontend runtimes sharing one rotating cookie', async () => {
  const one = await import('../services/api.js?tab=one');
  const two = await import('../services/api.js?tab=two');
  one.tokenStore.set('one', 'csrf'); two.tokenStore.set('two', 'csrf');
  let cookieVersion = 0, active = 0, maximum = 0;
  const versions = [];
  const rotate = async () => {
    active += 1; maximum = Math.max(maximum, active);
    const version = cookieVersion; versions.push(version);
    await Promise.resolve();
    expect(cookieVersion).toBe(version);
    cookieVersion += 1; active -= 1;
    return { data: { access_token: 'access-' + cookieVersion, csrf_token: 'csrf' } };
  };
  vi.spyOn(one.api, 'post').mockImplementation(rotate);
  vi.spyOn(two.api, 'post').mockImplementation(rotate);
  await Promise.all([one.refreshSession(), two.refreshSession()]);
  expect(maximum).toBe(1); expect(versions).toEqual([0, 1]);
  expect(one.tokenStore.accessToken).toBe('access-1');
  expect(two.tokenStore.accessToken).toBe('access-2');
  one.tokenStore.clear(); two.tokenStore.clear();
});

it('fails safely without Web Locks, retaining credentials and making no rotation request', async () => {
  tokenStore.set('old', 'csrf');
  Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
  const post = vi.spyOn(api, 'post');
  await expect(refreshSession()).rejects.toMatchObject({ code: 'AUTH_COORDINATION_UNAVAILABLE' });
  expect(post).not.toHaveBeenCalled();
  expect(tokenStore.accessToken).toBe('old');
  expect(restoredCsrfToken()).toBe('csrf');
});

it.each([['/auth/logout', logoutApi], ['/auth/logout-all', logoutAllApi]])('uses the existing CSRF-protected %s contract', async (path, logout) => {
  tokenStore.set('valid-access', 'csrf');
  const post = vi.spyOn(api, 'post').mockResolvedValue({ status: 204 });
  await logout('csrf');
  expect(post).toHaveBeenCalledExactlyOnceWith(path, {}, { headers: { 'X-CSRF-Token': 'csrf' } });
  expect(tokenStore.accessToken).toBeNull(); expect(restoredCsrfToken()).toBeNull();
});

it('does not refresh or sign out for an AI-provider 503', async () => {
  tokenStore.set('valid-access', 'csrf');
  const post = vi.spyOn(api, 'post');
  await expect(api.get('/ai/synthetic', { adapter: (config) => Promise.reject(failure(config, 503)) })).rejects.toBeDefined();
  expect(post).not.toHaveBeenCalled(); expect(tokenStore.accessToken).toBe('valid-access');
});

it('never replays an old user request after refresh reveals an identity change', async () => {
  tokenStore.set('old', 'csrf', { user: { id: 'first' } });
  vi.spyOn(api, 'post').mockResolvedValue({ data: { access_token: 'new', csrf_token: 'csrf', user: { id: 'second' } } });
  const adapter = vi.fn((config) => Promise.reject(failure(config, 401)));
  await expect(api.get('/owned-write-context', { adapter })).rejects.toBeDefined();
  expect(adapter).toHaveBeenCalledTimes(1);
  expect(tokenStore.user.id).toBe('second');
});

it('shares only a CSRF nonce, never bearer JWTs, and handles explicit cross-tab logout', () => {
  tokenStore.set('private-access-jwt', 'csrf');
  sessionStorage.clear();
  expect(restoredCsrfToken()).toBe('csrf');
  expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain('private-access-jwt');
  localStorage.removeItem('cmk.csrf.v1');
  window.dispatchEvent(new StorageEvent('storage', { key: 'cmk.auth.event.v1', newValue: JSON.stringify({ type: 'logout', nonce: 'test' }) }));
  expect(tokenStore.accessToken).toBeNull();
});
