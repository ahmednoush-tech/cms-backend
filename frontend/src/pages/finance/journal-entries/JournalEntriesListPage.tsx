import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useJournalEntries } from '../../../api/queries/useFinance';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable/DataTable';
import { SearchBar } from '../../../components/SearchBar/SearchBar';
import { FilterBar } from '../../../components/FilterBar/FilterBar';
import { StatusBadge } from '../../../components/StatusBadge/StatusBadge';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import type { JournalEntry, JournalEntryStatus } from '../../../types/entities/finance';

export function JournalEntriesListPage() {
  const { t } = useTranslation(['finance', 'common']);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<JournalEntryStatus | undefined>();

  const { data, isLoading, error } = useJournalEntries({ page, pageSize: 20, search: search || undefined, status });

  const columns: Array<DataTableColumn<JournalEntry>> = [
    { key: 'entryNumber', headerKey: 'finance:journalEntries.columns.entryNumber', render: (e) => e.entryNumber },
    { key: 'entryDate', headerKey: 'finance:journalEntries.columns.entryDate', render: (e) => e.entryDate.slice(0, 10) },
    { key: 'reference', headerKey: 'finance:journalEntries.columns.reference', render: (e) => e.reference ?? '—' },
    { key: 'status', headerKey: 'finance:journalEntries.columns.status', render: (e) => <StatusBadge entity="journalEntry" value={e.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title={t('finance:journalEntries.title')}
        action={
          <PermissionGate requires={PERMISSIONS.Finance.journalEntries.create}>
            <button type="button" onClick={() => navigate('/finance/journal-entries/new')} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('finance:journalEntries.action.create')}
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
            labelKey: 'finance:journalEntries.filters.status',
            type: 'select',
            options: ['draft', 'posted', 'void'].map((s) => ({ value: s, labelKey: `common:status.journalEntry.${s}` })),
          },
        ]}
        values={{ status }}
        onChange={(key, value) => { setPage(1); if (key === 'status') setStatus(value as JournalEntryStatus | undefined); }}
        onClear={() => { setStatus(undefined); setPage(1); }}
      />

      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(e) => e.id}
        isLoading={isLoading}
        error={error}
        meta={data?.meta}
        onPageChange={setPage}
        emptyTitle={t('finance:journalEntries.empty.title')}
        emptyDescription={t('finance:journalEntries.empty.description')}
        onRowClick={(e) => navigate(`/finance/journal-entries/${e.id}`)}
      />
    </div>
  );
}
