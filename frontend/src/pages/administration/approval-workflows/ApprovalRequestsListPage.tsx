import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApprovalRequests, useCreateApprovalRequest, useApprovalWorkflows } from '../../../api/queries/useApprovalWorkflows';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { ApiError } from '../../../api/client';

export function ApprovalRequestsListPage() {
  const { t } = useTranslation(['approvals', 'common']);
  const navigate = useNavigate();
  const { data: requests, isLoading, error } = useApprovalRequests();
  const { data: workflows } = useApprovalWorkflows();
  const createMutation = useCreateApprovalRequest();

  const [createOpen, setCreateOpen] = useState(false);
  const [workflowId, setWorkflowId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const activeWorkflows = (workflows ?? []).filter((w) => w.isActive);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    createMutation.mutate(
      { workflowId, title, description: description || undefined, amount: amount ? Number(amount) : undefined },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setWorkflowId('');
          setTitle('');
          setDescription('');
          setAmount('');
        },
        onError: (err) => setFormError(err instanceof ApiError ? err.message : 'Something went wrong.'),
      },
    );
  };

  return (
    <div>
      <PageHeader
        title={t('approvals:requests.title')}
        action={
          <button type="button" onClick={() => setCreateOpen(true)} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
            {t('approvals:requests.action.new')}
          </button>
        }
      />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error instanceof ApiError ? error.message : undefined} />}
      {requests && requests.length === 0 && <EmptyState title={t('approvals:requests.empty')} />}

      {requests && requests.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-start text-sm">
            <thead className="bg-surface-muted text-xs uppercase text-ink-muted">
              <tr>
                <th className="p-3 text-start">{t('approvals:requests.fields.title')}</th>
                <th className="p-3 text-start">{t('approvals:requests.fields.workflow')}</th>
                <th className="p-3 text-start">{t('approvals:requests.fields.requestedBy')}</th>
                <th className="p-3 text-start">{t('approvals:requests.fields.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.map((request) => (
                <tr key={request.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => navigate(`/administration/approval-requests/${request.id}`)}>
                  <td className="p-3 font-medium text-ink">{request.title}</td>
                  <td className="p-3 text-ink-muted">{request.workflow?.name}</td>
                  <td className="p-3 text-ink-muted">{request.requestedByUser?.name}</td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        request.status === 'approved'
                          ? 'bg-success/10 text-success'
                          : request.status === 'rejected'
                            ? 'bg-danger/10 text-danger'
                            : 'bg-surface-muted text-ink-muted'
                      }`}
                    >
                      {t(`approvals:requests.status.${request.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={createOpen} onOpenChange={setCreateOpen} title={t('approvals:requests.action.new')}>
        <form onSubmit={handleCreate} noValidate>
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-ink-muted">{t('approvals:requests.fields.workflow')}</label>
            <select required value={workflowId} onChange={(e) => setWorkflowId(e.target.value)} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
              <option value="">—</option>
              {activeWorkflows.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <FormField label={t('approvals:requests.fields.title')} htmlFor="requestTitle" required>
            <TextInput id="requestTitle" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </FormField>
          <FormField label={t('approvals:requests.fields.amount')} htmlFor="requestAmount">
            <TextInput id="requestAmount" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </FormField>
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-ink-muted">{t('approvals:requests.fields.description')}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
          </div>

          {formError && <p className="mb-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{formError}</p>}

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('common:action.cancel')}
            </button>
            <button type="submit" disabled={createMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
              {createMutation.isPending ? t('common:action.processing') : t('common:action.save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
