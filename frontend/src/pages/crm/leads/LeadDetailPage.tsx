import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useLeadTimeline } from '../../../api/queries/useCrmTimeline';
import { CustomFieldsDisplay } from '../../../components/CustomFieldsDisplay/CustomFieldsDisplay';
import { AttachmentsSection } from '../../../components/AttachmentsSection/AttachmentsSection';
import { CrmTimeline } from '../../../components/CrmTimeline/CrmTimeline';
import { useLead, useUpdateLeadStatus, useConvertLead } from '../../../api/queries/useLeads';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { WhatsAppButton } from '../../../components/WhatsAppButton/WhatsAppButton';
import { InteractionsSection } from '../shared/InteractionsSection';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { StatusBadge } from '../../../components/StatusBadge/StatusBadge';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { usePermissions } from '../../../rbac/usePermissions';
import { LEAD_CONVERT_PERMISSIONS } from '../../../rbac/permissionConstants';
import { LEAD_TRANSITIONS, LEAD_CONVERTIBLE_STATUSES, getNextStates } from '../../../lib/workflowTransitions';
import { getStatusLabelKey } from '../../../components/StatusBadge/statusMap';
import { ApiError } from '../../../api/client';

export function LeadDetailPage() {
  const { t } = useTranslation(['leads', 'common']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: timelineEvents } = useLeadTimeline(id);
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);

  const { data: lead, isLoading, error } = useLead(id);
  const statusMutation = useUpdateLeadStatus(id!);
  const convertMutation = useConvertLead(id!);
  const { hasAllPermissions } = usePermissions();

  if (isLoading) return <LoadingState variant="card" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant={apiError?.status === 404 ? 'not-found' : 'generic'} message={apiError?.message} />;
  }
  if (!lead) return null;

  const nextStates = getNextStates(LEAD_TRANSITIONS, lead.status);
  const alreadyConverted = !!lead.convertedAt;
  const isConvertible = !alreadyConverted && LEAD_CONVERTIBLE_STATUSES.includes(lead.status);
  const canConvert = hasAllPermissions(LEAD_CONVERT_PERMISSIONS);

  return (
    <div>
      <PageHeader
        title={lead.name}
        breadcrumb={t('leads:title')}
        action={<WhatsAppButton phone={lead.phone} message={t('common:whatsappGreeting', { name: lead.name })} />}
      />

      <div className="mb-4 flex items-center gap-3">
        <StatusBadge entity="lead" value={lead.status} />
        {alreadyConverted && <span className="text-xs text-ink-muted">{t('leads:detail.alreadyConverted')}</span>}
      </div>

      <dl className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
        <Field label={t('leads:fields.companyName')} value={lead.companyName ?? '—'} />
        <Field label={t('leads:fields.email')} value={lead.email ?? '—'} />
        <Field label={t('leads:fields.phone')} value={lead.phone ?? '—'} />
        <Field label={t('leads:fields.source')} value={lead.source ?? '—'} />
        <Field label={t('leads:fields.notes')} value={lead.notes ?? '—'} />
      </dl>

      <CustomFieldsDisplay entityType="lead" customFields={lead.customFields} />

      <div className="mt-4">
        <AttachmentsSection entityType="lead" entityId={lead.id} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <PermissionGate requires="CRM:leads:edit">
          {nextStates.map((next) => (
            <button
              key={next}
              type="button"
              onClick={() => setConfirmStatus(next)}
              className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
            >
              {t('leads:detail.moveTo', { status: t(`common:${getStatusLabelKey('lead', next)}`) })}
            </button>
          ))}
        </PermissionGate>

        {isConvertible && canConvert && (
          <button
            type="button"
            onClick={() => setConvertOpen(true)}
            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90"
          >
            {t('leads:detail.convert')}
          </button>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmStatus}
        onOpenChange={(open) => !open && setConfirmStatus(null)}
        title={t('leads:detail.statusChangeTitle')}
        message={t('leads:detail.statusChangeMessage', { status: confirmStatus ? t(`common:${getStatusLabelKey('lead', confirmStatus)}`) : '' })}
        isLoading={statusMutation.isPending}
        onConfirm={() =>
          confirmStatus &&
          statusMutation.mutate({ status: confirmStatus as never }, { onSuccess: () => setConfirmStatus(null) })
        }
      />

      <ConfirmDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        title={t('leads:detail.convertTitle')}
        message={t('leads:detail.convertMessage')}
        isLoading={convertMutation.isPending}
        onConfirm={() =>
          convertMutation.mutate(
            { createContact: true },
            {
              onSuccess: () => {
                setConvertOpen(false);
                navigate(`/crm/leads/${id}`);
              },
            },
          )
        }
      />

      <InteractionsSection parent={{ kind: 'lead', id: lead.id }} />

      <div className="mt-6">
        <p className="mb-3 text-sm font-medium text-ink">{t('leads:timeline.title')}</p>
        <CrmTimeline events={timelineEvents ?? []} />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}
