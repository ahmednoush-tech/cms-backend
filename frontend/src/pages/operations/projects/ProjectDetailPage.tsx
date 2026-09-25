import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';
import {
  useProject,
  useUpdateProjectStatus,
  useAssignProjectManager,
  useProjectMembers,
  useAddProjectMember,
  useRemoveProjectMember,
} from '../../../api/queries/useProjects';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { StatusBadge } from '../../../components/StatusBadge/StatusBadge';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PROJECT_TRANSITIONS, getNextStates } from '../../../lib/workflowTransitions';
import { PROJECT_MEMBER_ROLES } from '../../../types/entities/project';
import { getStatusLabelKey } from '../../../components/StatusBadge/statusMap';
import { AttachmentsSection } from '../../../components/AttachmentsSection/AttachmentsSection';
import { TimeSummaryCard } from '../shared/TimeSummaryCard';
import { ApiError } from '../../../api/client';

type Tab = 'overview' | 'members';

export function ProjectDetailPage() {
  const { t } = useTranslation(['projects', 'common']);
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('overview');
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [managerId, setManagerId] = useState('');
  const [managerError, setManagerError] = useState<string | null>(null);

  const { data: project, isLoading, error } = useProject(id);
  const statusMutation = useUpdateProjectStatus(id!);
  const managerMutation = useAssignProjectManager(id!);

  if (isLoading) return <LoadingState variant="card" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant={apiError?.status === 404 ? 'not-found' : 'generic'} message={apiError?.message} />;
  }
  if (!project) return null;

  const nextStates = getNextStates(PROJECT_TRANSITIONS, project.status);

  return (
    <div>
      <PageHeader
        title={project.name}
        breadcrumb={t('projects:title')}
        action={
          <div className="flex gap-2">
            <Link to={`/ops/projects/${id}/progress`} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('projects:progress.viewLink')}
            </Link>
            <Link to={`/ops/projects/${id}/gantt`} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('projects:gantt.viewLink')}
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <StatusBadge entity="project" value={project.status} />
        <span className="text-xs text-ink-muted">{project.projectNumber}</span>
      </div>

      <div className="mb-4 flex gap-1 border-b border-border" role="tablist">
        {(['overview', 'members'] as Tab[]).map((tabKey) => (
          <button
            key={tabKey}
            type="button"
            onClick={() => setTab(tabKey)}
            className={
              tab === tabKey
                ? 'border-b-2 border-primary px-3 py-2 text-sm font-medium text-primary'
                : 'border-b-2 border-transparent px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink'
            }
          >
            {t(`projects:tabs.${tabKey}`)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <dl className="grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
            <Field label={t('projects:fields.description')} value={project.description ?? '—'} />
            <Field label={t('projects:fields.startDate')} value={project.startDate?.slice(0, 10) ?? '—'} />
            <Field label={t('projects:fields.endDate')} value={project.endDate?.slice(0, 10) ?? '—'} />
            <Field label={t('projects:fields.projectManagerId')} value={project.projectManager ? `${project.projectManager.firstName} ${project.projectManager.lastName}` : t('projects:detail.noManager')} />
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            <PermissionGate requires="Operations:projects:edit">
              {nextStates.map((next) => (
                <button
                  key={next}
                  type="button"
                  onClick={() => { setStatusError(null); setConfirmStatus(next); }}
                  className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
                >
                  {t('projects:detail.moveTo', { status: t(`common:${getStatusLabelKey('project', next)}`) })}
                </button>
              ))}
            </PermissionGate>
          </div>
          {statusError && <p className="mt-2 text-sm text-danger" role="alert">{statusError}</p>}

          <PermissionGate requires="Operations:projects:assign">
            <div className="mt-6 rounded-lg border border-border bg-surface p-4">
              <p className="mb-2 text-sm font-medium text-ink">{t('projects:detail.assignManager')}</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setManagerError(null);
                  managerMutation.mutate(
                    { employeeId: managerId },
                    { onSuccess: () => setManagerId(''), onError: (err) => setManagerError(err instanceof ApiError ? err.message : t('common:error.generic')) },
                  );
                }}
                className="flex gap-2"
              >
                <input
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  placeholder={t('projects:detail.employeeIdPlaceholder')}
                  className="flex-1 rounded border border-border bg-surface px-3 py-1.5 text-sm text-ink"
                />
                <button type="submit" disabled={managerMutation.isPending || !managerId} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
                  {t('projects:detail.assign')}
                </button>
              </form>
              {managerError && <p className="mt-2 text-sm text-danger" role="alert">{managerError}</p>}
            </div>
          </PermissionGate>
        </>
      )}

      {tab === 'members' && <MembersTab projectId={project.id} />}

      <ConfirmDialog
        open={!!confirmStatus}
        onOpenChange={(open) => !open && setConfirmStatus(null)}
        title={t('projects:detail.statusChangeTitle')}
        message={t('projects:detail.statusChangeMessage', { status: confirmStatus ? t(`common:${getStatusLabelKey('project', confirmStatus)}`) : '' })}
        isLoading={statusMutation.isPending}
        onConfirm={() =>
          confirmStatus &&
          statusMutation.mutate(
            { status: confirmStatus as never },
            {
              onSuccess: () => setConfirmStatus(null),
              onError: (err) => {
                setConfirmStatus(null);
                setStatusError(err instanceof ApiError ? err.message : t('common:error.generic'));
              },
            },
          )
        }
      />
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

