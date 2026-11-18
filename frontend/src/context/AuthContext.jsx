import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { isInvalidSession, restoredCsrfToken, tokenStore } from '../services/api.js';
import { loginApi, logoutApi, logoutAllApi, refreshApi, registerApi } from '../services/authApi.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionUnavailable, setSessionUnavailable] = useState(false);
  const initialised = useRef(false);
  const generation = useRef(0);
  const lastResume = useRef(-Infinity);

  const restore = useCallback(async () => {
    const csrf = tokenStore.csrfToken || restoredCsrfToken();
    if (!csrf) { setLoading(false); return; }
    const started = generation.current;
    try {
      const data = await refreshApi(csrf);
      if (started !== generation.current) return;
      tokenStore.set(data.access_token, data.csrf_token, data);
      setUser(data.user); setSessionUnavailable(false); setError(null);
    } catch (failure) {
      if (started !== generation.current) return;
      if (isInvalidSession(failure)) {
        tokenStore.clear(); setUser(null); setSessionUnavailable(false); setError(null);
      } else {
        // Offline, 5xx, rate limits, CSRF/configuration failures do not prove revocation.
        setSessionUnavailable(true);
        setError(failure.code === 'AUTH_COORDINATION_UNAVAILABLE'
          ? 'Automatic session restoration is unavailable in this browser. Use a current browser or sign in manually.'
          : 'Your session could not be checked. Check your connection and retry; your local session has been kept.');
      }
    } finally {
      if (started === generation.current) setLoading(false);
    }
  }, []);

  const retrySession = useCallback(() => { setLoading(true); return restore(); }, [restore]);

  useEffect(() => tokenStore.subscribeSession((event) => {
    if (event.type === 'updated') setUser(event.user);
    else if (event.type === 'cleared') {
      generation.current += 1;
      setUser(null); setLoading(false); setSessionUnavailable(false); setError(null);
    } else if (event.type === 'external-login') {
      generation.current += 1;
      setUser(null); setLoading(true);
      void restore();
    }
  }), [restore]);

  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;
    void restore();
  }, [restore]);

  useEffect(() => {
    const resume = () => {
      if (document.visibilityState !== 'hidden' && (user || sessionUnavailable) && tokenStore.needsRefresh()
          && Date.now() - lastResume.current >= 30000) {
        lastResume.current = Date.now();
        void restore();
      }
    };
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [user, sessionUnavailable, restore]);

  const login = useCallback(async (email, password) => {
    generation.current += 1; setError(null);
    const data = await loginApi({ email, password });
    tokenStore.set(data.access_token, data.csrf_token, data);
    setUser(data.user); setLoading(false); setSessionUnavailable(false);
    return data.user;
  }, []);

  const register = useCallback(async (fields) => {
    setError(null);
    return registerApi(fields); // Registration does not log in.
  }, []);

  const endSession = useCallback(async (operation) => {
    generation.current += 1;
    let unconfirmed = false;
    try { await operation(tokenStore.csrfToken); }
    catch { unconfirmed = true; }
    finally {
      tokenStore.clear(); setUser(null); setLoading(false); setSessionUnavailable(false);
    }
    if (unconfirmed) setError('Server sign-out could not be confirmed. Local credentials were cleared.');
  }, []);
  const logout = useCallback(() => endSession(logoutApi), [endSession]);
  const logoutAll = useCallback(() => endSession(logoutAllApi), [endSession]);

  return <AuthContext.Provider value={{ user, loading, error, sessionUnavailable, retrySession, login, register, logout, logoutAll }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
