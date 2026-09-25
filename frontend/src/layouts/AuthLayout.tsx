import type { ReactNode } from 'react';

/** No sidebar/topbar — used only by /login (design doc section F). */
export function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-surface-muted">{children}</div>;
}
