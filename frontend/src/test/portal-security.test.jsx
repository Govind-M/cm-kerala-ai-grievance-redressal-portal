import { beforeEach, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../components/shared/ProtectedRoute.jsx';
import PortalShell from '../layouts/PortalShell.jsx';
import { Button } from '../components/ui/index.jsx';

const auth = vi.hoisted(() => ({ user: null, loading: false, logout: vi.fn() }));
vi.mock('../context/AuthContext.jsx', () => ({ useAuth: () => auth }));
beforeEach(() => { auth.user = null; auth.loading = false; vi.clearAllMocks(); });
it.each([
  ['CITIZEN', 'CMO_ADMIN'], ['CITIZEN', 'DEPARTMENT_OFFICER'],
  ['CMO_ADMIN', 'CITIZEN'], ['CMO_ADMIN', 'DEPARTMENT_OFFICER'],
  ['DEPARTMENT_OFFICER', 'CITIZEN'], ['DEPARTMENT_OFFICER', 'CMO_ADMIN'],
])('isolates %s from a %s portal', (actual, required) => {
  auth.user = { id: 'user', role: actual };
  render(<MemoryRouter><Routes><Route path="/" element={<ProtectedRoute roles={[required]}><p>Private data</p></ProtectedRoute>} /><Route path="/unauthorized" element={<p>Denied</p>} /></Routes></MemoryRouter>);
  expect(screen.getByText('Denied')).toBeInTheDocument(); expect(screen.queryByText('Private data')).not.toBeInTheDocument();
});
it('requires authentication before mounting portal data views', () => {
  const privateLoader = vi.fn(); function Private() { privateLoader(); return <p>Private</p>; }
  render(<MemoryRouter><Routes><Route path="/" element={<ProtectedRoute roles={['CITIZEN']}><Private /></ProtectedRoute>} /><Route path="/login" element={<p>Sign in</p>} /></Routes></MemoryRouter>);
  expect(screen.getByText('Sign in')).toBeInTheDocument(); expect(privateLoader).not.toHaveBeenCalled();
});
it('remounts private local state on identity change', () => {
  auth.user = { id: 'first', role: 'CITIZEN' };
  const element = () => <MemoryRouter><ProtectedRoute roles={['CITIZEN']}><input aria-label="Private draft" defaultValue="" /></ProtectedRoute></MemoryRouter>;
  const view = render(element()); fireEvent.change(screen.getByLabelText('Private draft'), { target: { value: 'First user text' } });
  auth.user = { id: 'second', role: 'CITIZEN' }; view.rerender(element());
  expect(screen.getByLabelText('Private draft')).toHaveValue('');
});
it('preserves the prototype disclaimer and keyboard-dismissable mobile navigation', () => {
  auth.user = { id: 'user', name: 'Fictional Citizen', role: 'CITIZEN' };
  render(<MemoryRouter><PortalShell title="Citizen Portal" navLinks={[{ to: '/citizen/dashboard', label: 'Dashboard' }]} /></MemoryRouter>);
  expect(screen.getByText(/Independent demonstration project/)).toBeInTheDocument();
  const trigger = screen.getByRole('button', { name: 'Open sidebar' }); fireEvent.click(trigger);
  const dialog = screen.getByRole('dialog', { name: 'Portal navigation menu' });
  expect(within(dialog).getByText('Close navigation')).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'true'); fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(trigger).toHaveFocus();
});
it('cannot override a busy shared button by passing disabled=false', () => {
  render(<Button loading disabled={false}>Save</Button>);
  expect(screen.getByRole('button')).toBeDisabled();
});
