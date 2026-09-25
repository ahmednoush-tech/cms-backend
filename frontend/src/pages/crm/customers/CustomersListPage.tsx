import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCustomers, useCreateCustomer, useCheckCustomerDuplicates } from '../../../api/queries/useCustomers';
import { Modal } from '../../../components/Modal/Modal';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable/DataTable';
import { SearchBar } from '../../../components/SearchBar/SearchBar';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { CustomerFormModal, type CustomerFormValues } from './CustomerFormModal';
import type { Customer } from '../../../types/entities/customer';
import type { DuplicateCandidate } from '../../../types/entities/duplicateCandidate';

/**
 * GET /customers has no dedicated filter DTO (confirmed this
 * session) — only search/pagination/sort. No status FilterBar is
 * offered here, unlike Opportunities/Quotations, since the
 * backend has no query param to back one.
 */
export function CustomersListPage() {
  const { t } = useTranslation(['customers', 'common']);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, error } = useCustomers({ page, pageSize: 20, search: search || undefined });
  const createMutation = useCreateCustomer();
  const checkDuplicatesMutation = useCheckCustomerDuplicates();

  /** Holds the form's values while a duplicate-confirmation dialog is showing, so "Create Anyway" can resume the exact same submission. */
  const [pendingValues, setPendingValues] = useState<CustomerFormValues | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);

  const doCreate = (values: CustomerFormValues) => {
    createMutation.mutate(
      { ...values, email: values.email || undefined },
      {
        onSuccess: () => {
          setCreateOpen(false);
          setPendingValues(null);
          setDuplicates([]);
        },
      },
    );
  };

  const columns: Array<DataTableColumn<Customer>> = [
    { key: 'customerCode', headerKey: 'customers:columns.code', render: (c) => c.customerCode },
    {
      key: 'name',
      headerKey: 'customers:columns.name',
      render: (c) => c.companyName ?? '—',
    },
    { key: 'email', headerKey: 'customers:columns.email', render: (c) => c.email ?? '—' },
    { key: 'status', headerKey: 'customers:columns.status', render: (c) => t(`customers:status.${c.status}`) },
  ];

  return (
    <div>
      <PageHeader
        title={t('customers:title')}
        action={
          <PermissionGate requires={PERMISSIONS.CRM.customers.create}>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90"
            >
              {t('customers:action.create')}
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
        rowKey={(c) => c.id}
        isLoading={isLoading}
        error={error}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle={t('customers:empty.title')}
        emptyDescription={t('customers:empty.description')}
        emptyAction={
          <PermissionGate requires={PERMISSIONS.CRM.customers.create}>
            <button type="button" onClick={() => setCreateOpen(true)} className="text-sm font-medium text-primary hover:underline">
              {t('customers:action.create')}
            </button>
          </PermissionGate>
        }
        onRowClick={(c) => navigate(`/crm/customers/${c.id}`)}
      />

      <CustomerFormModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        isSubmitting={createMutation.isPending || checkDuplicatesMutation.isPending}
        onSubmit={(values: CustomerFormValues) => {
          checkDuplicatesMutation.mutate(
            { email: values.email || undefined, phone: values.phone || undefined, companyName: values.companyName || undefined },
            {
              onSuccess: (candidates) => {
                if (candidates.length > 0) {
                  setPendingValues(values);
                  setDuplicates(candidates);
                } else {
                  doCreate(values);
                }
              },
              // If the duplicate check itself fails (network error, etc.), don't block the user from creating — proceed as if no duplicates were found.
              onError: () => doCreate(values),
            },
          );
        }}
      />

      <Modal
        open={duplicates.length > 0}
        onOpenChange={(open) => {
          if (!open) {
            setDuplicates([]);
            setPendingValues(null);
          }
        }}
        title={t('customers:duplicates.title')}
      >
        <p className="mb-3 text-sm text-ink-muted">{t('customers:duplicates.description')}</p>
        <ul className="mb-4 divide-y divide-border rounded-lg border border-border">
          {duplicates.map((d) => (
            <li key={d.id} className="p-3 text-sm">
              <p className="font-medium text-ink">{d.companyName ?? d.customerCode}</p>
              <p className="text-xs text-ink-muted">
                {t('customers:duplicates.matchedOn', { fields: d.matchedOn.map((f) => t(`customers:duplicates.field.${f}`)).join(', ') })}
              </p>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setDuplicates([]);
              setPendingValues(null);
            }}
            className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
          >
            {t('common:action.cancel')}
          </button>
          <button
            type="button"
            onClick={() => {
              if (pendingValues) doCreate(pendingValues);
              setDuplicates([]);
            }}
            disabled={createMutation.isPending}
            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50"
          >
            {t('customers:duplicates.createAnyway')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
