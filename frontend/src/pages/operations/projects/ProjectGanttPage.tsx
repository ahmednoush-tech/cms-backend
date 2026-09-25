import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useProjectGantt } from '../../../api/queries/useProjects';
import { useAddTaskDependency, useRemoveTaskDependency } from '../../../api/queries/useTasks';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { GanttChart } from '../../../components/GanttChart/GanttChart';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';

export function ProjectGanttPage() {
  const { t } = useTranslation(['projects', 'common']);
  const { id } = useParams<{ id: string }>();
  const { data: gantt, isLoading, error } = useProjectGantt(id);

  const addDependencyMutation = useAddTaskDependency();
  const removeDependencyMutation = useRemoveTaskDependency();

  const [taskId, setTaskId] = useState('');
  const [dependsOnTaskId, setDependsOnTaskId] = useState('');
  const [dependencyError, setDependencyError] = useState<string | null>(null);

  if (isLoading) return <LoadingState variant="page" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant={apiError?.status === 404 ? 'not-found' : 'generic'} message={apiError?.message} />;
  }
  if (!gantt) return null;

  const handleAddDependency = (e: React.FormEvent) => {
    e.preventDefault();
    setDependencyError(null);
    addDependencyMutation.mutate(
      { taskId, input: { dependsOnTaskId } },
      {
        onSuccess: () => {
          setTaskId('');
          setDependsOnTaskId('');
        },
        onError: (err) => setDependencyError(err instanceof ApiError ? err.message : t('common:error.generic')),
      },
    );
  };

  return (
    <div>
      <PageHeader title={t('projects:gantt.title', { name: gantt.project.name })} breadcrumb={t('projects:title')} />

      <div className="mb-4">
        <GanttChart tasks={gantt.tasks} projectStartDate={gantt.project.startDate} projectEndDate={gantt.project.endDate} />
      </div>

      <PermissionGate requires={PERMISSIONS.Operations.tasks.edit}>
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="mb-3 text-sm font-medium text-ink">{t('projects:gantt.addDependency')}</p>
          <form onSubmit={handleAddDependency} className="flex flex-wrap items-end gap-2">
            <select value={taskId} onChange={(e) => setTaskId(e.target.value)} required className="rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
              <option value="">{t('projects:gantt.selectTask')}</option>
              {gantt.tasks.map((task) => (
                <option key={task.id} value={task.id}>{task.title}</option>
              ))}
            </select>
            <span className="text-sm text-ink-muted">{t('projects:gantt.dependsOn')}</span>
            <select value={dependsOnTaskId} onChange={(e) => setDependsOnTaskId(e.target.value)} required className="rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
              <option value="">{t('projects:gantt.selectTask')}</option>
              {gantt.tasks.map((task) => (
                <option key={task.id} value={task.id}>{task.title}</option>
              ))}
            </select>
            <button type="submit" disabled={addDependencyMutation.isPending} className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
              {addDependencyMutation.isPending ? t('common:action.processing') : t('common:action.add')}
            </button>
          </form>
          {dependencyError && <p className="mt-2 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{dependencyError}</p>}

          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 text-xs font-medium text-ink-muted">{t('projects:gantt.existingDependencies')}</p>
            {gantt.tasks.every((tk) => tk.dependencies.length === 0) ? (
              <p className="text-sm text-ink-muted">{t('projects:gantt.noDependenciesYet')}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {gantt.tasks.flatMap((task) =>
                  task.dependencies.map((dep) => {
                    const predecessor = gantt.tasks.find((tk) => tk.id === dep.dependsOnTaskId);
                    return (
                      <li key={dep.id} className="flex items-center justify-between">
                        <span>
                          <strong>{task.title}</strong> {t('projects:gantt.dependsOn')} <strong>{predecessor?.title ?? '—'}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeDependencyMutation.mutate(dep.id)}
                          disabled={removeDependencyMutation.isPending}
                          className="text-xs font-medium text-danger hover:underline"
                        >
                          {t('common:action.delete')}
                        </button>
                      </li>
                    );
                  }),
                )}
              </ul>
            )}
          </div>
        </div>
      </PermissionGate>
    </div>
  );
}
