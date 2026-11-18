import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  timeout: 15000, withCredentials: true, headers: { Accept: 'application/json' },
});
// Persist only the non-bearer CSRF nonce. JWTs stay in memory/HttpOnly cookies.
const CSRF_KEY = 'cmk.csrf.v1';
const EVENT_KEY = 'cmk.auth.event.v1';
const LOCK_NAME = 'cmk.auth.cookie-rotation.v1';
let accessToken = null, csrfToken = null, currentUser = null, expiresAt = 0;
let generation = 0, identityEpoch = 0, refreshPromise = null;
const listeners = new Set(), sessionListeners = new Set();

export function restoredCsrfToken() {
  try { return localStorage.getItem(CSRF_KEY) || sessionStorage.getItem(CSRF_KEY); }
  catch { try { return sessionStorage.getItem(CSRF_KEY); } catch { return null; } }
}
function rememberCsrf(value) {
  for (const name of ['localStorage', 'sessionStorage']) {
    try {
      if (value) globalThis[name].setItem(CSRF_KEY, value);
      else globalThis[name].removeItem(CSRF_KEY);
    } catch { /* Restricted storage never bypasses CSRF. */ }
  }
}
export function announceSession(type) {
  try { localStorage.setItem(EVENT_KEY, JSON.stringify({ type, nonce: crypto.randomUUID() })); }
  catch { /* Cookie rotation still requires the cross-tab lock. */ }
}
function emit(event) { sessionListeners.forEach((listener) => listener(event)); }
function invalidate() {
  generation += 1; identityEpoch += 1;
  accessToken = null; csrfToken = null; currentUser = null; expiresAt = 0;
}
function tokenExpiry(token, seconds) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')));
    if (Number.isFinite(payload.exp)) return payload.exp * 1000;
  } catch { /* Timing only: the server always validates JWT expiry. */ }
  return Date.now() + (Number.isFinite(seconds) ? seconds : 900) * 1000;
}
export const tokenStore = {
  set(access, csrf, data = {}) {
    if (csrfToken !== csrf || (currentUser && data.user && currentUser.id !== data.user.id)) identityEpoch += 1;
    generation += 1;
    accessToken = access; csrfToken = csrf; currentUser = data.user ?? currentUser;
    expiresAt = tokenExpiry(access, data.expires_in);
    rememberCsrf(csrf);
    if (data.user) emit({ type: 'updated', user: data.user });
  },
  clear({ broadcast = true } = {}) {
    invalidate(); rememberCsrf(null);
    listeners.forEach((listener) => listener()); emit({ type: 'cleared' });
    if (broadcast) announceSession('logout');
  },
  subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  subscribeSession(listener) { sessionListeners.add(listener); return () => sessionListeners.delete(listener); },
  needsRefresh() { return !accessToken || expiresAt <= Date.now() + 30000; },
  get accessToken() { return accessToken; }, get csrfToken() { return csrfToken; },
  get user() { return currentUser; },
};
export function withSessionLock(action, { required = false } = {}) {
  if (globalThis.navigator?.locks?.request) return navigator.locks.request(LOCK_NAME, action);
  // A non-atomic storage lease cannot safely serialize rotating refresh cookies.
  if (required) return Promise.reject(Object.assign(new Error('Automatic session restoration needs a browser with Web Locks support.'), { code: 'AUTH_COORDINATION_UNAVAILABLE' }));
  return Promise.resolve().then(action);
}
export const isInvalidSession = (error) => error?.response?.status === 401;

// Same flight for bootstrap, focus AND API interception; hold the cross-tab lock
// through Set-Cookie and storing the returned nonce. Never share access JWTs.
export function refreshSession(csrf = restoredCsrfToken()) {
  if (refreshPromise) return refreshPromise;
  if (!csrf) return Promise.reject(Object.assign(new Error('No saved session'), { response: { status: 401 } }));
  const started = generation;
  refreshPromise = withSessionLock(async () => {
    if (started !== generation) throw new Error('Authentication changed during refresh');
    const response = await api.post('/auth/refresh', {}, { headers: { 'X-CSRF-Token': restoredCsrfToken() || csrf } });
    if (started !== generation) throw new Error('Authentication changed during refresh');
    tokenStore.set(response.data.access_token, response.data.csrf_token, response.data);
    return response.data;
  }, { required: true }).catch((error) => {
    if (started === generation && isInvalidSession(error)) tokenStore.clear();
    throw enrichError(error);
  }).finally(() => { refreshPromise = null; });
  return refreshPromise;
}
if (typeof window !== 'undefined') window.addEventListener('storage', (event) => {
  if (event.key !== EVENT_KEY || !event.newValue) return;
  let type;
  try { ({ type } = JSON.parse(event.newValue)); } catch { return; }
  if (!['login', 'logout'].includes(type)) return;
  invalidate();
  if (type === 'logout') {
    try { sessionStorage.removeItem(CSRF_KEY); } catch { /* denied storage */ }
    listeners.forEach((listener) => listener());
  }
  emit({ type: type === 'login' ? 'external-login' : 'cleared' });
});
api.interceptors.request.use((config) => {
  if (!config._retried) config._authEpoch = identityEpoch;
  if (accessToken) config.headers.Authorization = 'Bearer ' + accessToken;
  return config;
});
api.interceptors.response.use((response) => response, async (error) => {
  const original = error.config;
  if (!original || error.response?.status !== 401 || original.url?.includes('/auth/')) throw enrichError(error);
  if (original._authEpoch !== identityEpoch) throw enrichError(error);
  if (original._retried) {
    if (original.headers?.Authorization === 'Bearer ' + accessToken) tokenStore.clear();
    throw enrichError(error);
  }
  if (!csrfToken) { tokenStore.clear(); throw enrichError(error); }
  try {
    if (!accessToken || original.headers?.Authorization === 'Bearer ' + accessToken) await refreshSession(csrfToken);
    if (original._authEpoch !== identityEpoch || !accessToken) throw error;
    original._retried = true; original.headers.Authorization = 'Bearer ' + accessToken;
    return api(original);
  } catch (refreshError) {
    // Surface recoverable refresh failures, not a misleading expired-session 401.
    throw enrichError(refreshError);
  }
});
function enrichError(error) {
  const detail = error.response?.data?.detail;
  error.userMessage = error.response
    ? typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((d) => d.msg).join('; ') : 'The request could not be completed.'
    : 'The service could not be reached. Please check your connection.';
  return error;
}
export default api;
