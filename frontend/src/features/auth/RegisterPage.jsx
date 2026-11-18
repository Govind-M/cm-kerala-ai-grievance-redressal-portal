import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { Alert, Button, Card, Input } from '../../components/ui/index.jsx';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fields, setFields] = useState({
    name: '',
    email: '',
    mobile_number: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function set(key) {
    return (e) => setFields((f) => ({ ...f, [key]: e.target.value }));
  }

  function validate() {
    const e = {};
    if (!fields.name.trim()) e.name = 'Full name is required.';
    if (!fields.email.trim()) e.email = 'Email is required.';
    if (!fields.mobile_number.trim()) e.mobile_number = 'Mobile number is required.';
    if (fields.password.length < 12) e.password = 'Password must be at least 12 characters.';
    if (fields.password !== fields.confirmPassword) e.confirmPassword = 'Passwords do not match.';
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
      await register({
        name: fields.name.trim(),
        email: fields.email.trim(),
        mobile_number: fields.mobile_number.trim(),
        password: fields.password,
      });
      setSuccess(true);
    } catch (err) {
      setServerError(err.userMessage ?? 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-100">
            <svg className="h-7 w-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-slate-900">Account Created</h2>
          <p className="mb-6 text-sm text-slate-500">
            Your citizen account has been created successfully. You can now sign in.
          </p>
          <Button onClick={() => navigate('/login')} className="w-full">
            Sign In
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#0f172a]">
            <span className="text-lg font-bold text-teal-400">KL</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Create Citizen Account</h1>
          <p className="mt-1 text-sm text-slate-500">Register to submit and track grievances</p>
        </div>

        <Card className="p-8">
          {serverError && (
            <Alert type="error" className="mb-6">{serverError}</Alert>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <Input
              label="Full name"
              id="name"
              type="text"
              autoComplete="name"
              required
              value={fields.name}
              onChange={set('name')}
              error={errors.name}
              disabled={loading}
            />
            <Input
              label="Email address"
              id="email"
              type="email"
              autoComplete="email"
              required
              value={fields.email}
              onChange={set('email')}
              error={errors.email}
              disabled={loading}
            />
            <Input
              label="Mobile number"
              id="mobile_number"
              type="tel"
              autoComplete="tel"
              required
              placeholder="+919876543210"
              hint="8–15 digits, may include leading +"
              value={fields.mobile_number}
              onChange={set('mobile_number')}
              error={errors.mobile_number}
              disabled={loading}
            />
            <Input
              label="Password"
              id="password"
              type="password"
              autoComplete="new-password"
              required
              hint="Minimum 12 characters"
              value={fields.password}
              onChange={set('password')}
              error={errors.password}
              disabled={loading}
            />
            <Input
              label="Confirm password"
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={fields.confirmPassword}
              onChange={set('confirmPassword')}
              error={errors.confirmPassword}
              disabled={loading}
            />

            <Button type="submit" className="w-full" loading={loading} size="lg">
              {loading ? 'Creating account…' : 'Create Account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-teal-600 hover:text-teal-800">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
