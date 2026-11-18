import { Fragment } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { PageLoader } from '../ui/index.jsx';

const ROLE_HOME = {
  CITIZEN: '/citizen/dashboard',
  CMO_ADMIN: '/cmo/dashboard',
  DEPARTMENT_OFFICER: '/officer/dashboard',
};

// GuestRoute and LoginPage must agree: otherwise GuestRoute's role-home redirect can
// win the render race and discard the return path immediately after login.
export function authDestination(user, from) {
  const home = ROLE_HOME[user.role] ?? '/';
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//') || /[\\\u0000-\u001f?#]/.test(from)) return home;
  const prefix = home.slice(0, home.lastIndexOf('/'));
  if (prefix && (from === prefix || from.startsWith(`${prefix}/`))) return from;
  if (['CITIZEN', 'CMO_ADMIN'].includes(user.role) && (from === '/track' || from.startsWith('/track/'))) return from;
  return home;
}

/**
 * ProtectedRoute — wrap any route that requires authentication.
 *
 * Props:
 *   roles      : string[]  — allowed UserRole values; omit to allow any authenticated user
 *   redirectTo : string    — where to send unauthenticated users (default "/login")
 */
export default function ProtectedRoute({ roles, redirectTo = '/login', children }) {
  const { user, loading, sessionUnavailable, error, retrySession } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;

  if (!user && sessionUnavailable) return <SessionRecovery error={error} retry={retrySession} />;

  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Fragment key={`${user.id}:${user.role}`}>{children}</Fragment>;
}

/**
 * GuestRoute — redirect already-authenticated users to their home portal.
 * Use on /login and /register to avoid showing auth forms to logged-in users.
 */
export function GuestRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;
  if (user) {
    const home = authDestination(user, location.state?.from?.pathname);
    return <Navigate to={home} replace />;
  }
  return children;
}

function SessionRecovery({ error, retry }) {
  return <section className="mx-auto max-w-xl space-y-4 p-6"><h1 className="text-xl">Session temporarily unavailable</h1><p role="alert">{error}</p><button type="button" className="rounded bg-teal-600 px-4 py-2 text-white focus-visible:ring-2" onClick={retry}>Retry session check</button><p><Link className="text-teal-700 underline" to="/login">Sign in manually</Link></p></section>;
}
