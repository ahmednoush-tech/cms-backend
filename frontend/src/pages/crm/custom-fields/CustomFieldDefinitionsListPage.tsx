import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useCustomFieldDefinitions,
  useCreateCustomFieldDefinition,
  useDeactivateCustomFieldDefinition,
} from '../../../api/queries/useCustomFieldDefinitions';
import type { CustomFieldDefinition, CustomFieldEntityType, CustomFieldType } from '../../../types/entities/customField';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';

interface FormState {
  fieldKey: string;
  label: string;
  fieldType: CustomFieldType;
  selectOptionsText: string;
  isRequired: boolean;
}

const EMPTY_FORM: FormState = { fieldKey: '', label: '', fieldType: 'text', selectOptionsText: '', isRequired: false };
const ENTITY_TABS: CustomFieldEntityType[] = ['lead', 'opportunity', 'customer'];

export function CustomFieldDefinitionsListPage() {
  const { t } = useTranslation(['customFields', 'common']);
  const [activeEntityType, setActiveEntityType] = useState<CustomFieldEntityType>('lead');
  const { data: definitions, isLoading, error } = useCustomFieldDefinitions(activeEntityType);
  const createMutation = useCreateCustomFieldDefinition();
  const deactivateMutation = useDeactivateCustomFieldDefinition(activeEntityType);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  if (isLoading) return <LoadingState variant="page" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant="generic" message={apiError?.message} />;
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    createMutation.mutate(
      {
        entityType: activeEntityType,
        fieldKey: form.fieldKey,
        label: form.label,
        fieldType: form.fieldType,
        selectOptions:
          form.fieldType === 'select'
            ? form.selectOptionsText.split(',').map((s) => s.trim()).filter(Boolean)
            : undefined,
        isRequired: form.isRequired,
      },
      {
        onSuccess: () => {
          setForm(EMPTY_FORM);
          setFormOpen(false);
        },
        onError: (err) => setFormError(err instanceof ApiError ? err.message : t('common:error.generic')),
      },
    );
  };

  return (
    <div>
      <PageHeader
        title={t('customFields:title')}
        action={
          <PermissionGate requires={PERMISSIONS.CRM.customFields.create}>
            <button type="button" onClick={() => setFormOpen((v) => !v)} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {formOpen ? t('common:action.cancel') : t('customFields:actions.new')}
            </button>
          </PermissionGate>
        }
      />
      <p className="mb-4 max-w-2xl text-sm text-ink-muted">{t('customFields:description')}</p>

      <div className="mb-4 flex gap-1 border-b border-border">
        {ENTITY_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveEntityType(tab)}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              activeEntityType === tab ? 'border-primary text-primary' : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {t(`customFields:entityType.${tab}`)}
          </button>
        ))}
      </div>

      {formOpen && (
        <form onSubmit={handleCreate} noValidate className="mb-4 max-w-2xl rounded-lg border border-border bg-surface p-4">
          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">{t('customFields:fields.label')}</label>
              <input required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">{t('customFields:fields.fieldKey')}</label>
              <input
                required
                value={form.fieldKey}
                onChange={(e) => setForm({ ...form, fieldKey: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                placeholder={t('customFields:fields.fieldKeyHint')}
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink"
              />
            </div>
          </div>

          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-ink-muted">{t('customFields:fields.fieldType')}</label>
            <select value={form.fieldType} onChange={(e) => setForm({ ...form, fieldType: e.target.value as CustomFieldType })} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
              <option value="text">{t('customFields:fieldType.text')}</option>
              <option value="number">{t('customFields:fieldType.number')}</option>
              <option value="date">{t('customFields:fieldType.date')}</option>
              <option value="select">{t('customFields:fieldType.select')}</option>
            </select>
          </div>

          {form.fieldType === 'select' && (
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-ink-muted">{t('customFields:fields.selectOptions')}</label>
              <input
                required
                value={form.selectOptionsText}
                onChange={(e) => setForm({ ...form, selectOptionsText: e.target.value })}
                placeholder={t('customFields:fields.selectOptionsHint')}
                className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink"
              />
            </div>
          )}

          <label className="mb-3 flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.isRequired} onChange={(e) => setForm({ ...form, isRequired: e.target.checked })} />
            {t('customFields:fields.isRequired')}
          </label>

          {formError && <p className="mb-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{formError}</p>}

          <div className="flex justify-end">
            <button type="submit" disabled={createMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
              {createMutation.isPending ? t('common:action.processing') : t('common:action.create')}
            </button>
          </div>
        </form>
      )}

      {(definitions ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-sm font-medium text-ink">{t('customFields:empty.title')}</p>
          <p className="mt-1 text-sm text-ink-muted">{t('customFields:empty.description')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-border text-xs uppercase text-ink-muted">
              <tr>
                <th className="p-3 text-start">{t('customFields:fields.label')}</th>
                <th className="p-3 text-start">{t('customFields:fields.fieldKey')}</th>
                <th className="p-3 text-start">{t('customFields:fields.fieldType')}</th>
                <th className="p-3 text-start">{t('customFields:columns.required')}</th>
                <th className="p-3 text-start">{t('customFields:columns.status')}</th>
                <th className="p-3 text-start"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {definitions!.map((def) => (
                <DefinitionRow key={def.id} definition={def} onDeactivate={() => deactivateMutation.mutate(def.id)} isDeactivating={deactivateMutation.isPending} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DefinitionRow({ definition, onDeactivate, isDeactivating }: { definition: CustomFieldDefinition; onDeactivate: () => void; isDeactivating: boolean }) {
  const { t } = useTranslation(['customFields', 'common']);

  return (
    <tr>
      <td className="p-3 font-medium text-ink">{definition.label}</td>
      <td className="p-3 font-mono text-xs text-ink-muted">{definition.fieldKey}</td>
      <td className="p-3 text-ink-muted">{t(`customFields:fieldType.${definition.fieldType}`)}</td>
      <td className="p-3 text-ink-muted">{definition.isRequired ? t('customFields:booleanYes') : t('customFields:booleanNo')}</td>
      <td className="p-3">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${definition.isActive ? 'bg-success/15 text-success' : 'bg-ink-muted/15 text-ink-muted'}`}>
          {t(definition.isActive ? 'customFields:status.active' : 'customFields:status.inactive')}
        </span>
      </td>
      <td className="p-3 text-end">
        {definition.isActive && (
          <PermissionGate requires={PERMISSIONS.CRM.customFields.delete}>
            <button type="button" onClick={onDeactivate} disabled={isDeactivating} className="text-xs font-medium text-danger hover:underline">
              {t('customFields:actions.deactivate')}
            </button>
          </PermissionGate>
        )}
      </td>
    </tr>
  );
}
