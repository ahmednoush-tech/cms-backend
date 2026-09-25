import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  breadcrumb?: ReactNode;
  action?: ReactNode;
}

export function PageHeader({ title, breadcrumb, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {breadcrumb && <div className="mb-1 text-xs text-ink-muted">{breadcrumb}</div>}
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
