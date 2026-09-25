import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { usePendingApprovalsForMe, useApproveApprovalRequest, useRejectApprovalRequest } from '../../../api/queries/useApprovalWorkflows';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { Modal } from '../../../components/Modal/Modal';
import { ApiError } from '../../../api/client';

export function MyApprovalsPage() {
  const { t } = useTranslation(['approvals', 'common']);
  const navigate = useNavigate();
  const { data: requests, isLoading, error } = usePendingApprovalsForMe();
  const approveMutation = useApproveApprovalRequest();
  const rejectMutation = useRejectApprovalRequest();

  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectComments, setRejectComments] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const handleApprove = (id: string) => {
    setActionError(null);
    approveMutation.mutate(
      { id, input: {} },
      { onError: (err) => setActionError(err instanceof ApiError ? err.message : 'Something went wrong.') },
    );
  };

  const handleReject = () => {
    if (!rejectTarget) return;
    setActionError(null);
    rejectMutation.mutate(
      { id: rejectTarget, input: { comments: rejectComments || undefined } },
      {
        onSuccess: () => {
          setRejectTarget(null);
          setRejectComments('');
        },
        onError: (err) => setActionError(err instanceof ApiError ? err.message : 'Something went wrong.'),
      },
    );
  };

  return (
    <div>
      <PageHeader title={t('approvals:myApprovals.title')} />
      <p className="mb-4 max-w-2xl text-sm text-ink-muted">{t('approvals:myApprovals.description')}</p>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error instanceof ApiError ? error.message : undefined} />}
      {actionError && <p className="mb-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{actionError}</p>}

      {requests && requests.length === 0 && <EmptyState title={t('approvals:myApprovals.empty')} />}

      {requests && requests.length > 0 && (
        <div className="space-y-3">
          {requests.map((request) => (
            <div key={request.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="cursor-pointer" onClick={() => navigate(`/administration/approval-requests/${request.id}`)}>
                  <p className="font-medium text-ink">{request.title}</p>
                  <p className="text-sm text-ink-muted">
                    {t('approvals:requests.fields.requestedBy')}: {request.requestedByUser?.name}
                    {request.amount && <> · {request.amount}</>}
                  </p>
                  {request.description && <p className="mt-1 text-sm text-ink-muted">{request.description}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setRejectTarget(request.id)}
                    className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
                  >
                    {t('approvals:requests.action.reject')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprove(request.id)}
                    disabled={approveMutation.isPending}
                    className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50"
                  >
                    {t('approvals:requests.action.approve')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)} title={t('approvals:requests.rejectTitle')}>
        <textarea
          value={rejectComments}
          onChange={(e) => setRejectComments(e.target.value)}
          rows={3}
          placeholder={t('approvals:requests.fields.comments')}
          className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setRejectTarget(null)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
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
