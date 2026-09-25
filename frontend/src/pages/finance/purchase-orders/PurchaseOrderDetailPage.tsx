import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  usePurchaseOrder,
  useAddPurchaseOrderItem,
  useRemovePurchaseOrderItem,
  useSubmitPurchaseOrderForApproval,
  useApprovePurchaseOrder,
  useRejectPurchaseOrder,
  useSendPurchaseOrder,
  useCancelPurchaseOrder,
  useConvertPurchaseOrderToBill,
  useDeletePurchaseOrder,
  useReceivePurchaseOrder,
} from '../../../api/queries/usePurchaseOrders';
import { useWarehouses } from '../../../api/queries/useStockInventory';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { StatusBadge } from '../../../components/StatusBadge/StatusBadge';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { AttachmentsSection } from '../../../components/AttachmentsSection/AttachmentsSection';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';

type ConfirmAction = 'submit' | 'approve' | 'send' | 'cancel' | 'delete' | 'convertToBill' | null;

export function PurchaseOrderDetailPage() {
  const { t } = useTranslation(['purchaseOrders', 'finance', 'common']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: po, isLoading, error } = usePurchaseOrder(id);

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [itemForm, setItemForm] = useState({ description: '', quantity: '1', unitPrice: '0' });
  const [actionError, setActionError] = useState<string | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiveWarehouseId, setReceiveWarehouseId] = useState('');
  const [receiveQuantities, setReceiveQuantities] = useState<Record<string, string>>({});
  const [receiveError, setReceiveError] = useState<string | null>(null);

  const { data: warehouses } = useWarehouses();
  const activeWarehouses = (warehouses ?? []).filter((w) => w.isActive);
  const receiveMutation = useReceivePurchaseOrder(id ?? '');

  const addItemMutation = useAddPurchaseOrderItem(id ?? '');
  const removeItemMutation = useRemovePurchaseOrderItem(id ?? '');
  const submitMutation = useSubmitPurchaseOrderForApproval(id ?? '');
  const approveMutation = useApprovePurchaseOrder(id ?? '');
  const rejectMutation = useRejectPurchaseOrder(id ?? '');
  const sendMutation = useSendPurchaseOrder(id ?? '');
  const cancelMutation = useCancelPurchaseOrder(id ?? '');
  const convertMutation = useConvertPurchaseOrderToBill(id ?? '');
  const deleteMutation = useDeletePurchaseOrder();

  if (isLoading) return <LoadingState variant="page" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant={apiError?.status === 404 ? 'not-found' : 'generic'} message={apiError?.message} />;
  }
  if (!po) return null;

  const isDraft = po.status === 'draft';
  const handleError = (err: unknown) => setActionError(err instanceof ApiError ? err.message : t('common:error.generic'));

  const runConfirmedAction = () => {
    setActionError(null);
    const onError = (err: unknown) => { handleError(err); setConfirmAction(null); };
    if (confirmAction === 'submit') submitMutation.mutate(undefined, { onSuccess: () => setConfirmAction(null), onError });
    if (confirmAction === 'approve') approveMutation.mutate(undefined, { onSuccess: () => setConfirmAction(null), onError });
    if (confirmAction === 'send') sendMutation.mutate(undefined, { onSuccess: () => setConfirmAction(null), onError });
    if (confirmAction === 'cancel') cancelMutation.mutate(undefined, { onSuccess: () => setConfirmAction(null), onError });
    if (confirmAction === 'delete') deleteMutation.mutate(po.id, { onSuccess: () => navigate('/finance/purchase-orders'), onError });
    if (confirmAction === 'convertToBill') {
      convertMutation.mutate(undefined, { onSuccess: (bill) => navigate(`/finance/bills/${bill.id}`), onError });
    }
  };

  const isActionLoading = submitMutation.isPending || approveMutation.isPending || sendMutation.isPending || cancelMutation.isPending || deleteMutation.isPending || convertMutation.isPending;

  const handleAddItem = () => {
    setActionError(null);
    addItemMutation.mutate(
      { description: itemForm.description, quantity: Number(itemForm.quantity), unitPrice: Number(itemForm.unitPrice) },
      { onSuccess: () => setItemForm({ description: '', quantity: '1', unitPrice: '0' }), onError: handleError },
    );
  };

  const handleReject = () => {
    setActionError(null);
    rejectMutation.mutate(
      { rejectionReason },
      { onSuccess: () => { setRejectOpen(false); setRejectionReason(''); }, onError: handleError },
    );
  };

  return (
    <div>
      <PageHeader
        title={po.poNumber}
        breadcrumb={t('purchaseOrders:title')}
        action={<StatusBadge entity="purchaseOrder" value={po.status} />}
      />

      <div className="mb-4 grid grid-cols-2 gap-4 rounded-lg border border-border bg-surface p-4 text-sm md:grid-cols-4">
        <div>
          <p className="text-xs text-ink-muted">{t('purchaseOrders:fields.vendor')}</p>
          <p className="font-medium text-ink">{po.vendor?.name ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">{t('purchaseOrders:fields.expectedDeliveryDate')}</p>
          <p className="font-medium text-ink">{po.expectedDeliveryDate?.slice(0, 10) ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">{t('purchaseOrders:fields.total')}</p>
          <p className="font-medium text-ink"><FinancialValue value={po.total} /></p>
        </div>
        {po.approvedByUser && (
          <div>
            <p className="text-xs text-ink-muted">{t('purchaseOrders:fields.approvedBy')}</p>
            <p className="font-medium text-ink">{po.approvedByUser.email}</p>
          </div>
        )}
      </div>

      {po.status === 'rejected' && po.rejectionReason && (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          <p className="font-medium">{t('purchaseOrders:detail.rejectionReason')}</p>
          <p>{po.rejectionReason}</p>
        </div>
      )}

      {po.billId && (
        <div className="mb-4 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
          {t('purchaseOrders:detail.convertedNotice')}
        </div>
      )}

      <div className="mb-4 rounded-lg border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-medium text-ink">{t('finance:invoices.items')}</p>
        <table className="w-full text-start text-sm">
          <thead className="border-b border-border text-xs uppercase text-ink-muted">
            <tr>
              <th className="pb-2 text-start">{t('finance:invoices.fields.description')}</th>
              <th className="pb-2 text-start">{t('finance:invoices.fields.quantity')}</th>
              <th className="pb-2 text-start">{t('finance:invoices.fields.unitPrice')}</th>
              <th className="pb-2 text-start">{t('finance:invoices.fields.total')}</th>
              {isDraft && <th className="pb-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(po.items ?? []).map((item) => (
              <tr key={item.id}>
                <td className="py-2">{item.description}</td>
                <td className="py-2">{item.quantity}</td>
                <td className="py-2"><FinancialValue value={item.unitPrice} /></td>
                <td className="py-2"><FinancialValue value={item.total} /></td>
                {isDraft && (
                  <td className="py-2">
                    <button
                      type="button"
                      onClick={() => removeItemMutation.mutate(item.id, { onError: handleError })}
                      className="text-xs font-medium text-danger hover:underline"
                    >
                      {t('common:action.delete')}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {isDraft && (
          <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <input placeholder={t('finance:invoices.fields.description')} value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} className="flex-1 rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink" />
            <input type="number" step="0.01" min="0.01" value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })} className="w-20 rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink" />
            <input type="number" step="0.01" min="0" value={itemForm.unitPrice} onChange={(e) => setItemForm({ ...itemForm, unitPrice: e.target.value })} className="w-24 rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink" />
            <button type="button" onClick={handleAddItem} disabled={!itemForm.description || addItemMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
              {t('finance:invoices.addItem')}
            </button>
          </div>
        )}
      </div>

      <div className="mb-4">
        <AttachmentsSection entityType="purchase_order" entityId={po.id} />
      </div>

      {actionError && <p className="mb-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{actionError}</p>}

      <div className="flex flex-wrap gap-2">
        {isDraft && (
          <>
            <PermissionGate requires={PERMISSIONS.Finance.purchaseOrders.edit}>
              <button type="button" onClick={() => setConfirmAction('submit')} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
                {t('purchaseOrders:actions.submit')}
              </button>
            </PermissionGate>
            <PermissionGate requires={PERMISSIONS.Finance.purchaseOrders.delete}>
              <button type="button" onClick={() => setConfirmAction('delete')} className="rounded border border-danger px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10">
                {t('common:action.delete')}
              </button>
            </PermissionGate>
          </>
        )}
        {po.status === 'pending_approval' && (
          <PermissionGate requires={PERMISSIONS.Finance.purchaseOrders.approve}>
            <button type="button" onClick={() => setConfirmAction('approve')} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('purchaseOrders:actions.approve')}
            </button>
            <button type="button" onClick={() => setRejectOpen(true)} className="rounded border border-danger px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10">
              {t('purchaseOrders:actions.reject')}
            </button>
          </PermissionGate>
        )}
        {po.status === 'approved' && (
          <PermissionGate requires={PERMISSIONS.Finance.purchaseOrders.send}>
            <button type="button" onClick={() => setConfirmAction('send')} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('purchaseOrders:actions.send')}
            </button>
          </PermissionGate>
        )}
        {po.status === 'sent' && !po.billId && (
          <PermissionGate requires={PERMISSIONS.Finance.bills.create}>
            <button type="button" onClick={() => setConfirmAction('convertToBill')} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('purchaseOrders:actions.convertToBill')}
            </button>
          </PermissionGate>
        )}
        {po.status === 'sent' && (
          <PermissionGate requires={PERMISSIONS.Finance.purchaseOrders.receive}>
            <button
              type="button"
              onClick={() => {
                setReceiveError(null);
                setReceiveWarehouseId('');
                setReceiveQuantities({});
                setReceiveOpen(true);
              }}
              className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
            >
              {t('purchaseOrders:actions.receive')}
            </button>
          </PermissionGate>
        )}
        {['draft', 'pending_approval', 'approved'].includes(po.status) && (
          <PermissionGate requires={PERMISSIONS.Finance.purchaseOrders.edit}>
            <button type="button" onClick={() => setConfirmAction('cancel')} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('purchaseOrders:actions.cancel')}
            </button>
          </PermissionGate>
        )}
      </div>

      <ConfirmDialog
        open={confirmAction === 'submit'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={t('purchaseOrders:confirm.submitTitle')}
        message={t('purchaseOrders:confirm.submitMessage')}
        onConfirm={runConfirmedAction}
        isLoading={isActionLoading}
      />
      <ConfirmDialog
        open={confirmAction === 'approve'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={t('purchaseOrders:confirm.approveTitle')}
        message={t('purchaseOrders:confirm.approveMessage')}
        onConfirm={runConfirmedAction}
        isLoading={isActionLoading}
      />
      <ConfirmDialog
        open={confirmAction === 'send'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={t('purchaseOrders:confirm.sendTitle')}
        message={t('purchaseOrders:confirm.sendMessage')}
        onConfirm={runConfirmedAction}
        isLoading={isActionLoading}
      />
      <ConfirmDialog
        open={confirmAction === 'convertToBill'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={t('purchaseOrders:confirm.convertTitle')}
        message={t('purchaseOrders:confirm.convertMessage')}
        onConfirm={runConfirmedAction}
        isLoading={isActionLoading}
      />
      <ConfirmDialog
        open={confirmAction === 'cancel'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={t('purchaseOrders:confirm.cancelTitle')}
        message={t('purchaseOrders:confirm.cancelMessage')}
        variant="destructive"
        onConfirm={runConfirmedAction}
        isLoading={isActionLoading}
      />
      <ConfirmDialog
        open={confirmAction === 'delete'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={t('purchaseOrders:confirm.deleteTitle')}
        message={t('purchaseOrders:confirm.deleteMessage')}
        variant="destructive"
        onConfirm={runConfirmedAction}
        isLoading={isActionLoading}
      />

      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-surface p-4 shadow-lg">
            <h2 className="mb-2 text-sm font-medium text-ink">{t('purchaseOrders:actions.reject')}</h2>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder={t('purchaseOrders:fields.rejectionReason')}
              rows={3}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" onClick={() => setRejectOpen(false)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
                {t('common:action.cancel')}
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={!rejectionReason.trim() || rejectMutation.isPending}
                className="rounded bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {rejectMutation.isPending ? t('common:action.processing') : t('purchaseOrders:actions.reject')}
              </button>
            </div>
          </div>
        </div>
      )}

      {receiveOpen && po && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-surface p-4 shadow-lg">
            <h2 className="mb-3 text-sm font-medium text-ink">{t('purchaseOrders:actions.receive')}</h2>

            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-ink-muted">{t('purchaseOrders:receive.fields.warehouse')}</label>
              <select value={receiveWarehouseId} onChange={(e) => setReceiveWarehouseId(e.target.value)} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
                <option value="">—</option>
                {activeWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              {(po.items ?? []).map((item) => {
                const ordered = Number(item.quantity);
                const received = Number(item.receivedQuantity);
                const remaining = ordered - received;
                return (
                  <div key={item.id} className="rounded border border-border p-2">
                    <p className="text-sm text-ink">{item.description}</p>
                    <p className="text-xs text-ink-muted">
                      {t('purchaseOrders:receive.fields.remaining')}: {remaining} / {ordered}
                      {!item.stockItemId && <> · {t('purchaseOrders:receive.notStockTracked')}</>}
                    </p>
                    {remaining > 0 && (
                      <input
                        type="number"
                        min="0"
                        max={remaining}
                        step="0.01"
                        value={receiveQuantities[item.id] ?? ''}
                        onChange={(e) => setReceiveQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder="0"
                        className="mt-1 w-28 rounded border border-border bg-surface px-2 py-1 text-sm text-ink"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {receiveError && <p className="mt-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{receiveError}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setReceiveOpen(false)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
                {t('common:action.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setReceiveError(null);
                  const lines = Object.entries(receiveQuantities)
                    .filter(([, qty]) => qty && Number(qty) > 0)
                    .map(([purchaseOrderItemId, qty]) => ({ purchaseOrderItemId, quantity: Number(qty) }));
                  if (!receiveWarehouseId) {
                    setReceiveError(t('purchaseOrders:receive.errors.warehouseRequired'));
                    return;
                  }
                  if (lines.length === 0) {
                    setReceiveError(t('purchaseOrders:receive.errors.noQuantities'));
                    return;
                  }
                  receiveMutation.mutate(
                    { warehouseId: receiveWarehouseId, lines },
                    {
                      onSuccess: () => setReceiveOpen(false),
                      onError: (err) => setReceiveError(err instanceof ApiError ? err.message : t('common:error.generic')),
                    },
                  );
                }}
                disabled={receiveMutation.isPending}
                className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50"
              >
                {receiveMutation.isPending ? t('common:action.processing') : t('common:action.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
