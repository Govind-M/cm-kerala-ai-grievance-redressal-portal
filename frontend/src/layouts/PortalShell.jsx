/**
 * Shared portal shell — sidebar + topbar used by Citizen, CMO, and Officer layouts.
 * Not exported from layouts; used internally.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from '../components/ui/index.jsx';
import PrototypeNotice from '../components/shared/PrototypeNotice.jsx';

const ROLE_LABEL = {
  CITIZEN: 'Citizen',
  CMO_ADMIN: 'CMO Admin',
  DEPARTMENT_OFFICER: 'Officer',
};

const ROLE_COLOR = {
  CITIZEN: 'bg-teal-600',
  CMO_ADMIN: 'bg-indigo-700',
  DEPARTMENT_OFFICER: 'bg-violet-700',
};

export default function PortalShell({ navLinks, title, accentColor = 'bg-[#0f172a]' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const mobileMenu = useRef(null);
  const menuButton = useRef(null);
  useEffect(() => {
    if (!sidebarOpen) return;
    const first = mobileMenu.current?.querySelector('button, a');
    first?.focus();
    function keyboard(event) {
      if (event.key === 'Escape') { setSidebarOpen(false); return; }
      if (event.key !== 'Tab') return;
      const elements = [...mobileMenu.current.querySelectorAll('a, button:not(:disabled)')];
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', keyboard);
    const media = window.matchMedia?.('(min-width: 768px)');
    const resize = () => { if (media.matches) setSidebarOpen(false); };
    media?.addEventListener('change', resize);
    return () => { document.removeEventListener('keydown', keyboard); media?.removeEventListener('change', resize); menuButton.current?.focus(); };
  }, [sidebarOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  }

  const roleLabel = user ? (ROLE_LABEL[user.role] ?? user.role) : '';
  const roleColor = user ? (ROLE_COLOR[user.role] ?? 'bg-slate-600') : 'bg-slate-600';

  const SidebarContent = () => (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Logo */}
      <div className={`${accentColor} px-5 py-4`}>
        <Link to="/" className="flex items-center gap-2 text-white">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500 text-xs font-bold">KL</div>
          <span className="text-sm font-semibold leading-tight">CM Kerala Portal</span>
        </Link>
        <p className="mt-1 pl-10 text-xs text-white/60">{title}</p>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Portal navigation">
        <ul className="space-y-0.5">
          {navLinks.map(({ to, label, icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/officer/grievances'}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-teal-600 text-white font-medium'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  ].join(' ')
                }
              >
                {icon && <span className="shrink-0 text-current opacity-70">{icon}</span>}
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User info */}
      {user && (
        <div className="border-t border-slate-200 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${roleColor}`}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
              <p className="truncate text-xs text-slate-500">{roleLabel}</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            loading={loggingOut}
            onClick={handleLogout}
          >
            {loggingOut ? '' : 'Sign Out'}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <a href="#portal-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">Skip to portal content</a>
      {/* ── Desktop sidebar ── */}
      <aside inert={sidebarOpen} className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm md:flex">
        <SidebarContent />
      </aside>

      {/* ── Mobile sidebar overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside
            ref={mobileMenu}
            id="mobile-portal-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Portal navigation menu"
            className="absolute left-0 top-0 flex h-full w-64 max-w-[90vw] flex-col bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Button variant="secondary" size="sm" className="m-2" onClick={() => setSidebarOpen(false)}>Close navigation</Button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main area ── */}
      <div inert={sidebarOpen} className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className={`${accentColor} flex items-center justify-between px-4 py-3 text-white shadow-sm md:hidden`}>
          <button
            ref={menuButton}
            onClick={() => setSidebarOpen(true)}
            className="rounded p-1 hover:bg-white/10"
            aria-label="Open sidebar"
            aria-expanded={sidebarOpen}
            aria-controls="mobile-portal-navigation"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm font-semibold">{title}</span>
          {user && (
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${roleColor}`}>
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
        </header>

        {/* Page content */}
        <main id="portal-content" tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
          <footer className="mt-8 border-t border-slate-200 px-4 py-5 text-slate-500"><PrototypeNotice /></footer>
        </main>
      </div>
    </div>
  );
}
