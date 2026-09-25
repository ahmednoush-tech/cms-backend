import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useInvoices } from '../../../api/queries/useFinance';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable/DataTable';
import { SearchBar } from '../../../components/SearchBar/SearchBar';
import { FilterBar } from '../../../components/FilterBar/FilterBar';
import { StatusBadge } from '../../../components/StatusBadge/StatusBadge';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import type { Invoice, InvoiceStatus } from '../../../types/entities/finance';

export function InvoicesListPage() {
  const { t } = useTranslation(['finance', 'common']);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<InvoiceStatus | undefined>();

  const { data, isLoading, error } = useInvoices({ page, pageSize: 20, search: search || undefined, status });

  const columns: Array<DataTableColumn<Invoice>> = [
    { key: 'invoiceNumber', headerKey: 'finance:invoices.columns.invoiceNumber', render: (i) => i.invoiceNumber },
    { key: 'issueDate', headerKey: 'finance:invoices.columns.issueDate', render: (i) => i.issueDate.slice(0, 10) },
    { key: 'total', headerKey: 'finance:invoices.columns.total', render: (i) => <FinancialValue value={i.total} /> },
    { key: 'amountPaid', headerKey: 'finance:invoices.columns.amountPaid', render: (i) => <FinancialValue value={i.amountPaid} /> },
    { key: 'status', headerKey: 'finance:invoices.columns.status', render: (i) => <StatusBadge entity="invoice" value={i.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title={t('finance:invoices.title')}
        action={
          <PermissionGate requires={PERMISSIONS.Finance.invoices.create}>
            <button type="button" onClick={() => navigate('/finance/invoices/new')} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('finance:invoices.action.create')}
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
            labelKey: 'finance:invoices.filters.status',
            type: 'select',
            options: ['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'].map((s) => ({ value: s, labelKey: `common:status.invoice.${s}` })),
          },
        ]}
        values={{ status }}
        onChange={(key, value) => { setPage(1); if (key === 'status') setStatus(value as InvoiceStatus | undefined); }}
        onClear={() => { setStatus(undefined); setPage(1); }}
      />

      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(i) => i.id}
        isLoading={isLoading}
        error={error}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle={t('finance:invoices.empty.title')}
        emptyDescription={t('finance:invoices.empty.description')}
        onRowClick={(i) => navigate(`/finance/invoices/${i.id}`)}
      />
    </div>
  );
}
