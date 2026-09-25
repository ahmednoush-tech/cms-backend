import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useApprovalRequest,
  useApproveApprovalRequest,
  useRejectApprovalRequest,
  useCancelApprovalRequest,
} from '../../../api/queries/useApprovalWorkflows';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { Modal } from '../../../components/Modal/Modal';
import { ApiError } from '../../../api/client';

export function ApprovalRequestDetailPage() {
  const { t } = useTranslation(['approvals', 'common']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: request, isLoading, error } = useApprovalRequest(id);
  const approveMutation = useApproveApprovalRequest();
  const rejectMutation = useRejectApprovalRequest();
  const cancelMutation = useCancelApprovalRequest();

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComments, setRejectComments] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error instanceof ApiError ? error.message : undefined} />;
  if (!request || !id) return null;

  const handleApprove = () => {
    setActionError(null);
    approveMutation.mutate({ id, input: {} }, { onError: (err) => setActionError(err instanceof ApiError ? err.message : 'Something went wrong.') });
  };

  const handleReject = () => {
    setActionError(null);
    rejectMutation.mutate(
      { id, input: { comments: rejectComments || undefined } },
      { onSuccess: () => setRejectOpen(false), onError: (err) => setActionError(err instanceof ApiError ? err.message : 'Something went wrong.') },
    );
  };

  const handleCancel = () => {
    setActionError(null);
    cancelMutation.mutate(id, { onError: (err) => setActionError(err instanceof ApiError ? err.message : 'Something went wrong.') });
  };

  return (
    <div>
      <button type="button" onClick={() => navigate(-1)} className="mb-3 text-sm text-ink-muted hover:text-ink">
        ← {t('common:action.back')}
      </button>

      <PageHeader title={request.title} breadcrumb={request.workflow?.name} />

      <div className="mb-4 flex items-center gap-3 text-sm text-ink-muted">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            request.status === 'approved' ? 'bg-success/10 text-success' : request.status === 'rejected' ? 'bg-danger/10 text-danger' : 'bg-surface-muted text-ink-muted'
          }`}
        >
          {t(`approvals:requests.status.${request.status}`)}
        </span>
        <span>{t('approvals:requests.fields.requestedBy')}: {request.requestedByUser?.name}</span>
        {request.amount && <span>{request.amount}</span>}
      </div>

      {request.description && <p className="mb-4 text-sm text-ink">{request.description}</p>}

      <div className="mb-6">
        <p className="mb-2 text-sm font-medium text-ink">{t('approvals:requests.stepsProgress')}</p>
        <div className="flex flex-wrap gap-2">
          {(request.workflow?.steps ?? []).map((step) => {
            const action = request.actions?.find((a) => a.stepOrder === step.stepOrder);
            const isCurrent = request.status === 'pending' && request.currentStepOrder === step.stepOrder;
            return (
              <span
                key={step.id}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  action?.decision === 'approved'
                    ? 'border-success bg-success/10 text-success'
                    : action?.decision === 'rejected'
                      ? 'border-danger bg-danger/10 text-danger'
                      : isCurrent
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-ink-muted'
                }`}
              >
                {step.approverRole?.name}
              </span>
            );
          })}
        </div>
      </div>

      {request.actions && request.actions.length > 0 && (
        <div className="mb-6 space-y-2">
          <p className="text-sm font-medium text-ink">{t('approvals:requests.history')}</p>
          {request.actions.map((action) => (
            <div key={action.id} className="rounded border border-border p-3 text-sm">
              <p className="text-ink">
                <strong>{action.actor?.name}</strong> — {t(`approvals:requests.status.${action.decision === 'approved' ? 'approved' : 'rejected'}`)}
              </p>
              {action.comments && <p className="mt-1 text-ink-muted">{action.comments}</p>}
            </div>
          ))}
        </div>
      )}

      {actionError && <p className="mb-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{actionError}</p>}

      {request.status === 'pending' && (
        <div className="flex gap-2">
          <button type="button" onClick={() => setRejectOpen(true)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('approvals:requests.action.reject')}
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={approveMutation.isPending}
            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50"
          >
            {t('approvals:requests.action.approve')}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelMutation.isPending}
            className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-surface-muted disabled:opacity-50"
          >
            {t('approvals:requests.action.cancel')}
          </button>
        </div>
      )}

      <Modal open={rejectOpen} onOpenChange={setRejectOpen} title={t('approvals:requests.rejectTitle')}>
        <textarea
          value={rejectComments}
          onChange={(e) => setRejectComments(e.target.value)}
          rows={3}
          placeholder={t('approvals:requests.fields.comments')}
          className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setRejectOpen(false)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('common:action.cancel')}
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={rejectMutation.isPending}
            className="rounded bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {t('approvals:requests.action.reject')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
