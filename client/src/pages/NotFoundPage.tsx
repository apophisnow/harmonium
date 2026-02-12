import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-th-bg-tertiary p-4 text-center">
      <h1 className="mb-2 text-6xl font-bold text-th-text-primary">404</h1>
      <p className="mb-6 text-lg text-th-text-secondary">
        The page you're looking for doesn't exist.
      </p>
      <Link
        to="/"
        className="rounded bg-th-brand px-6 py-2.5 font-medium text-white hover:bg-th-brand-hover transition-colors"
      >
        Go Home
      </Link>
    </div>
  );
}
