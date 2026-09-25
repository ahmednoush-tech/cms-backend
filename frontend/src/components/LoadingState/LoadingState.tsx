import clsx from 'clsx';

interface LoadingStateProps {
  variant?: 'page' | 'table' | 'card' | 'inline';
  rows?: number;
}

/**
 * Skeleton placeholders matching each context's real layout —
 * never a generic full-page spinner below the initial app-shell
 * load (design doc section F).
 */
export function LoadingState({ variant = 'inline', rows = 5 }: LoadingStateProps) {
  if (variant === 'page') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface">
        <div className="h-10 w-10 animate-pulse rounded-full bg-primary/20" role="status" aria-label="Loading" />
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className="space-y-2" role="status" aria-label="Loading">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-10 w-full animate-pulse rounded bg-surface-muted" />
        ))}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div
        className="h-28 w-full animate-pulse rounded-lg bg-surface-muted"
        role="status"
        aria-label="Loading"
      />
    );
  }

  return (
    <span
      className={clsx('inline-block h-4 w-24 animate-pulse rounded bg-surface-muted')}
      role="status"
      aria-label="Loading"
    />
  );
}
