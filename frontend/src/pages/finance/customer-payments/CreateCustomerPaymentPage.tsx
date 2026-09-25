import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCustomers } from '../../../api/queries/useCustomers';
import { useInvoices } from '../../../api/queries/useFinance';
import { useCreateCustomerPayment } from '../../../api/queries/useFinance';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { StatusBadge } from '../../../components/StatusBadge/StatusBadge';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { ApiError } from '../../../api/client';

const PAYABLE_STATUSES = ['sent', 'partially_paid', 'overdue'];

export function CreateCustomerPaymentPage() {
  const { t } = useTranslation(['finance', 'common']);
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<'cash' | 'bank_transfer' | 'card' | 'cheque' | 'other'>('bank_transfer');
  const [reference, setReference] = useState('');
  const [allocations, setAllocations] = useState<Record<string, string>>({});

  const { data: customersData } = useCustomers({ page: 1, pageSize: 200 });
  const { data: invoicesData, isLoading: invoicesLoading } = useInvoices({ page: 1, pageSize: 100, customerId: customerId || undefined });
  const createMutation = useCreateCustomerPayment();

  const openInvoices = useMemo(
    () => (invoicesData?.items ?? []).filter((inv) => PAYABLE_STATUSES.includes(inv.status)),
    [invoicesData],
  );

  const receivedAmount = Number(amount) || 0;
  const allocatedTotal = Object.values(allocations).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const unapplied = receivedAmount - allocatedTotal;
  const overAllocated = allocatedTotal > receivedAmount;

  const canSubmit = customerId && receivedAmount > 0 && paymentDate && allocatedTotal > 0 && !overAllocated;

  const handleSubmit = () => {
    setSubmitError(null);
    const allocationList = Object.entries(allocations)
      .filter(([, v]) => Number(v) > 0)
      .map(([invoiceId, v]) => ({ invoiceId, amount: Number(v) }));

    createMutation.mutate(
      {
        customerId,
        amount: receivedAmount,
        paymentDate,
        method,
        reference: reference || undefined,
        allocations: allocationList,
      },
      {
        onSuccess: () => navigate('/finance/customer-payments'),
        onError: (err) => setSubmitError(err instanceof ApiError ? err.message : t('common:error.generic')),
      },
    );
  };

  return (
    <div>
      <PageHeader title={t('finance:customerPayments.form.createTitle')} breadcrumb={t('finance:customerPayments.title')} />

      <div className="max-w-2xl rounded-lg border border-border bg-surface p-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('finance:invoices.fields.customer')} htmlFor="customerId" required>
            <select
              id="customerId"
              value={customerId}
              onChange={(e) => { setCustomerId(e.target.value); setAllocations({}); }}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink"
            >
              <option value="">—</option>
              {(customersData?.items ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.companyName ?? c.customerCode}</option>
              ))}
            </select>
          </FormField>
          <FormField label={t('finance:customerPayments.fields.amountReceived')} htmlFor="amount" required>
            <TextInput id="amount" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('finance:invoices.fields.paymentDate')} htmlFor="paymentDate" required>
            <TextInput id="paymentDate" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </FormField>
          <FormField label={t('finance:invoices.fields.method')} htmlFor="method" required>
            <select id="method" value={method} onChange={(e) => setMethod(e.target.value as typeof method)} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
              {['cash', 'bank_transfer', 'card', 'cheque', 'other'].map((m) => (
                <option key={m} value={m}>{t(`finance:invoices.paymentMethod.${m}`)}</option>
              ))}
            </select>
          </FormField>
        </div>
        <FormField label={t('finance:invoices.fields.reference')} htmlFor="reference">
          <TextInput id="reference" value={reference} onChange={(e) => setReference(e.target.value)} />
        </FormField>

        {customerId && (
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-3 text-sm font-medium text-ink">{t('finance:customerPayments.allocateTo')}</p>
            {invoicesLoading ? (
              <p className="text-sm text-ink-muted">{t('common:action.processing')}</p>
            ) : openInvoices.length === 0 ? (
              <p className="text-sm text-ink-muted">{t('finance:customerPayments.noOpenInvoices')}</p>
            ) : (
              <table className="w-full text-start text-sm">
                <thead className="text-xs uppercase text-ink-muted">
                  <tr>
                    <th className="pb-2 text-start">{t('finance:invoices.columns.invoiceNumber')}</th>
                    <th className="pb-2 text-start">{t('finance:invoices.columns.status')}</th>
                    <th className="pb-2 text-start">{t('finance:customerPayments.remainingBalance')}</th>
                    <th className="pb-2 text-start">{t('finance:customerPayments.allocateAmount')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {openInvoices.map((inv) => {
                    const remaining = (Number(inv.total) - Number(inv.amountPaid)).toFixed(2);
                    return (
                      <tr key={inv.id}>
                        <td className="py-2">{inv.invoiceNumber}</td>
                        <td className="py-2"><StatusBadge entity="invoice" value={inv.status} /></td>
                        <td className="py-2"><FinancialValue value={remaining} /></td>
                        <td className="py-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={remaining}
                            value={allocations[inv.id] ?? ''}
                            onChange={(e) => setAllocations((prev) => ({ ...prev, [inv.id]: e.target.value }))}
                            className="w-28 rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            <div className="mt-3 space-y-1 rounded border border-border bg-surface-muted p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-muted">{t('finance:customerPayments.allocatedTotal')}</span>
                <FinancialValue value={allocatedTotal.toFixed(2)} />
              </div>
              <div className={`flex justify-between font-medium ${overAllocated ? 'text-danger' : 'text-ink'}`}>
                <span>{t('finance:customerPayments.unapplied')}</span>
                <FinancialValue value={unapplied.toFixed(2)} />
              </div>
              {overAllocated && (
                <p className="text-xs text-danger" role="alert">{t('finance:customerPayments.overAllocatedWarning')}</p>
              )}
            </div>
          </div>
        )}

        {submitError && <p className="mt-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{submitError}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => navigate('/finance/customer-payments')} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('common:action.cancel')}
          </button>
          <button
            type="button"
            disabled={!canSubmit || createMutation.isPending}
            onClick={handleSubmit}
            className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50"
          >
            {createMutation.isPending ? t('common:action.processing') : t('common:action.create')}
          </button>
        </div>
      </div>
    </div>
  );
}
