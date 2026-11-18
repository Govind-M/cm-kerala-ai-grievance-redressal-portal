import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function UnauthorizedPage() {
  const { user } = useAuth();
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
          </svg>
        </div>
        <h1 className="mb-3 text-2xl font-bold text-slate-900">Access Denied</h1>
        <p className="mb-6 text-slate-500">
          You do not have permission to view this page.
        </p>
        {user ? (
          <Link
            to={
              user.role === 'CMO_ADMIN'
                ? '/cmo/dashboard'
                : user.role === 'DEPARTMENT_OFFICER'
                ? '/officer/dashboard'
                : '/citizen/dashboard'
            }
            className="inline-flex items-center rounded-md bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
          >
            Go to your dashboard
          </Link>
        ) : (
          <Link
            to="/login"
            className="inline-flex items-center rounded-md bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
          >
            Sign In
          </Link>
        )}
      </div>
    </div>
  );
}
