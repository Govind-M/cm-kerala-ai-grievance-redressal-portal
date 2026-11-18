import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext.jsx';
import ProtectedRoute, { authDestination, GuestRoute } from '../components/shared/ProtectedRoute.jsx';
import LoginPage from '../features/auth/LoginPage.jsx';
import RegisterPage from '../features/auth/RegisterPage.jsx';
import { tokenStore } from '../services/api.js';
import * as authApi from '../services/authApi.js';

vi.mock('../services/authApi.js', () => ({ getMeApi: vi.fn(), loginApi: vi.fn(), logoutApi: vi.fn(), refreshApi: vi.fn(), registerApi: vi.fn() }));
const user = { id: 'citizen', name: 'Fictional Citizen', role: 'CITIZEN' };

it.each(['https://evil.example', '//evil.example', '/\\evil.example', '/cmo/grievances', '/login', '/track/ref?token=secret'])('rejects unsafe or wrong-role return destination %s', (path) => {
  expect(authDestination(user, path)).toBe('/citizen/dashboard');
});

beforeEach(() => {
  vi.clearAllMocks();
  tokenStore.clear();
  authApi.refreshApi.mockRejectedValue(new Error('No session'));
  authApi.loginApi.mockResolvedValue({ user, access_token: 'test-access', csrf_token: 'test-csrf' });
});

it.each([
  ['CITIZEN', '/citizen/dashboard'],
  ['CMO_ADMIN', '/cmo/dashboard'],
  ['DEPARTMENT_OFFICER', '/officer/dashboard'],
])('redirects %s to the correct role home', (role, home) => {
  expect(authDestination({ ...user, role })).toBe(home);
});

it('registers only citizen fields and requires separate sign-in', async () => {
  authApi.registerApi.mockResolvedValue(user);
  render(<MemoryRouter><AuthProvider><RegisterPage /></AuthProvider></MemoryRouter>);
  await screen.findByRole('button', { name: 'Create Account' });
  for (const [label, value] of [
    [/full name/i, 'Fictional Citizen'], [/email address/i, 'fictional@example.test'],
    [/mobile number/i, '+919876543210'], [/^password/i, 'fictional-password'],
    [/confirm password/i, 'fictional-password'],
  ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
  expect(await screen.findByText('Account Created')).toBeInTheDocument();
  expect(authApi.registerApi).toHaveBeenCalledWith({
    name: 'Fictional Citizen', email: 'fictional@example.test',
    mobile_number: '+919876543210', password: 'fictional-password',
  });
  expect(authApi.loginApi).not.toHaveBeenCalled();
  expect(tokenStore.accessToken).toBeNull();
});

it('retains the protected-route login and F2 tracking return flow', async () => {
  render(<MemoryRouter initialEntries={['/track/CMK-2026-A7F29C810D59E246']}><AuthProvider><Routes>
    <Route path="/track/:reference" element={<ProtectedRoute roles={['CITIZEN', 'CMO_ADMIN']}><p>Authorized tracking destination</p></ProtectedRoute>} />
    <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
    <Route path="/citizen/dashboard" element={<p>Citizen dashboard</p>} />
  </Routes></AuthProvider></MemoryRouter>);
  await screen.findByRole('button', { name: 'Sign In' });
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'fictional@example.com' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'test-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
  expect(await screen.findByText('Authorized tracking destination')).toBeInTheDocument();
  expect(tokenStore.accessToken).toBe('test-access');
  expect(tokenStore.csrfToken).toBe('test-csrf');
  expect(localStorage.getItem('access_token')).toBeNull();
});

it.each(['CMO_ADMIN', 'DEPARTMENT_OFFICER'])('retains role denial for %s on a citizen route', async (role) => {
  sessionStorage.setItem('cmk.csrf.v1', 'test-csrf');
  authApi.refreshApi.mockResolvedValue({ user: { ...user, role }, access_token: 'test-access', csrf_token: 'test-csrf' });
  render(<MemoryRouter initialEntries={['/citizen/submit']}><AuthProvider><Routes>
    <Route path="/citizen/submit" element={<ProtectedRoute roles={['CITIZEN']}><p>Citizen-only content</p></ProtectedRoute>} />
    <Route path="/unauthorized" element={<p>Permission denied</p>} />
  </Routes></AuthProvider></MemoryRouter>);
  expect(await screen.findByText('Permission denied')).toBeInTheDocument();
  expect(screen.queryByText('Citizen-only content')).not.toBeInTheDocument();
});

it('retains logout clearing of in-memory access and CSRF tokens', async () => {
  sessionStorage.setItem('cmk.csrf.v1', 'test-csrf');
  authApi.refreshApi.mockResolvedValue({ user, access_token: 'test-access', csrf_token: 'test-csrf' });
  authApi.logoutApi.mockResolvedValue(undefined);
  function Probe() {
    const context = useAuth();
    return <><p>{context.user ? 'Signed in' : context.loading ? 'Loading' : 'Signed out'}</p><button onClick={context.logout}>Logout</button></>;
  }
  render(<AuthProvider><Probe /></AuthProvider>);
  await screen.findByText('Signed in');
  fireEvent.click(screen.getByText('Logout'));
  expect(await screen.findByText('Signed out')).toBeInTheDocument();
  expect(tokenStore.accessToken).toBeNull();
  expect(tokenStore.csrfToken).toBeNull();
});
