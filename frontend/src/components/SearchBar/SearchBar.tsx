import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '../../hooks/useDebounce';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** Writes to the `search` query param every resource's list DTO declares (confirmed shared field on PaginationQueryDto). */
export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  const { t } = useTranslation('common');
  const [draft, setDraft] = useState(value);
  const debounced = useDebounce(draft, 350);

  useEffect(() => {
    if (debounced !== value) onChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <input
      type="search"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      placeholder={placeholder ?? t('search.placeholder')}
      className="w-full max-w-xs rounded border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary/40"
    />
  );
}
