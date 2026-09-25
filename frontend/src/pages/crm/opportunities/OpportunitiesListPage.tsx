import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useOpportunities, useCreateOpportunity } from '../../../api/queries/useOpportunities';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable/DataTable';
import { SearchBar } from '../../../components/SearchBar/SearchBar';
import { FilterBar } from '../../../components/FilterBar/FilterBar';
import { StatusBadge } from '../../../components/StatusBadge/StatusBadge';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { OpportunityFormModal, type OpportunityFormValues } from './OpportunityFormModal';
import type { Opportunity } from '../../../types/entities/opportunity';

/** GET /opportunities supports customerId + stage filters (confirmed via OpportunityFiltersDto) — unlike Customers/Leads. */
export function OpportunitiesListPage() {
  const { t } = useTranslation(['opportunities', 'common']);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [stage, setStage] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, error } = useOpportunities({
    page,
    pageSize: 20,
    search: search || undefined,
    customerId,
    stage,
  });
  const createMutation = useCreateOpportunity();

  const columns: Array<DataTableColumn<Opportunity>> = [
    { key: 'name', headerKey: 'opportunities:columns.name', render: (o) => o.name },
    { key: 'stage', headerKey: 'opportunities:columns.stage', render: (o) => <StatusBadge entity="opportunity" value={o.stage} /> },
    {
      key: 'value',
      headerKey: 'opportunities:columns.value',
      render: (o) => (o.value ? <FinancialValue value={o.value} currency={o.currency ?? 'SAR'} /> : '—'),
    },
    { key: 'probability', headerKey: 'opportunities:columns.probability', render: (o) => (o.probability != null ? `${o.probability}%` : '—') },
  ];

  return (
    <div>
      <PageHeader
        title={t('opportunities:title')}
        action={
          <PermissionGate requires={PERMISSIONS.CRM.opportunities.create}>
            <button type="button" onClick={() => setCreateOpen(true)} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('opportunities:action.create')}
            </button>
          </PermissionGate>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
      </div>

      <FilterBar
        fields={[
          { key: 'customerId', labelKey: 'opportunities:filters.customerId', type: 'text' },
          {
            key: 'stage',
            labelKey: 'opportunities:filters.stage',
            type: 'select',
            options: ['prospecting', 'qualification', 'proposal', 'negotiation', 'won', 'lost'].map((s) => ({
              value: s,
              labelKey: `common:status.opportunity.${s}`,
            })),
          },
        ]}
        values={{ customerId, stage }}
        onChange={(key, value) => {
          setPage(1);
          if (key === 'customerId') setCustomerId(value);
          if (key === 'stage') setStage(value);
        }}
        onClear={() => { setCustomerId(undefined); setStage(undefined); setPage(1); }}
      />

      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(o) => o.id}
        isLoading={isLoading}
        error={error}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle={t('opportunities:empty.title')}
        emptyDescription={t('opportunities:empty.description')}
        onRowClick={(o) => navigate(`/crm/opportunities/${o.id}`)}
      />

      <OpportunityFormModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        isSubmitting={createMutation.isPending}
        onSubmit={(values: OpportunityFormValues) => {
          createMutation.mutate(values, { onSuccess: () => setCreateOpen(false) });
        }}
      />
    </div>
  );
}
