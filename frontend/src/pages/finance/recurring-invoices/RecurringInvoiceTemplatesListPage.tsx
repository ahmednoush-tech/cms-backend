import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useRecurringInvoiceTemplates, useGenerateDueInvoices } from '../../../api/queries/useRecurringInvoiceTemplates';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';
import type { GenerateDueResult } from '../../../types/entities/recurringInvoice';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-success/15 text-success',
  paused: 'bg-warning/15 text-warning',
  completed: 'bg-info/15 text-info',
  cancelled: 'bg-danger/15 text-danger',
};

export function RecurringInvoiceTemplatesListPage() {
  const { t } = useTranslation(['recurringInvoices', 'common']);
  const navigate = useNavigate();
  const { data: templates, isLoading, error } = useRecurringInvoiceTemplates();
  const generateMutation = useGenerateDueInvoices();

  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateResult, setGenerateResult] = useState<GenerateDueResult | null>(null);

  const handleGenerate = () => {
    setGenerateError(null);
    setGenerateResult(null);
    generateMutation.mutate(undefined, {
      onSuccess: (result) => setGenerateResult(result),
      onError: (err) => setGenerateError(err instanceof ApiError ? err.message : t('common:error.generic')),
    });
  };

  if (isLoading) return <LoadingState variant="page" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant="generic" message={apiError?.message} />;
  }

  return (
    <div>
      <PageHeader
        title={t('recurringInvoices:title')}
        action={
          <div className="flex gap-2">
            <PermissionGate requires={PERMISSIONS.Finance.recurringInvoices.generate}>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-50"
              >
                {generateMutation.isPending ? t('common:action.processing') : t('recurringInvoices:actions.generateDue')}
              </button>
            </PermissionGate>
            <PermissionGate requires={PERMISSIONS.Finance.recurringInvoices.create}>
              <button
                type="button"
                onClick={() => navigate('/finance/recurring-invoices/new')}
                className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90"
              >
                {t('recurringInvoices:actions.new')}
              </button>
            </PermissionGate>
          </div>
        }
      />

      <p className="mb-4 text-xs text-ink-muted">{t('recurringInvoices:autoScheduleNote')}</p>

      {generateError && <p className="mb-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{generateError}</p>}

      {generateResult && (
        <div className="mb-4 rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
          <p className="font-medium text-success">{t('recurringInvoices:generateResult.summary', { count: generateResult.generatedCount })}</p>
          {generateResult.skipped.length > 0 && (
            <div className="mt-2">
              <p className="font-medium text-ink">{t('recurringInvoices:generateResult.skippedTitle')}</p>
              <ul className="ms-4 list-disc text-ink-muted">
                {generateResult.skipped.map((s) => (<li key={s}>{s}</li>))}
              </ul>
            </div>
          )}
        </div>
      )}

      {(templates ?? []).length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-sm font-medium text-ink">{t('recurringInvoices:empty.title')}</p>
          <p className="mt-1 text-sm text-ink-muted">{t('recurringInvoices:empty.description')}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-border text-xs uppercase text-ink-muted">
              <tr>
                <th className="p-3 text-start">{t('recurringInvoices:columns.name')}</th>
                <th className="p-3 text-start">{t('recurringInvoices:columns.customer')}</th>
                <th className="p-3 text-start">{t('recurringInvoices:columns.frequency')}</th>
                <th className="p-3 text-start">{t('recurringInvoices:columns.nextGeneration')}</th>
                <th className="p-3 text-start">{t('recurringInvoices:columns.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {templates!.map((template) => (
                <tr key={template.id} onClick={() => navigate(`/finance/recurring-invoices/${template.id}`)} className="cursor-pointer hover:bg-surface-muted">
                  <td className="p-3">{template.name}</td>
                  <td className="p-3">{template.customer?.companyName ?? template.customer?.customerCode ?? '—'}</td>
                  <td className="p-3">{t(`recurringInvoices:frequency.${template.frequency}`)}</td>
                  <td className="p-3">{template.nextGenerationDate.slice(0, 10)}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[template.status]}`}>
                      {t(`recurringInvoices:status.${template.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
