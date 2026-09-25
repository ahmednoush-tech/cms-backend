import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useBill,
  useReceiveBill,
  useCancelBill,
  useDeleteBill,
  useCreateBillPayment,
} from '../../../api/queries/useFinance';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { StatusBadge } from '../../../components/StatusBadge/StatusBadge';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { AttachmentsSection } from '../../../components/AttachmentsSection/AttachmentsSection';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { RecordBillPaymentModal, type BillPaymentFormValues } from './RecordBillPaymentModal';
import { EditBillModal } from './EditBillModal';
import { ApiError } from '../../../api/client';

export function BillDetailPage() {
  const { t } = useTranslation(['finance', 'common']);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [confirmReceive, setConfirmReceive] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const { data: bill, isLoading, error } = useBill(id);
  const receiveMutation = useReceiveBill(id!);
  const cancelMutation = useCancelBill(id!);
  const deleteMutation = useDeleteBill();
  const paymentMutation = useCreateBillPayment();

  if (isLoading) return <LoadingState variant="card" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant={apiError?.status === 404 ? 'not-found' : 'generic'} message={apiError?.message} />;
  }
  if (!bill) return null;

  const remaining = (Number(bill.total) - Number(bill.amountPaid)).toFixed(2);
  const canReceive = bill.status === 'draft';
  const canCancel = bill.status === 'draft';
  const canRecordPayment = ['received', 'partially_paid', 'overdue'].includes(bill.status);

  return (
    <div>
      <PageHeader title={bill.billNumber} breadcrumb={t('finance:bills.title')} />

      <div className="mb-4 flex items-center gap-3">
        <StatusBadge entity="bill" value={bill.status} />
        <span className="text-xs text-ink-muted">{bill.billDate.slice(0, 10)}</span>
        {bill.dueDate && <span className="text-xs text-ink-muted">— {t('finance:bills.fields.dueDate')}: {bill.dueDate.slice(0, 10)}</span>}
      </div>

      <dl className="mb-4 grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t('finance:bills.fields.vendor')}</dt>
          <dd className="mt-0.5 text-sm text-ink">{bill.vendor?.name ?? bill.vendor?.vendorCode ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t('finance:invoices.detail.amountPaid')}</dt>
          <dd className="mt-0.5 text-sm text-ink"><FinancialValue value={bill.amountPaid} /></dd>
        </div>
        {bill.vendorReference && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t('finance:bills.fields.vendorReference')}</dt>
            <dd className="mt-0.5 text-sm text-ink">{bill.vendorReference}</dd>
          </div>
        )}
        {bill.project && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t('finance:bills.fields.project')}</dt>
            <dd className="mt-0.5 text-sm">
              <button type="button" onClick={() => navigate(`/ops/projects/${bill.project!.id}`)} className="text-primary hover:underline">
                {bill.project.name}
              </button>
            </dd>
          </div>
        )}
      </dl>

      <table className="w-full text-start text-sm">
        <thead className="border-b border-border text-xs uppercase text-ink-muted">
          <tr>
            <th className="pb-2 text-start">{t('finance:invoices.fields.description')}</th>
            <th className="pb-2 text-start">{t('finance:invoices.fields.quantity')}</th>
            <th className="pb-2 text-start">{t('finance:invoices.fields.unitPrice')}</th>
            <th className="pb-2 text-start">{t('finance:invoices.fields.total')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {(bill.items ?? []).map((item) => (
            <tr key={item.id}>
              <td className="py-2">{item.description}</td>
              <td className="py-2">{item.quantity}</td>
              <td className="py-2"><FinancialValue value={item.unitPrice} /></td>
              <td className="py-2"><FinancialValue value={item.total} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <div className="w-64 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-ink-muted">{t('finance:invoices.fields.subtotal')}</span><FinancialValue value={bill.subtotal} /></div>
          <div className="flex justify-between"><span className="text-ink-muted">{t('finance:invoices.fields.discount')}</span><FinancialValue value={bill.discount} /></div>
          <div className="flex justify-between"><span className="text-ink-muted">{t('finance:invoices.fields.tax')}</span><FinancialValue value={bill.tax} /></div>
          <div className="flex justify-between border-t border-border pt-1 font-medium text-ink"><span>{t('finance:invoices.fields.total')}</span><FinancialValue value={bill.total} /></div>
        </div>
      </div>

      {(bill.payments ?? []).length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-ink">{t('finance:invoices.detail.paymentHistory')}</p>
          <table className="w-full text-start text-sm">
            <thead className="border-b border-border text-xs uppercase text-ink-muted">
              <tr>
                <th className="pb-2 text-start">{t('finance:invoices.fields.paymentDate')}</th>
                <th className="pb-2 text-start">{t('finance:invoices.fields.amount')}</th>
                <th className="pb-2 text-start">{t('finance:invoices.fields.method')}</th>
                <th className="pb-2 text-start">{t('finance:invoices.fields.reference')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bill.payments!.map((p) => (
                <tr key={p.id}>
                  <td className="py-2">{p.paymentDate.slice(0, 10)}</td>
                  <td className="py-2"><FinancialValue value={p.amount} /></td>
                  <td className="py-2">{t(`finance:invoices.paymentMethod.${p.method}`)}</td>
                  <td className="py-2 text-ink-muted">{p.reference ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {canReceive && (
          <PermissionGate requires={PERMISSIONS.Finance.bills.receive}>
            <button type="button" onClick={() => { setActionError(null); setConfirmReceive(true); }} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('finance:bills.detail.receive')}
            </button>
          </PermissionGate>
        )}
        {canCancel && (
          <PermissionGate requires={PERMISSIONS.Finance.bills.edit}>
            <button type="button" onClick={() => { setActionError(null); setConfirmCancel(true); }} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('finance:bills.detail.cancel')}
            </button>
          </PermissionGate>
        )}
        {bill.status === 'draft' && (
          <PermissionGate requires={PERMISSIONS.Finance.bills.edit}>
            <button type="button" onClick={() => { setActionError(null); setEditModalOpen(true); }} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('common:action.edit')}
            </button>
          </PermissionGate>
        )}
        {bill.status === 'draft' && (
          <PermissionGate requires={PERMISSIONS.Finance.bills.delete}>
            <button type="button" onClick={() => { setActionError(null); setConfirmDelete(true); }} className="rounded border border-danger/40 px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10">
              {t('common:action.delete')}
            </button>
          </PermissionGate>
        )}
        {canRecordPayment && (
          <PermissionGate requires={PERMISSIONS.Finance.billPayments.create}>
            <button type="button" onClick={() => { setPaymentError(null); setPaymentModalOpen(true); }} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('finance:bills.detail.recordPayment')}
            </button>
          </PermissionGate>
        )}
      </div>
      {actionError && <p className="mt-2 text-sm text-danger" role="alert">{actionError}</p>}

      <div className="mt-4">
        <AttachmentsSection entityType="bill" entityId={bill.id} />
      </div>

      <ConfirmDialog
        open={confirmReceive}
        onOpenChange={setConfirmReceive}
        title={t('finance:bills.detail.receiveConfirmTitle')}
        message={t('finance:bills.detail.receiveConfirmMessage')}
        isLoading={receiveMutation.isPending}
        onConfirm={() =>
          receiveMutation.mutate(undefined, {
            onSuccess: () => setConfirmReceive(false),
            onError: (err) => { setConfirmReceive(false); setActionError(err instanceof ApiError ? err.message : t('common:error.generic')); },
          })
        }
      />
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t('finance:bills.detail.cancelConfirmTitle')}
        message={t('finance:bills.detail.cancelConfirmMessage')}
        variant="destructive"
        isLoading={cancelMutation.isPending}
        onConfirm={() =>
          cancelMutation.mutate(undefined, {
            onSuccess: () => setConfirmCancel(false),
            onError: (err) => { setConfirmCancel(false); setActionError(err instanceof ApiError ? err.message : t('common:error.generic')); },
          })
        }
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('finance:bills.detail.deleteConfirmTitle')}
        message={t('finance:bills.detail.deleteConfirmMessage')}
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate(bill.id, {
            onSuccess: () => navigate('/finance/bills'),
            onError: (err) => { setConfirmDelete(false); setActionError(err instanceof ApiError ? err.message : t('common:error.generic')); },
          })
        }
      />
      {bill.status === 'draft' && (
        <EditBillModal open={editModalOpen} onOpenChange={setEditModalOpen} bill={bill} />
      )}
      <RecordBillPaymentModal
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        isSubmitting={paymentMutation.isPending}
        submitError={paymentError}
        remainingBalance={remaining}
        onSubmit={(values: BillPaymentFormValues) => {
          setPaymentError(null);
          paymentMutation.mutate(
            { billId: bill.id, amount: Number(values.amount), paymentDate: values.paymentDate, method: values.method, reference: values.reference || undefined },
            {
              onSuccess: () => setPaymentModalOpen(false),
              onError: (err) => setPaymentError(err instanceof ApiError ? err.message : t('common:error.generic')),
            },
          );
        }}
      />
    </div>
  );
}
