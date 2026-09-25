import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-xl font-semibold text-ink">Page not found</h1>
      <p className="max-w-md text-sm text-ink-muted">The page you're looking for doesn't exist.</p>
      <Link to="/dashboard" className="mt-2 text-sm font-medium text-primary hover:underline">
        ← Back to Dashboard
      </Link>
    </div>
  );
}
