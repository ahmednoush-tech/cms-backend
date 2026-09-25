import { useTranslation } from 'react-i18next';
import { useActiveCustomFieldDefinitions } from '../../api/queries/useCustomFieldDefinitions';
import type { CustomFieldEntityType } from '../../types/entities/customField';

interface DynamicCustomFieldsProps {
  entityType: CustomFieldEntityType;
  values: Record<string, string>;
  onChange: (fieldKey: string, value: string) => void;
}

/**
 * Renders one input per ACTIVE custom field definition, typed
 * according to fieldType (text/number/date/select) — the form
 * itself has zero hardcoded knowledge of which custom fields
 * exist; it only knows how to render each of the 4 supported
 * field TYPES generically.
 */
export function DynamicCustomFields({ entityType, values, onChange }: DynamicCustomFieldsProps) {
  const { t } = useTranslation(['customFields']);
  const { data: definitions, isLoading } = useActiveCustomFieldDefinitions(entityType);

  if (isLoading || !definitions || definitions.length === 0) return null;

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="mb-2 text-sm font-medium text-ink">{t('customFields:sectionTitle')}</p>
      <div className="grid grid-cols-2 gap-3">
        {definitions.map((def) => (
          <div key={def.id}>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              {def.label}
              {def.isRequired && <span className="text-danger"> *</span>}
            </label>
            {def.fieldType === 'select' ? (
              <select
                required={def.isRequired}
                value={values[def.fieldKey] ?? ''}
                onChange={(e) => onChange(def.fieldKey, e.target.value)}
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink"
              >
                <option value="">{t('customFields:selectPlaceholder')}</option>
                {(def.selectOptions ?? []).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                type={def.fieldType === 'number' ? 'number' : def.fieldType === 'date' ? 'date' : 'text'}
                required={def.isRequired}
                value={values[def.fieldKey] ?? ''}
                onChange={(e) => onChange(def.fieldKey, e.target.value)}
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
