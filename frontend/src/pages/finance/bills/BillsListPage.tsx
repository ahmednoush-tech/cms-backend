import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useBills } from '../../../api/queries/useFinance';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable/DataTable';
import { SearchBar } from '../../../components/SearchBar/SearchBar';
import { FilterBar } from '../../../components/FilterBar/FilterBar';
import { StatusBadge } from '../../../components/StatusBadge/StatusBadge';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import type { Bill, BillStatus } from '../../../types/entities/finance';

export function BillsListPage() {
  const { t } = useTranslation(['finance', 'common']);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<BillStatus | undefined>();

  const { data, isLoading, error } = useBills({ page, pageSize: 20, search: search || undefined, status });

  const columns: Array<DataTableColumn<Bill>> = [
    { key: 'billNumber', headerKey: 'finance:bills.columns.billNumber', render: (b) => b.billNumber },
    { key: 'billDate', headerKey: 'finance:bills.columns.billDate', render: (b) => b.billDate.slice(0, 10) },
    { key: 'total', headerKey: 'finance:bills.columns.total', render: (b) => <FinancialValue value={b.total} /> },
    { key: 'amountPaid', headerKey: 'finance:bills.columns.amountPaid', render: (b) => <FinancialValue value={b.amountPaid} /> },
    { key: 'status', headerKey: 'finance:bills.columns.status', render: (b) => <StatusBadge entity="bill" value={b.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title={t('finance:bills.title')}
        action={
          <PermissionGate requires={PERMISSIONS.Finance.bills.create}>
            <button type="button" onClick={() => navigate('/finance/bills/new')} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('finance:bills.action.create')}
            </button>
          </PermissionGate>
        }
      />

      <div className="mb-4">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
      </div>

      <FilterBar
        fields={[
          {
            key: 'status',
            labelKey: 'finance:bills.filters.status',
            type: 'select',
            options: ['draft', 'received', 'partially_paid', 'paid', 'overdue', 'cancelled'].map((s) => ({ value: s, labelKey: `common:status.bill.${s}` })),
          },
        ]}
        values={{ status }}
        onChange={(key, value) => { setPage(1); if (key === 'status') setStatus(value as BillStatus | undefined); }}
        onClear={() => { setStatus(undefined); setPage(1); }}
      />

      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(b) => b.id}
        isLoading={isLoading}
        error={error}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle={t('finance:bills.empty.title')}
        emptyDescription={t('finance:bills.empty.description')}
        onRowClick={(b) => navigate(`/finance/bills/${b.id}`)}
      />
    </div>
  );
}