function MembersTab({ projectId }: { projectId: string }) {
  const { t } = useTranslation(['projects', 'common']);
  const { data: members, isLoading } = useProjectMembers(projectId);
  const addMutation = useAddProjectMember(projectId);
  const removeMutation = useRemoveProjectMember(projectId);
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState<string>(PROJECT_MEMBER_ROLES[5]);
  const [addError, setAddError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  if (isLoading) return <LoadingState variant="table" />;

  return (
    <div>
      <PermissionGate requires="Operations:project_members:manage">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setAddError(null);
            addMutation.mutate(
              { employeeId, role },
              { onSuccess: () => setEmployeeId(''), onError: (err) => setAddError(err instanceof ApiError ? err.message : t('common:error.generic')) },
            );
          }}
          className="mb-3 flex flex-wrap gap-2"
        >
          <input
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            placeholder={t('projects:detail.employeeIdPlaceholder')}
            className="rounded border border-border bg-surface px-3 py-1.5 text-sm text-ink"
          />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded border border-border bg-surface px-3 py-1.5 text-sm text-ink">
            {PROJECT_MEMBER_ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`projects:memberRole.${r}`)}
              </option>
            ))}
          </select>
          <button type="submit" disabled={addMutation.isPending || !employeeId} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
            {t('projects:detail.addMember')}
          </button>
        </form>
        {addError && <p className="mb-3 text-sm text-danger" role="alert">{addError}</p>}
      </PermissionGate>

      {(!members || members.length === 0) ? (
        <EmptyState title={t('projects:detail.noMembers')} />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {members.map((m) => (
            <li key={m.employeeId} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <div>
                <span className="font-mono text-xs text-ink-muted">{m.employeeId.slice(0, 8)}…</span>
                <span className="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{t(`projects:memberRole.${m.role}`)}</span>
              </div>
              <PermissionGate requires="Operations:project_members:manage">
                <button type="button" onClick={() => setConfirmRemove(m.employeeId)} className="text-xs font-medium text-danger hover:underline">
                  {t('common:action.delete')}
                </button>
              </PermissionGate>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <AttachmentsSection entityType="project" entityId={projectId} />
      </div>

      <ConfirmDialog
        open={!!confirmRemove}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
        title={t('projects:detail.removeMemberTitle')}
        message={t('projects:detail.removeMemberMessage')}
        variant="destructive"
        isLoading={removeMutation.isPending}
        onConfirm={() => confirmRemove && removeMutation.mutate(confirmRemove, { onSuccess: () => setConfirmRemove(null) })}
      />

      <TimeSummaryCard type="project" id={projectId} />
    </div>
  );
}
