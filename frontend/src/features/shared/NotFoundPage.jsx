import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="mb-2 text-6xl font-bold text-teal-600">404</p>
        <h1 className="mb-3 text-2xl font-bold text-slate-900">Page not found</h1>
        <p className="mb-6 text-slate-500">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center rounded-md bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-700"
        >
          Return to home
        </Link>
      </div>
    </div>
  );
}
