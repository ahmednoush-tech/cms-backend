import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useRecurringInvoiceTemplate,
  usePauseRecurringInvoiceTemplate,
  useResumeRecurringInvoiceTemplate,
  useCancelRecurringInvoiceTemplate,
} from '../../../api/queries/useRecurringInvoiceTemplates';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-success/15 text-success',
  paused: 'bg-warning/15 text-warning',
  completed: 'bg-info/15 text-info',
  cancelled: 'bg-danger/15 text-danger',
};

type ConfirmAction = 'pause' | 'resume' | 'cancel' | null;

export function RecurringInvoiceTemplateDetailPage() {
  const { t } = useTranslation(['recurringInvoices', 'finance', 'common']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: template, isLoading, error } = useRecurringInvoiceTemplate(id);

  const pauseMutation = usePauseRecurringInvoiceTemplate(id ?? '');
  const resumeMutation = useResumeRecurringInvoiceTemplate(id ?? '');
  const cancelMutation = useCancelRecurringInvoiceTemplate(id ?? '');

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <LoadingState variant="page" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant={apiError?.status === 404 ? 'not-found' : 'generic'} message={apiError?.message} />;
  }
  if (!template) return null;

  const handleError = (err: unknown) => setActionError(err instanceof ApiError ? err.message : t('common:error.generic'));

  const runConfirmedAction = () => {
    setActionError(null);
    const onSettled = () => setConfirmAction(null);
    if (confirmAction === 'pause') pauseMutation.mutate(undefined, { onSuccess: onSettled, onError: (e) => { handleError(e); onSettled(); } });
    if (confirmAction === 'resume') resumeMutation.mutate(undefined, { onSuccess: onSettled, onError: (e) => { handleError(e); onSettled(); } });
    if (confirmAction === 'cancel') cancelMutation.mutate(undefined, { onSuccess: onSettled, onError: (e) => { handleError(e); onSettled(); } });
  };

  const isActionLoading = pauseMutation.isPending || resumeMutation.isPending || cancelMutation.isPending;

  return (
    <div>
      <PageHeader
        title={template.name}
        breadcrumb={t('recurringInvoices:title')}
        action={
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[template.status]}`}>
            {t(`recurringInvoices:status.${template.status}`)}
          </span>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 rounded-lg border border-border bg-surface p-4 text-sm md:grid-cols-4">
        <div>
          <p className="text-xs text-ink-muted">{t('recurringInvoices:fields.customer')}</p>
          <p className="font-medium text-ink">{template.customer?.companyName ?? template.customer?.customerCode ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">{t('recurringInvoices:fields.frequency')}</p>
          <p className="font-medium text-ink">{t(`recurringInvoices:frequency.${template.frequency}`)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">{t('recurringInvoices:columns.nextGeneration')}</p>
          <p className="font-medium text-ink">{template.status === 'active' ? template.nextGenerationDate.slice(0, 10) : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">{t('recurringInvoices:fields.endDate')}</p>
          <p className="font-medium text-ink">{template.endDate?.slice(0, 10) ?? t('recurringInvoices:form.noEndDate')}</p>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-medium text-ink">{t('finance:invoices.items')}</p>
        <table className="w-full text-start text-sm">
          <thead className="border-b border-border text-xs uppercase text-ink-muted">
            <tr>
              <th className="pb-2 text-start">{t('finance:invoices.fields.description')}</th>
              <th className="pb-2 text-start">{t('finance:invoices.fields.quantity')}</th>
              <th className="pb-2 text-start">{t('finance:invoices.fields.unitPrice')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(template.items ?? []).map((item) => (
              <tr key={item.id}>
                <td className="py-2">{item.description}</td>
                <td className="py-2">{item.quantity}</td>
                <td className="py-2"><FinancialValue value={item.unitPrice} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-4 rounded-lg border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-medium text-ink">{t('recurringInvoices:detail.generatedInvoices')}</p>
        {(template.generatedInvoices ?? []).length === 0 ? (
          <p className="text-sm text-ink-muted">{t('recurringInvoices:detail.noInvoicesYet')}</p>
        ) : (
          <table className="w-full text-start text-sm">
            <thead className="border-b border-border text-xs uppercase text-ink-muted">
              <tr>
                <th className="pb-2 text-start">{t('finance:invoices.columns.invoiceNumber')}</th>
                <th className="pb-2 text-start">{t('finance:invoices.fields.issueDate')}</th>
                <th className="pb-2 text-start">{t('finance:invoices.fields.total')}</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {template.generatedInvoices!.map((inv) => (
                <tr key={inv.id}>
                  <td className="py-2">{inv.invoiceNumber}</td>
                  <td className="py-2">{inv.issueDate.slice(0, 10)}</td>
                  <td className="py-2"><FinancialValue value={inv.total} /></td>
                  <td className="py-2">
                    <button type="button" onClick={() => navigate(`/finance/invoices/${inv.id}`)} className="text-xs font-medium text-primary hover:underline">
                      {t('common:action.view')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {actionError && <p className="mb-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{actionError}</p>}

      <div className="flex flex-wrap gap-2">
        <PermissionGate requires={PERMISSIONS.Finance.recurringInvoices.edit}>
          {template.status === 'active' && (
            <button type="button" onClick={() => setConfirmAction('pause')} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('recurringInvoices:actions.pause')}
            </button>
          )}
          {template.status === 'paused' && (
            <button type="button" onClick={() => setConfirmAction('resume')} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('recurringInvoices:actions.resume')}
            </button>
          )}
          {['active', 'paused'].includes(template.status) && (
            <button type="button" onClick={() => setConfirmAction('cancel')} className="rounded border border-danger px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10">
              {t('recurringInvoices:actions.cancel')}
            </button>
          )}
        </PermissionGate>
      </div>

      <ConfirmDialog
        open={confirmAction === 'pause'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={t('recurringInvoices:confirm.pauseTitle')}
        message={t('recurringInvoices:confirm.pauseMessage')}
        onConfirm={runConfirmedAction}
        isLoading={isActionLoading}
      />
      <ConfirmDialog
        open={confirmAction === 'resume'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={t('recurringInvoices:confirm.resumeTitle')}
        message={t('recurringInvoices:confirm.resumeMessage')}
        onConfirm={runConfirmedAction}
        isLoading={isActionLoading}
      />
      <ConfirmDialog
        open={confirmAction === 'cancel'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={t('recurringInvoices:confirm.cancelTitle')}
        message={t('recurringInvoices:confirm.cancelMessage')}
        variant="destructive"
        onConfirm={runConfirmedAction}
        isLoading={isActionLoading}
      />
    </div>
  );
}
