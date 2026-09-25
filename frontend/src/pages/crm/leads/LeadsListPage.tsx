import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useLeads, useCreateLead } from '../../../api/queries/useLeads';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable/DataTable';
import { SearchBar } from '../../../components/SearchBar/SearchBar';
import { StatusBadge } from '../../../components/StatusBadge/StatusBadge';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { LeadFormModal, type LeadFormValues } from './LeadFormModal';
import type { Lead } from '../../../types/entities/lead';

/** GET /leads has no filter DTO (confirmed this session) — search/pagination/sort only, no status FilterBar. */
export function LeadsListPage() {
  const { t } = useTranslation(['leads', 'common']);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, error } = useLeads({ page, pageSize: 20, search: search || undefined });
  const createMutation = useCreateLead();

  const columns: Array<DataTableColumn<Lead>> = [
    { key: 'name', headerKey: 'leads:columns.name', render: (l) => l.name },
    { key: 'companyName', headerKey: 'leads:columns.company', render: (l) => l.companyName ?? '—' },
    { key: 'status', headerKey: 'leads:columns.status', render: (l) => <StatusBadge entity="lead" value={l.status} /> },
    { key: 'source', headerKey: 'leads:columns.source', render: (l) => l.source ?? '—' },
  ];

  return (
    <div>
      <PageHeader
        title={t('leads:title')}
        action={
          <PermissionGate requires={PERMISSIONS.CRM.leads.create}>
            <button type="button" onClick={() => setCreateOpen(true)} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('leads:action.create')}
            </button>
          </PermissionGate>
        }
      />

      <div className="mb-4">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
      </div>

      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(l) => l.id}
        isLoading={isLoading}
        error={error}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle={t('leads:empty.title')}
        emptyDescription={t('leads:empty.description')}
        onRowClick={(l) => navigate(`/crm/leads/${l.id}`)}
      />

      <LeadFormModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        isSubmitting={createMutation.isPending}
        onSubmit={(values: LeadFormValues) => {
          createMutation.mutate({ ...values, email: values.email || undefined }, { onSuccess: () => setCreateOpen(false) });
        }}
      />
    </div>
  );
}
