/**
 * PublicLayout — government-service-style header + footer wrapping public pages.
 */
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import PrototypeNotice from '../components/shared/PrototypeNotice.jsx';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/departments', label: 'Departments' },
  { to: '/track', label: 'Track Grievance' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
];

export default function PublicLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const menuToggle = useRef(null);
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  function active(to) {
    return location.pathname === to || (to === '/track' && location.pathname.startsWith('/track/'));
  }

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#public-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:p-3 focus:text-slate-900">Skip to main content</a>

      {/* ── Header ── */}
      <header className="bg-[#0f172a] text-white shadow-md">
        {/* Prototype identity bar */}
        <div className="border-b border-white/10 bg-[#0a0f1e]">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2">
            {/* Initials badge, not an official government emblem */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
              KL
            </div>
            <div>
              <p className="text-xs text-white/70">Public grievance redressal</p>
              <p className="text-sm font-semibold leading-tight">
                CM Kerala — Public Grievance Redressal Portal
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="mx-auto max-w-7xl px-4" aria-label="Main navigation">
          <div className="flex h-14 items-center justify-between">
            <Link to="/" className="text-base font-semibold text-white hover:text-teal-400 transition-colors">
              CM Kerala Portal
            </Link>

            {/* Desktop nav */}
            <ul className="hidden gap-1 xl:flex">
              {NAV_LINKS.map(({ to, label }) => (
                <li key={to}>
                  <Link
                    to={to}
                    aria-current={active(to) ? 'page' : undefined}
                    className={[
                      'rounded px-3 py-1.5 text-sm transition-colors',
                      active(to)
                        ? 'bg-teal-600 text-white'
                        : 'text-white/80 hover:text-white hover:bg-white/10',
                    ].join(' ')}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="hidden min-h-11 items-center rounded border border-teal-500 px-4 py-1.5 text-sm text-teal-400 hover:bg-teal-600 hover:text-white transition-colors xl:inline-flex"
              >
                Sign In
              </Link>
              <Link to="/register" className="hidden min-h-11 items-center rounded bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-700 xl:inline-flex">Register</Link>
              {/* Mobile menu toggle */}
              <button
                className="min-h-11 min-w-11 rounded p-2 text-white/80 hover:bg-white/10 xl:hidden"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={menuOpen}
                aria-controls="public-mobile-navigation"
                ref={menuToggle}
                onKeyDown={(event) => { if (event.key === 'Escape') setMenuOpen(false); }}
                onClick={() => setMenuOpen((v) => !v)}
              >
                {menuOpen ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                )}
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {menuOpen && (
            <div id="public-mobile-navigation" className="border-t border-white/10 pb-4 xl:hidden" onKeyDown={(event) => { if (event.key === 'Escape') { setMenuOpen(false); menuToggle.current?.focus(); } }}>
              <ul className="mt-2 flex flex-col gap-1">
                {NAV_LINKS.map(({ to, label }) => (
                  <li key={to}>
                    <Link
                      to={to}
                      aria-current={active(to) ? 'page' : undefined}
                      onClick={() => setMenuOpen(false)}
                      className="block min-h-11 rounded px-3 py-3 text-sm text-white/80 hover:bg-white/10 hover:text-white"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="mt-2 block min-h-11 rounded bg-teal-600 px-3 py-3 text-sm text-white hover:bg-teal-700"
                  >
                    Sign In
                  </Link>
                </li>
                <li><Link to="/register" onClick={() => setMenuOpen(false)} className="block min-h-11 rounded px-3 py-3 text-sm text-teal-300 hover:bg-white/10">Register</Link></li>
              </ul>
            </div>
          )}
        </nav>
      </header>

      {/* ── Main content ── */}
      <main id="public-main" tabIndex={-1} className="min-w-0 flex-1">
        <Outlet />
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200 bg-[#0f172a] text-white/70">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <div className="grid gap-8 sm:grid-cols-3">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-white">CM Kerala Portal</h3>
              <p className="text-xs leading-relaxed">
                AI-assisted grievance handling with human oversight.
              </p>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold text-white">Quick Links</h3>
              <ul className="space-y-1.5 text-xs">
                {NAV_LINKS.map(({ to, label }) => (
                  <li key={to}>
                    <Link to={to} className="hover:text-teal-400 transition-colors">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold text-white">Portals</h3>
              <ul className="space-y-1.5 text-xs">
                <li><Link to="/login" className="hover:text-teal-400 transition-colors">Citizen Login</Link></li>
                <li><Link to="/login" className="hover:text-teal-400 transition-colors">CMO Admin Login</Link></li>
                <li><Link to="/login" className="hover:text-teal-400 transition-colors">Officer Login</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-white/10 pt-6 text-center text-xs text-white/70">
            <p className="mb-2">© {new Date().getFullYear()} CM Kerala Portal</p>
            <PrototypeNotice />
          </div>
        </div>
      </footer>
    </div>
  );
}
