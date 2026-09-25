import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApprovalWorkflows, useCreateApprovalWorkflow, useUpdateApprovalWorkflow } from '../../../api/queries/useApprovalWorkflows';
import { useRoles } from '../../../api/queries/useRoles';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';

export function ApprovalWorkflowsListPage() {
  const { t } = useTranslation(['approvals', 'common']);
  const { data: workflows, isLoading, error } = useApprovalWorkflows();
  const { data: roles } = useRoles();
  const createMutation = useCreateApprovalWorkflow();
  const updateMutation = useUpdateApprovalWorkflow();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [stepRoleIds, setStepRoleIds] = useState<string[]>(['']);
  const [formError, setFormError] = useState<string | null>(null);

  const addStep = () => setStepRoleIds((prev) => [...prev, '']);
  const removeStep = (index: number) => setStepRoleIds((prev) => prev.filter((_, i) => i !== index));
  const setStepRole = (index: number, roleId: string) => setStepRoleIds((prev) => prev.map((r, i) => (i === index ? roleId : r)));

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const steps = stepRoleIds.filter((r) => r).map((approverRoleId) => ({ approverRoleId }));
    if (steps.length === 0) {
      setFormError(t('approvals:workflows.errors.needAtLeastOneStep'));
      return;
    }
    createMutation.mutate(
      { name, steps },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setName('');
          setStepRoleIds(['']);
        },
        onError: (err) => setFormError(err instanceof ApiError ? err.message : 'Something went wrong.'),
      },
    );
  };

  const toggleActive = (id: string, isActive: boolean) => {
    updateMutation.mutate({ id, input: { isActive: !isActive } });
  };

  return (
    <div>
      <PageHeader
        title={t('approvals:workflows.title')}
        action={
          <PermissionGate requires={PERMISSIONS.Administration.approvalWorkflows.manage}>
            <button type="button" onClick={() => setCreateOpen(true)} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('approvals:workflows.action.add')}
            </button>
          </PermissionGate>
        }
      />
      <p className="mb-4 max-w-2xl text-sm text-ink-muted">{t('approvals:workflows.description')}</p>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error instanceof ApiError ? error.message : undefined} />}

      {workflows && (
        <div className="space-y-3">
          {workflows.map((workflow) => (
            <div key={workflow.id} className="rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium text-ink">{workflow.name}</p>
                <PermissionGate requires={PERMISSIONS.Administration.approvalWorkflows.manage}>
                  <button type="button" onClick={() => toggleActive(workflow.id, workflow.isActive)} className="text-sm font-medium text-primary hover:underline">
                    {workflow.isActive ? t('approvals:workflows.action.deactivate') : t('approvals:workflows.action.activate')}
                  </button>
                </PermissionGate>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                {workflow.steps.map((step, index) => (
                  <span key={step.id} className="flex items-center gap-2">
                    <span className="rounded-full border border-border px-2 py-0.5">
                      {t('approvals:workflows.stepLabel', { n: step.stepOrder })}: {step.approverRole?.name}
                    </span>
                    {index < workflow.steps.length - 1 && <span>→</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={createOpen} onOpenChange={setCreateOpen} title={t('approvals:workflows.action.add')}>
        <form onSubmit={handleCreate} noValidate>
          <FormField label={t('approvals:workflows.fields.name')} htmlFor="workflowName" required>
            <TextInput id="workflowName" value={name} onChange={(e) => setName(e.target.value)} required />
          </FormField>

          <label className="mb-1 block text-xs font-medium text-ink-muted">{t('approvals:workflows.fields.steps')}</label>
          <div className="space-y-2">
            {stepRoleIds.map((roleId, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-xs text-ink-muted">{index + 1}.</span>
                <select value={roleId} onChange={(e) => setStepRole(index, e.target.value)} className="flex-1 rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
                  <option value="">—</option>
                  {(roles ?? []).map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
                {stepRoleIds.length > 1 && (
                  <button type="button" onClick={() => removeStep(index)} className="text-sm text-danger hover:underline">
                    {t('common:action.remove')}
                  </button>
                )}
              </div>
            ))}
          </div>
          <button type="button" onClick={addStep} className="mt-2 text-sm font-medium text-primary hover:underline">
            {t('approvals:workflows.action.addStep')}
          </button>

          {formError && <p className="mb-3 mt-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{formError}</p>}

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
