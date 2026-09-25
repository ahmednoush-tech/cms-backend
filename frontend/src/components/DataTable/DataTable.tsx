import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadingState } from '../LoadingState/LoadingState';
import { EmptyState } from '../EmptyState/EmptyState';
import { ErrorState } from '../ErrorState/ErrorState';
import { Pagination } from '../Pagination/Pagination';
import type { PaginationMeta } from '../../types/api';
import { ApiError } from '../../api/client';

export interface DataTableColumn<T> {
  key: string;
  headerKey: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>;
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  isLoading: boolean;
  error: unknown;
  meta?: PaginationMeta;
  onPageChange?: (page: number) => void;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSortChange?: (sortBy: string) => void;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRowClick?: (row: T) => void;
}

/**
 * A page passes columns + a React Query result — DataTable owns
 * loading/empty/error rendering internally (design doc section K)
 * rather than every page reimplementing that branching. Column
 * definitions are intentionally generic (no resource-specific
 * logic lives here); resource pages built in 3B-3F supply their
 * own column configs.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  error,
  meta,
  onPageChange,
  sortBy,
  sortDir,
  onSortChange,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onRowClick,
}: DataTableProps<T>) {
  const { t } = useTranslation('common');

  if (isLoading) return <LoadingState variant="table" />;

  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    const variant = apiError?.status === 403 ? 'forbidden' : apiError?.status === 404 ? 'not-found' : 'generic';
    return <ErrorState variant={variant} message={apiError?.message} />;
  }

  if (!rows || rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-start text-sm">
          <thead className="border-b border-border bg-surface-muted text-xs font-medium uppercase tracking-wide text-ink-muted">
            <tr>
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-2.5 text-start">
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => onSortChange?.(col.key)}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      {t(col.headerKey)}
                      {sortBy === col.key && <span aria-hidden>{sortDir === 'asc' ? '▲' : '▼'}</span>}
                    </button>
                  ) : (
                    t(col.headerKey)
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? 'cursor-pointer hover:bg-surface-muted' : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-2.5 text-ink">
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {meta && onPageChange && (
        <div className="mt-3">
          <Pagination meta={meta} onPageChange={onPageChange} />
        </div>
      )}
    </div>
  );
}
