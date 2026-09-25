import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useFixedAssets } from '../../../api/queries/useFixedAssets';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable/DataTable';
import { StatusBadge } from '../../../components/StatusBadge/StatusBadge';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import type { FixedAsset, FixedAssetStatus } from '../../../types/entities/fixedAsset';

const STATUS_FILTERS: Array<FixedAssetStatus | 'all'> = ['all', 'active', 'fully_depreciated', 'disposed'];

export function FixedAssetsListPage() {
  const { t } = useTranslation(['fixedAssets', 'common']);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<FixedAssetStatus | 'all'>('all');

  const { data, isLoading, error } = useFixedAssets({
    page,
    pageSize: 20,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const columns: Array<DataTableColumn<FixedAsset>> = [
    { key: 'assetNumber', headerKey: 'fixedAssets:columns.assetNumber', render: (a) => a.assetNumber },
    { key: 'name', headerKey: 'fixedAssets:columns.name', render: (a) => a.name },
    { key: 'category', headerKey: 'fixedAssets:columns.category', render: (a) => a.category ?? '—' },
    { key: 'status', headerKey: 'fixedAssets:columns.status', render: (a) => <StatusBadge entity="fixedAsset" value={a.status} /> },
    { key: 'purchaseCost', headerKey: 'fixedAssets:columns.purchaseCost', render: (a) => <FinancialValue value={a.purchaseCost} /> },
    { key: 'accumulatedDepreciation', headerKey: 'fixedAssets:columns.accumulatedDepreciation', render: (a) => <FinancialValue value={a.accumulatedDepreciation} /> },
    {
      key: 'netBookValue',
      headerKey: 'fixedAssets:columns.netBookValue',
      render: (a) => <FinancialValue value={(Number(a.purchaseCost) - Number(a.accumulatedDepreciation)).toFixed(2)} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('fixedAssets:title')}
        action={
          <div className="flex gap-2">
            <PermissionGate requires={PERMISSIONS.Finance.depreciationRuns.create}>
              <button
                type="button"
                onClick={() => navigate('/finance/depreciation-runs')}
                className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
              >
                {t('fixedAssets:actions.depreciationRuns')}
              </button>
            </PermissionGate>
            <PermissionGate requires={PERMISSIONS.Finance.fixedAssets.create}>
              <button
                type="button"
                onClick={() => navigate('/finance/fixed-assets/new')}
                className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90"
              >
                {t('fixedAssets:actions.new')}
              </button>
            </PermissionGate>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${statusFilter === s ? 'bg-primary text-primary-fg' : 'bg-surface-muted text-ink-muted hover:bg-surface'}`}
          >
            {s === 'all' ? t('common:filter.all') : t(`common:status.fixedAsset.${s}`)}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(a) => a.id}
        isLoading={isLoading}
        error={error}
        meta={data?.meta}
        onPageChange={setPage}
        onRowClick={(a) => navigate(`/finance/fixed-assets/${a.id}`)}
        emptyTitle={t('fixedAssets:empty.title')}
        emptyDescription={t('fixedAssets:empty.description')}
      />
    </div>
  );
}
