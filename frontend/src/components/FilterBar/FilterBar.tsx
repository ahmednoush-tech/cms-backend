import { useTranslation } from 'react-i18next';

export type FilterFieldType = 'select' | 'date' | 'text';

export interface FilterFieldConfig {
  key: string;
  labelKey: string;
  type: FilterFieldType;
  options?: Array<{ value: string; labelKey: string }>;
}

interface FilterBarProps {
  fields: FilterFieldConfig[];
  values: Record<string, string | undefined>;
  onChange: (key: string, value: string | undefined) => void;
  onClear: () => void;
}

/**
 * Config-driven per resource (design doc section K) — NOT a
 * generic "any filter" builder. Each resource's `fields` config
 * must be built from that resource's actual backend *FiltersDto
 * field list (e.g. Projects -> customerId, status only), since
 * the backend's whitelist+forbidNonWhitelisted pipe (confirmed
 * this session) rejects any query param not explicitly declared
 * on that endpoint's DTO. This component itself has no knowledge
 * of any specific resource — the config passed in is what encodes
 * that contract, defined per-page in Phase 3C/3D.
 */
export function FilterBar({ fields, values, onChange, onClear }: FilterBarProps) {
  const { t } = useTranslation('common');
  const hasActiveFilters = Object.values(values).some((v) => v);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {fields.map((field) => (
        <div key={field.key}>
          {field.type === 'select' && (
            <select
              value={values[field.key] ?? ''}
              onChange={(e) => onChange(field.key, e.target.value || undefined)}
              className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink"
            >
              <option value="">{t(field.labelKey)}</option>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          )}
          {field.type === 'date' && (
            <input
              type="date"
              value={values[field.key] ?? ''}
              onChange={(e) => onChange(field.key, e.target.value || undefined)}
              className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink"
            />
          )}
          {field.type === 'text' && (
            <input
              type="text"
              value={values[field.key] ?? ''}
              onChange={(e) => onChange(field.key, e.target.value || undefined)}
              placeholder={t(field.labelKey)}
              className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink"
            />
          )}
        </div>
      ))}
      {hasActiveFilters && (
        <button type="button" onClick={onClear} className="text-xs font-medium text-primary hover:underline">
          {t('filters.clear')}
        </button>
      )}
    </div>
  );
}
