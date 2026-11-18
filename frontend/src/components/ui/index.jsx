/**
 * Shared UI primitives — no business logic, no API calls.
 * Import from here: import { Button, Input, ... } from '../components/ui';
 */

// ── Button ────────────────────────────────────────────────────────────────────
const VARIANT = {
  primary:
    'bg-teal-600 text-white hover:bg-teal-700 focus-visible:ring-teal-500 disabled:bg-teal-300',
  secondary:
    'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus-visible:ring-slate-400 disabled:opacity-50',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 disabled:bg-red-300',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400 disabled:opacity-40',
  nav:
    'bg-transparent text-white/80 hover:text-white hover:bg-white/10 focus-visible:ring-white disabled:opacity-40',
};

const SIZE = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-2.5 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  children,
  ...props
}) {
  return (
    <button
      className={[
        'inline-flex items-center justify-center gap-2 rounded-md font-medium',
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
        VARIANT[variant] ?? VARIANT.primary,
        SIZE[size] ?? SIZE.md,
        loading ? 'opacity-70 pointer-events-none' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
      disabled={loading || props.disabled}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function Input({ label, error, hint, id, className = '', ...props }) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-slate-700"
        >
          {label}
          {props.required && <span className="ml-0.5 text-red-500" aria-hidden>*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={[
          'w-full rounded-md border px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400',
          'transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent',
          error
            ? 'border-red-400 bg-red-50'
            : 'border-slate-300 bg-white hover:border-slate-400',
          props.disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ className = '', children, ...props }) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────
const SPINNER_SIZE = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' };

export function Spinner({ size = 'md', className = '' }) {
  return (
    <svg
      className={`animate-spin text-current ${SPINNER_SIZE[size] ?? SPINNER_SIZE.md} ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

// ── Alert ─────────────────────────────────────────────────────────────────────
const ALERT_STYLE = {
  error: 'bg-red-50 border-red-300 text-red-800',
  success: 'bg-green-50 border-green-300 text-green-800',
  info: 'bg-blue-50 border-blue-300 text-blue-800',
  warning: 'bg-amber-50 border-amber-300 text-amber-800',
};

export function Alert({ type = 'info', children, className = '' }) {
  return (
    <div
      role="alert"
      className={`rounded-md border px-4 py-3 text-sm ${ALERT_STYLE[type] ?? ALERT_STYLE.info} ${className}`}
    >
      {children}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
const STATUS_STYLE = {
  SUBMITTED: 'bg-blue-100 text-blue-800',
  UNDER_REVIEW: 'bg-purple-100 text-purple-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  RESOLVED: 'bg-green-100 text-green-800',
  REOPENED: 'bg-orange-100 text-orange-800',
};

const STATUS_LABEL = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  REOPENED: 'Reopened',
};

const PRIORITY_STYLE = {
  LOW: 'bg-slate-100 text-slate-700',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-red-100 text-red-800',
};

export function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_STYLE[priority] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {priority}
    </span>
  );
}

// ── PageLoader ────────────────────────────────────────────────────────────────
export function PageLoader({ message = 'Loading…' }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4 text-slate-500">
        <Spinner size="lg" />
        <p className="text-sm">{message}</p>
      </div>
    </div>
  );
}
