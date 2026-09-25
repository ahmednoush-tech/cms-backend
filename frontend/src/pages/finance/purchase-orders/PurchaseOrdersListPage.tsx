import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { usePurchaseOrders } from '../../../api/queries/usePurchaseOrders';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { DataTable, type DataTableColumn } from '../../../components/DataTable/DataTable';
import { StatusBadge } from '../../../components/StatusBadge/StatusBadge';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import type { PurchaseOrder, PurchaseOrderStatus } from '../../../types/entities/purchaseOrder';

const STATUS_FILTERS: Array<PurchaseOrderStatus | 'all'> = ['all', 'draft', 'pending_approval', 'approved', 'sent', 'closed', 'rejected', 'cancelled'];

export function PurchaseOrdersListPage() {
  const { t } = useTranslation(['purchaseOrders', 'common']);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | 'all'>('all');

  const { data, isLoading, error } = usePurchaseOrders({
    page,
    pageSize: 20,
    status: statusFilter === 'all' ? undefined : statusFilter,
  });

  const columns: Array<DataTableColumn<PurchaseOrder>> = [
    { key: 'poNumber', headerKey: 'purchaseOrders:columns.poNumber', render: (po) => po.poNumber },
    { key: 'vendor', headerKey: 'purchaseOrders:columns.vendor', render: (po) => po.vendor?.name ?? '—' },
    { key: 'status', headerKey: 'purchaseOrders:columns.status', render: (po) => <StatusBadge entity="purchaseOrder" value={po.status} /> },
    { key: 'total', headerKey: 'purchaseOrders:columns.total', render: (po) => <FinancialValue value={po.total} /> },
    { key: 'expectedDeliveryDate', headerKey: 'purchaseOrders:columns.expectedDeliveryDate', render: (po) => po.expectedDeliveryDate?.slice(0, 10) ?? '—' },
  ];

  return (
    <div>
      <PageHeader
        title={t('purchaseOrders:title')}
        action={
          <PermissionGate requires={PERMISSIONS.Finance.purchaseOrders.create}>
            <button
              type="button"
              onClick={() => navigate('/finance/purchase-orders/new')}
              className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90"
            >
              {t('purchaseOrders:actions.new')}
            </button>
          </PermissionGate>
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
            {s === 'all' ? t('common:filter.all') : t(`common:status.purchaseOrder.${s}`)}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={data?.items}
        rowKey={(po) => po.id}
        isLoading={isLoading}
        error={error}
        meta={data?.meta}
        onPageChange={setPage}
        onRowClick={(po) => navigate(`/finance/purchase-orders/${po.id}`)}
        emptyTitle={t('purchaseOrders:empty.title')}
        emptyDescription={t('purchaseOrders:empty.description')}
      />
    </div>
  );
}
