import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useVendor, useUpdateVendor, useBills } from '../../../api/queries/useFinance';
import { usePurchaseOrders } from '../../../api/queries/usePurchaseOrders';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { StatusBadge } from '../../../components/StatusBadge/StatusBadge';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { VendorFormModal, type VendorFormValues } from '../vendors/VendorFormModal';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';

export function VendorDetailPage() {
  const { t } = useTranslation(['purchaseOrders', 'finance', 'common']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: vendor, isLoading, error } = useVendor(id);
  const updateMutation = useUpdateVendor(id ?? '');

  const { data: purchaseOrders } = usePurchaseOrders({ page: 1, pageSize: 10, vendorId: id });
  const { data: bills } = useBills({ page: 1, pageSize: 10, vendorId: id });

  const [editOpen, setEditOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleUpdate = (values: VendorFormValues) => {
    setFormError(null);
    updateMutation.mutate(
      {
        name: values.name,
        email: values.email || undefined,
        phone: values.phone || undefined,
        address: values.address || undefined,
        city: values.city || undefined,
        country: values.country || undefined,
      },
      {
        onSuccess: () => setEditOpen(false),
        onError: (err) => setFormError(err instanceof ApiError ? err.message : t('common:error.generic')),
      },
    );
  };

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error instanceof ApiError ? error.message : undefined} />;
  if (!vendor) return null;

  return (
    <div>
      <button type="button" onClick={() => navigate('/finance/vendors')} className="mb-3 text-sm text-ink-muted hover:text-ink">
        ← {t('common:action.back')}
      </button>

      <PageHeader
        title={vendor.name}
        breadcrumb={vendor.vendorCode}
        action={
          <PermissionGate requires={PERMISSIONS.Finance.vendors.edit}>
            <button
              type="button"
              onClick={() => { setFormError(null); setEditOpen(true); }}
              className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
            >
              {t('common:action.edit')}
            </button>
          </PermissionGate>
        }
      />

      <dl className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t('finance:vendors.fields.status')}</dt>
          <dd className="mt-0.5">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${vendor.status === 'active' ? 'bg-success/10 text-success' : 'bg-surface-muted text-ink-muted'}`}>
              {vendor.status === 'active' ? t('finance:vendors.status.active') : t('finance:vendors.status.inactive')}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t('finance:vendors.fields.email')}</dt>
          <dd className="mt-0.5 text-sm text-ink">{vendor.email ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t('finance:vendors.fields.phone')}</dt>
          <dd className="mt-0.5 text-sm text-ink">{vendor.phone ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t('finance:vendors.fields.address')}</dt>
          <dd className="mt-0.5 text-sm text-ink">{vendor.address ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t('finance:vendors.fields.city')}</dt>
          <dd className="mt-0.5 text-sm text-ink">{vendor.city ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t('finance:vendors.fields.country')}</dt>
          <dd className="mt-0.5 text-sm text-ink">{vendor.country ?? '—'}</dd>
        </div>
      </dl>

      <div className="mb-6">
        <p className="mb-2 text-sm font-medium text-ink">{t('purchaseOrders:title')}</p>
        {(!purchaseOrders || purchaseOrders.items.length === 0) && <p className="text-sm text-ink-muted">{t('finance:vendors.detail.noPurchaseOrders')}</p>}
        {purchaseOrders && purchaseOrders.items.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-start text-sm">
              <tbody className="divide-y divide-border">
                {purchaseOrders.items.map((po) => (
                  <tr key={po.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => navigate(`/finance/purchase-orders/${po.id}`)}>
                    <td className="p-3 font-medium text-ink">{po.poNumber}</td>
                    <td className="p-3"><StatusBadge entity="purchaseOrder" value={po.status} /></td>
                    <td className="p-3 text-end text-ink"><FinancialValue value={po.total} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-ink">{t('finance:bills.title')}</p>
        {(!bills || bills.items.length === 0) && <p className="text-sm text-ink-muted">{t('finance:vendors.detail.noBills')}</p>}
        {bills && bills.items.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-start text-sm">
              <tbody className="divide-y divide-border">
                {bills.items.map((bill) => (
                  <tr key={bill.id} className="cursor-pointer hover:bg-surface-muted" onClick={() => navigate(`/finance/bills/${bill.id}`)}>
                    <td className="p-3 font-medium text-ink">{bill.billNumber}</td>
                    <td className="p-3"><StatusBadge entity="bill" value={bill.status} /></td>
                    <td className="p-3 text-end text-ink"><FinancialValue value={bill.total} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <VendorFormModal
        open={editOpen}
        onOpenChange={setEditOpen}
        isSubmitting={updateMutation.isPending}
        submitError={formError}
        mode="edit"
        initialValues={vendor}
        onSubmit={handleUpdate}
      />
    </div>
  );
}
