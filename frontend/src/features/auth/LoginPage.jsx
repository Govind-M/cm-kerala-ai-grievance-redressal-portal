import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Alert, Button, Card, Input } from '../../components/ui/index.jsx';
import { authDestination } from '../../components/shared/ProtectedRoute.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [fields, setFields] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname;

  function validate() {
    const e = {};
    if (!fields.email.trim()) e.email = 'Email is required.';
    if (!fields.password) e.password = 'Password is required.';
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError('');
    const e2 = validate();
    setErrors(e2);
    if (Object.keys(e2).length) return;

    setLoading(true);
    try {
      const user = await login(fields.email.trim(), fields.password);
      const dest = authDestination(user, from);
      navigate(dest, { replace: true });
    } catch (err) {
      setServerError(err.userMessage ?? 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#0f172a]">
            <span className="text-lg font-bold text-teal-400">KL</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">CM Kerala Portal</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your account</p>
        </div>

        <Card className="p-8">
          {serverError && (
            <Alert type="error" className="mb-6">
              {serverError}
            </Alert>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <Input
              label="Email address"
              id="email"
              type="email"
              autoComplete="email"
              required
              value={fields.email}
              onChange={(e) => setFields((f) => ({ ...f, email: e.target.value }))}
              error={errors.email}
              disabled={loading}
            />
            <Input
              label="Password"
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={fields.password}
              onChange={(e) => setFields((f) => ({ ...f, password: e.target.value }))}
              error={errors.password}
              disabled={loading}
            />

            <Button type="submit" className="w-full" loading={loading} size="lg">
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            New citizen?{' '}
            <Link to="/register" className="font-medium text-teal-600 hover:text-teal-800">
              Create an account
            </Link>
          </p>
        </Card>

        <p className="mt-6 text-center text-xs text-slate-400">
          CMO and Officer accounts are provisioned by administrators.
        </p>
      </div>
    </div>
  );
}
