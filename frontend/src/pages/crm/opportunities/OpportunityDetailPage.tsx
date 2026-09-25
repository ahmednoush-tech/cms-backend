import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useOpportunity, useUpdateOpportunityStage } from '../../../api/queries/useOpportunities';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { InteractionsSection } from '../shared/InteractionsSection';
import { CustomFieldsDisplay } from '../../../components/CustomFieldsDisplay/CustomFieldsDisplay';
import { AttachmentsSection } from '../../../components/AttachmentsSection/AttachmentsSection';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { StatusBadge } from '../../../components/StatusBadge/StatusBadge';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { OPPORTUNITY_TRANSITIONS, getNextStates } from '../../../lib/workflowTransitions';
import { getStatusLabelKey } from '../../../components/StatusBadge/statusMap';
import { ApiError } from '../../../api/client';

export function OpportunityDetailPage() {
  const { t } = useTranslation(['opportunities', 'common']);
  const { id } = useParams<{ id: string }>();
  const [confirmStage, setConfirmStage] = useState<string | null>(null);

  const { data: opportunity, isLoading, error } = useOpportunity(id);
  const stageMutation = useUpdateOpportunityStage(id!);

  if (isLoading) return <LoadingState variant="card" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant={apiError?.status === 404 ? 'not-found' : 'generic'} message={apiError?.message} />;
  }
  if (!opportunity) return null;

  const nextStages = getNextStates(OPPORTUNITY_TRANSITIONS, opportunity.stage);

  return (
    <div>
      <PageHeader title={opportunity.name} breadcrumb={t('opportunities:title')} />

      <div className="mb-4">
        <StatusBadge entity="opportunity" value={opportunity.stage} />
      </div>

      <dl className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
        <Field label={t('opportunities:fields.value')} value={opportunity.value ? <FinancialValue value={opportunity.value} currency={opportunity.currency ?? 'SAR'} /> : '—'} />
        <Field label={t('opportunities:fields.probability')} value={opportunity.probability != null ? `${opportunity.probability}%` : '—'} />
        <Field label={t('opportunities:fields.expectedCloseDate')} value={opportunity.expectedCloseDate?.slice(0, 10) ?? '—'} />
        <Field label={t('opportunities:fields.description')} value={opportunity.description ?? '—'} />
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <PermissionGate requires="CRM:opportunities:edit">
          {nextStages.map((next) => (
            <button
              key={next}
              type="button"
              onClick={() => setConfirmStage(next)}
              className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
            >
              {t('opportunities:detail.moveTo', { stage: t(`common:${getStatusLabelKey('opportunity', next)}`) })}
            </button>
          ))}
        </PermissionGate>
      </div>

      <ConfirmDialog
        open={!!confirmStage}
        onOpenChange={(open) => !open && setConfirmStage(null)}
        title={t('opportunities:detail.stageChangeTitle')}
        message={t('opportunities:detail.stageChangeMessage', { stage: confirmStage ? t(`common:${getStatusLabelKey('opportunity', confirmStage)}`) : '' })}
        isLoading={stageMutation.isPending}
        onConfirm={() => confirmStage && stageMutation.mutate({ stage: confirmStage as never }, { onSuccess: () => setConfirmStage(null) })}
      />

      <InteractionsSection parent={{ kind: 'opportunity', id: opportunity.id }} />

      <CustomFieldsDisplay entityType="opportunity" customFields={opportunity.customFields} />

      <div className="mt-4">
        <AttachmentsSection entityType="opportunity" entityId={opportunity.id} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}
