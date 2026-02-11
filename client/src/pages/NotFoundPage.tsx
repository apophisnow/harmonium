import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#202225] p-4 text-center">
      <h1 className="mb-2 text-6xl font-bold text-[#dcddde]">404</h1>
      <p className="mb-6 text-lg text-[#96989d]">
        The page you're looking for doesn't exist.
      </p>
      <Link
        to="/"
        className="rounded bg-[#5865f2] px-6 py-2.5 font-medium text-white hover:bg-[#4752c4] transition-colors"
      >
        Go Home
      </Link>
    </div>
  );
}
