import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext.jsx';
import ProtectedRoute from '../components/shared/ProtectedRoute.jsx';
import { restoredCsrfToken, tokenStore } from '../services/api.js';
import * as authApi from '../services/authApi.js';

vi.mock('../services/authApi.js', () => ({ loginApi: vi.fn(), logoutApi: vi.fn(), logoutAllApi: vi.fn(), refreshApi: vi.fn(), registerApi: vi.fn() }));
const user = { id: 'test', name: 'Fictional', role: 'CITIZEN' };
const response = { user, access_token: 'access', csrf_token: 'csrf', expires_in: 900 };
function Probe() { const auth = useAuth(); const route = useLocation(); return <><p>{auth.user?.role ?? 'Guest'}</p><p>{route.pathname}</p><button onClick={auth.logout}>Logout</button><button onClick={auth.logoutAll}>Logout all</button></>; }
function mount(role = 'CITIZEN') {
  return render(<MemoryRouter initialEntries={['/protected/deep-link']}><AuthProvider><Routes><Route path="/protected/deep-link" element={<ProtectedRoute roles={[role]}><Probe /></ProtectedRoute>} /><Route path="/login" element={<p>Login screen</p>} /></Routes></AuthProvider></MemoryRouter>);
}
beforeEach(() => { vi.clearAllMocks(); tokenStore.clear(); localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('cmk.csrf.v1', 'csrf'); });
afterEach(() => { tokenStore.clear(); vi.restoreAllMocks(); });

it.each(['CITIZEN', 'CMO_ADMIN', 'DEPARTMENT_OFFICER'])('restores %s on a direct protected route and keeps a valid session on focus/tab return', async (role) => {
  authApi.refreshApi.mockResolvedValue({ ...response, user: { ...user, role } });
  mount(role);
  expect(screen.queryByText('Login screen')).not.toBeInTheDocument();
  await screen.findByText(role);
  act(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
  expect(authApi.refreshApi).toHaveBeenCalledTimes(1);
  expect(screen.getByText('/protected/deep-link')).toBeInTheDocument();
});

it('refreshes an access token that expired while the tab was inactive', async () => {
  authApi.refreshApi.mockResolvedValue(response); mount();
  await screen.findByText('CITIZEN');
  act(() => tokenStore.set('expired', 'csrf', { user, expires_in: -1 }));
  act(() => window.dispatchEvent(new Event('focus')));
  await vi.waitFor(() => expect(authApi.refreshApi).toHaveBeenCalledTimes(2));
  expect(screen.queryByText('Login screen')).not.toBeInTheDocument();
});

it('retains the protected destination and saved nonce during an offline reload, then retries restoration', async () => {
  authApi.refreshApi.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(response);
  mount();
  await screen.findByText('Session temporarily unavailable');
  expect(screen.queryByText('Login screen')).not.toBeInTheDocument();
  expect(restoredCsrfToken()).toBe('csrf');
  fireEvent.click(screen.getByText('Retry session check'));
  await screen.findByText('CITIZEN');
  expect(screen.getByText('/protected/deep-link')).toBeInTheDocument();
});

it('redirects only after the backend conclusively rejects a refresh session', async () => {
  authApi.refreshApi.mockRejectedValue({ response: { status: 401 } }); mount();
  expect(await screen.findByText('Login screen')).toBeInTheDocument();
  expect(restoredCsrfToken()).toBeNull();
});

it('keeps signed-in UI and nonce through a temporary focus-refresh outage', async () => {
  authApi.refreshApi.mockResolvedValueOnce(response).mockRejectedValueOnce({ response: { status: 503 } }); mount();
  await screen.findByText('CITIZEN');
  act(() => tokenStore.set('expired', 'csrf', { user, expires_in: -1 }));
  act(() => window.dispatchEvent(new Event('focus')));
  await vi.waitFor(() => expect(authApi.refreshApi).toHaveBeenCalledTimes(2));
  expect(screen.getByText('CITIZEN')).toBeInTheDocument();
  expect(restoredCsrfToken()).toBe('csrf');
  act(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
  expect(authApi.refreshApi).toHaveBeenCalledTimes(2);
});

it.each(['Logout', 'Logout all'])('preserves explicit %s behavior', async (label) => {
  authApi.refreshApi.mockResolvedValue(response); authApi.logoutApi.mockResolvedValue(); authApi.logoutAllApi.mockResolvedValue(); mount();
  await screen.findByText('CITIZEN'); fireEvent.click(screen.getByText(label));
  await screen.findByText('Login screen');
  expect(label === 'Logout' ? authApi.logoutApi : authApi.logoutAllApi).toHaveBeenCalledWith('csrf');
});
