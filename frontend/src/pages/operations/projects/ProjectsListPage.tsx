import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useProjects, useCreateProject } from '../../../api/queries/useProjects';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable/DataTable';
import { SearchBar } from '../../../components/SearchBar/SearchBar';
import { FilterBar } from '../../../components/FilterBar/FilterBar';
import { StatusBadge } from '../../../components/StatusBadge/StatusBadge';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';
import { ProjectFormModal, type ProjectFormValues } from './ProjectFormModal';
import type { Project } from '../../../types/entities/project';

export function ProjectsListPage() {
  const { t } = useTranslation(['projects', 'common']);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data, isLoading, error } = useProjects({ page, pageSize: 20, search: search || undefined, customerId, status });
  const createMutation = useCreateProject();

  const columns: Array<DataTableColumn<Project>> = [
    { key: 'projectNumber', headerKey: 'projects:columns.number', render: (p) => p.projectNumber },
    { key: 'name', headerKey: 'projects:columns.name', render: (p) => p.name },
    { key: 'status', headerKey: 'projects:columns.status', render: (p) => <StatusBadge entity="project" value={p.status} /> },
    { key: 'endDate', headerKey: 'projects:columns.endDate', render: (p) => p.endDate?.slice(0, 10) ?? '—' },
  ];

  return (
    <div>
      <PageHeader
        title={t('projects:title')}
        action={
          <PermissionGate requires={PERMISSIONS.Operations.projects.create}>
            <button type="button" onClick={() => setCreateOpen(true)} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('projects:action.create')}
            </button>
          </PermissionGate>
        }
      />

      <div className="mb-4">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
      </div>

      <FilterBar
        fields={[
          { key: 'customerId', labelKey: 'projects:filters.customerId', type: 'text' },
          {
            key: 'status',
            labelKey: 'projects:filters.status',
            type: 'select',
            options: ['planning', 'approved', 'in_progress', 'on_hold', 'completed', 'cancelled'].map((s) => ({
              value: s,
              labelKey: `common:status.project.${s}`,
            })),
          },
        ]}
        values={{ customerId, status }}
        onChange={(key, value) => {
          setPage(1);
          if (key === 'customerId') setCustomerId(value);
          if (key === 'status') setStatus(value);
        }}
        onClear={() => { setCustomerId(undefined); setStatus(undefined); setPage(1); }}
      />

      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(p) => p.id}
        isLoading={isLoading}
        error={error}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle={t('projects:empty.title')}
        emptyDescription={t('projects:empty.description')}
        onRowClick={(p) => navigate(`/ops/projects/${p.id}`)}
      />

      <ProjectFormModal
        open={createOpen}
        onOpenChange={(open) => { setCreateOpen(open); if (!open) setCreateError(null); }}
        isSubmitting={createMutation.isPending}
        submitError={createError}
        onSubmit={(values: ProjectFormValues) => {
          setCreateError(null);
          createMutation.mutate(
            {
              ...values,
              opportunityId: values.opportunityId || undefined,
              quotationId: values.quotationId || undefined,
              projectManagerId: values.projectManagerId || undefined,
            },
            {
              onSuccess: (project) => {
                setCreateOpen(false);
                navigate(`/ops/projects/${project.id}`);
              },
              onError: (err) => setCreateError(err instanceof ApiError ? err.message : t('common:error.generic')),
            },
          );
        }}
      />
    </div>
  );
}
