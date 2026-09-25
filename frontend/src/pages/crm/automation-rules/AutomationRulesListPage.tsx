import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAutomationRules,
  useCreateAutomationRule,
  useUpdateAutomationRule,
  useDeleteAutomationRule,
} from '../../../api/queries/useAutomationRules';
import type { AutomationRule, AutomationTriggerEntityType, AutomationTriggerEvent } from '../../../types/entities/automationRule';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';

const OPPORTUNITY_STAGES = ['prospecting', 'qualification', 'proposal', 'negotiation', 'won', 'lost'];

interface RuleFormState {
  name: string;
  triggerEntityType: AutomationTriggerEntityType;
  triggerEvent: AutomationTriggerEvent;
  triggerToStage: string;
  notificationTitle: string;
  notificationMessage: string;
}

const EMPTY_FORM: RuleFormState = {
  name: '',
  triggerEntityType: 'lead',
  triggerEvent: 'created',
  triggerToStage: '',
  notificationTitle: '',
  notificationMessage: '',
};

export function AutomationRulesListPage() {
  const { t } = useTranslation(['automationRules', 'opportunities', 'common']);
  const { data: rules, isLoading, error } = useAutomationRules();
  const createMutation = useCreateAutomationRule();
  const deleteMutation = useDeleteAutomationRule();

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<RuleFormState>(EMPTY_FORM);
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
        name: form.name,
        triggerEntityType: form.triggerEntityType,
        triggerEvent: form.triggerEvent,
        triggerToStage: form.triggerEvent === 'stage_changed' ? form.triggerToStage : undefined,
        notificationTitle: form.notificationTitle,
        notificationMessage: form.notificationMessage || undefined,
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
        title={t('automationRules:title')}
        action={
          <PermissionGate requires={PERMISSIONS.CRM.automationRules.create}>
            <button type="button" onClick={() => setFormOpen((v) => !v)} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {formOpen ? t('common:action.cancel') : t('automationRules:actions.new')}
            </button>
          </PermissionGate>
        }
      />
      <p className="mb-4 max-w-2xl text-sm text-ink-muted">{t('automationRules:description')}</p>

      {formOpen && (
        <form onSubmit={handleCreate} noValidate className="mb-4 max-w-2xl rounded-lg border border-border bg-surface p-4">
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-ink-muted">{t('automationRules:fields.name')}</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
          </div>

          <div className="mb-3 grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">{t('automationRules:fields.triggerEntityType')}</label>
              <select value={form.triggerEntityType} onChange={(e) => setForm({ ...form, triggerEntityType: e.target.value as AutomationTriggerEntityType, triggerEvent: 'created', triggerToStage: '' })} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
                <option value="lead">{t('automationRules:entityType.lead')}</option>
                <option value="opportunity">{t('automationRules:entityType.opportunity')}</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-muted">{t('automationRules:fields.triggerEvent')}</label>
              <select value={form.triggerEvent} onChange={(e) => setForm({ ...form, triggerEvent: e.target.value as AutomationTriggerEvent, triggerToStage: '' })} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
                <option value="created">{t('automationRules:event.created')}</option>
                {form.triggerEntityType === 'opportunity' && <option value="stage_changed">{t('automationRules:event.stage_changed')}</option>}
              </select>
            </div>
          </div>

          {form.triggerEvent === 'stage_changed' && (
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-ink-muted">{t('automationRules:fields.triggerToStage')}</label>
              <select required value={form.triggerToStage} onChange={(e) => setForm({ ...form, triggerToStage: e.target.value })} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
                <option value="">{t('automationRules:fields.selectStage')}</option>
                {OPPORTUNITY_STAGES.map((s) => (
                  <option key={s} value={s}>{t(`opportunities:stage.${s}`)}</option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-ink-muted">{t('automationRules:fields.notificationTitle')}</label>
            <input required value={form.notificationTitle} onChange={(e) => setForm({ ...form, notificationTitle: e.target.value })} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
            <p className="mt-1 text-xs text-ink-muted">
              {t('automationRules:fields.templateHint')} <code className="rounded bg-surface-muted px-1">{'{{name}}'}</code>
            </p>
          </div>

          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-ink-muted">{t('automationRules:fields.notificationMessage')}</label>
            <textarea value={form.notificationMessage} onChange={(e) => setForm({ ...form, notificationMessage: e.target.value })} rows={2} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
            <p className="mt-1 text-xs text-ink-muted">
              {t('automationRules:fields.templateHint')} <code className="rounded bg-surface-muted px-1">{'{{name}}'}</code>
            </p>
          </div>

          {formError && <p className="mb-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{formError}</p>}

          <div className="flex justify-end">
            <button type="submit" disabled={createMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
              {createMutation.isPending ? t('common:action.processing') : t('common:action.create')}
            </button>
          </div>
        </form>
      )}

      {(rules ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-sm font-medium text-ink">{t('automationRules:empty.title')}</p>
          <p className="mt-1 text-sm text-ink-muted">{t('automationRules:empty.description')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-border text-xs uppercase text-ink-muted">
              <tr>
                <th className="p-3 text-start">{t('automationRules:fields.name')}</th>
                <th className="p-3 text-start">{t('automationRules:columns.trigger')}</th>
                <th className="p-3 text-start">{t('automationRules:columns.status')}</th>
                <th className="p-3 text-start"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rules!.map((rule) => (
                <RuleRow key={rule.id} rule={rule} onDelete={() => deleteMutation.mutate(rule.id)} isDeleting={deleteMutation.isPending} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RuleRow({ rule, onDelete, isDeleting }: { rule: AutomationRule; onDelete: () => void; isDeleting: boolean }) {
  const { t } = useTranslation(['automationRules', 'opportunities', 'common']);
  const updateMutation = useUpdateAutomationRule(rule.id);

  return (
    <tr>
      <td className="p-3 font-medium text-ink">{rule.name}</td>
      <td className="p-3 text-ink-muted">
        {t(`automationRules:entityType.${rule.triggerEntityType}`)} — {t(`automationRules:event.${rule.triggerEvent}`)}
        {rule.triggerToStage && ` (${t(`opportunities:stage.${rule.triggerToStage}`)})`}
      </td>
      <td className="p-3">
        <button
          type="button"
          onClick={() => updateMutation.mutate({ isActive: !rule.isActive })}
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${rule.isActive ? 'bg-success/15 text-success' : 'bg-ink-muted/15 text-ink-muted'}`}
        >
          {t(rule.isActive ? 'automationRules:status.active' : 'automationRules:status.inactive')}
        </button>
      </td>
      <td className="p-3 text-end">
        <PermissionGate requires={PERMISSIONS.CRM.automationRules.delete}>
          <button type="button" onClick={onDelete} disabled={isDeleting} className="text-xs font-medium text-danger hover:underline">
            {t('common:action.delete')}
          </button>
        </PermissionGate>
      </td>
    </tr>
  );
}
