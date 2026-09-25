import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuotations, useCreateQuotation } from '../../../api/queries/useQuotations';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable/DataTable';
import { SearchBar } from '../../../components/SearchBar/SearchBar';
import { FilterBar } from '../../../components/FilterBar/FilterBar';
import { StatusBadge } from '../../../components/StatusBadge/StatusBadge';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { QuotationCreateModal, type QuotationFormValues } from './QuotationCreateModal';
import type { Quotation } from '../../../types/entities/quotation';

export function QuotationsListPage() {
  const { t } = useTranslation(['quotations', 'common']);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [customerId, setCustomerId] = useState<string | undefined>();
  const [status, setStatus] = useState<string | undefined>();
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, error } = useQuotations({
    page,
    pageSize: 20,
    search: search || undefined,
    customerId,
    status,
  });
  const createMutation = useCreateQuotation();

  const columns: Array<DataTableColumn<Quotation>> = [
    { key: 'quotationNumber', headerKey: 'quotations:columns.number', render: (q) => q.quotationNumber },
    { key: 'status', headerKey: 'quotations:columns.status', render: (q) => <StatusBadge entity="quotation" value={q.status} /> },
    { key: 'total', headerKey: 'quotations:columns.total', render: (q) => <FinancialValue value={q.total} /> },
    { key: 'validUntil', headerKey: 'quotations:columns.validUntil', render: (q) => q.validUntil?.slice(0, 10) ?? '—' },
  ];

  return (
    <div>
      <PageHeader
        title={t('quotations:title')}
        action={
          <PermissionGate requires={PERMISSIONS.CRM.quotations.create}>
            <button type="button" onClick={() => setCreateOpen(true)} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('quotations:action.create')}
            </button>
          </PermissionGate>
        }
      />

      <div className="mb-4">
        <SearchBar value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
      </div>

      <FilterBar
        fields={[
          { key: 'customerId', labelKey: 'quotations:filters.customerId', type: 'text' },
          {
            key: 'status',
            labelKey: 'quotations:filters.status',
            type: 'select',
            options: ['draft', 'sent', 'accepted', 'rejected', 'expired'].map((s) => ({
              value: s,
              labelKey: `common:status.quotation.${s}`,
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
        rowKey={(q) => q.id}
        isLoading={isLoading}
        error={error}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle={t('quotations:empty.title')}
        emptyDescription={t('quotations:empty.description')}
        onRowClick={(q) => navigate(`/crm/quotations/${q.id}`)}
      />

      <QuotationCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        isSubmitting={createMutation.isPending}
        onSubmit={(values: QuotationFormValues) => {
          createMutation.mutate(
            {
              ...values,
              opportunityId: values.opportunityId || undefined,
              exchangeRateToBase: values.currencyCode !== 'SAR' && values.exchangeRateToBase ? Number(values.exchangeRateToBase) : undefined,
            },
            {
              onSuccess: (quotation) => {
                setCreateOpen(false);
                navigate(`/crm/quotations/${quotation.id}`);
              },
            },
          );
        }}
      />
    </div>
  );
}
