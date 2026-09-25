import { useCustomFieldDefinitions } from '../../api/queries/useCustomFieldDefinitions';
import type { CustomFieldEntityType } from '../../types/entities/customField';

interface CustomFieldsDisplayProps {
  entityType: CustomFieldEntityType;
  customFields: Record<string, string | number> | null;
}

/**
 * Cross-references stored customFields values against ALL
 * definitions (active + inactive) so a value under a
 * since-deactivated field still displays with its real label, not
 * just its raw JSON key.
 */
export function CustomFieldsDisplay({ entityType, customFields }: CustomFieldsDisplayProps) {
  const { data: definitions } = useCustomFieldDefinitions(entityType);

  const entries = Object.entries(customFields ?? {});
  if (entries.length === 0) return null;

  return (
    <dl className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
      {entries.map(([key, value]) => {
        const definition = definitions?.find((d) => d.fieldKey === key);
        return (
          <div key={key}>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{definition?.label ?? key}</dt>
            <dd className="mt-0.5 text-sm text-ink">{String(value)}</dd>
          </div>
        );
      })}
    </dl>
  );
}
