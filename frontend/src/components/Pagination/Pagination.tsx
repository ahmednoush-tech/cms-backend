import { useTranslation } from 'react-i18next';
import type { PaginationMeta } from '../../types/api';

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}

/**
 * Consumes { page, pageSize, total, totalPages } exactly as
 * returned by the backend's buildMeta() (confirmed this session,
 * common/dto/pagination-query.dto.ts) — no reimplementation of
 * the page-count math per page that uses this.
 */
export function Pagination({ meta, onPageChange }: PaginationProps) {
  const { t } = useTranslation('common');
  const { page, totalPages, total } = meta;

  if (total === 0) return null;

  return (
    <div className="flex items-center justify-between border-t border-border pt-3 text-sm text-ink-muted">
      <span>{t('pagination.summary', { page, totalPages, total })}</span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded border border-border px-2 py-1 disabled:opacity-40"
        >
          {t('pagination.previous')}
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded border border-border px-2 py-1 disabled:opacity-40"
        >
          {t('pagination.next')}
        </button>
      </div>
    </div>
  );
}
