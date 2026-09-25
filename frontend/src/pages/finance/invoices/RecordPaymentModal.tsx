import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';

const paymentSchema = z
  .object({
    amount: z.string().min(1, 'validation.required'),
    paymentDate: z.string().min(1, 'validation.required'),
    method: z.enum(['cash', 'bank_transfer', 'card', 'cheque', 'other']),
    reference: z.string().optional(),
    exchangeRateToBase: z.string().optional(),
  });

export type PaymentFormValues = z.infer<typeof paymentSchema>;

interface RecordPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  submitError?: string | null;
  remainingBalance: string;
  /** SAR (the default) never shows the exchange rate field — the payment is trivially at rate 1, same as the invoice itself. */
  invoiceCurrencyCode: string;
  onSubmit: (values: PaymentFormValues) => void;
}

export function RecordPaymentModal({ open, onOpenChange, isSubmitting, submitError, remainingBalance, invoiceCurrencyCode, onSubmit }: RecordPaymentModalProps) {
  const { t } = useTranslation(['finance', 'common']);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { paymentDate: new Date().toISOString().slice(0, 10), method: 'bank_transfer' },
  });

  return (
    <Modal open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }} title={t('finance:invoices.detail.recordPayment')}>
      <p className="mb-3 text-sm text-ink-muted">{t('finance:invoices.detail.remainingBalance', { amount: remainingBalance })}</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label={t('finance:invoices.fields.amount')} htmlFor="amount" required error={errors.amount && t(`common:${errors.amount.message}`)}>
          <TextInput id="amount" type="number" step="0.01" min="0.01" hasError={!!errors.amount} {...register('amount')} />
        </FormField>
        <FormField label={t('finance:invoices.fields.paymentDate')} htmlFor="paymentDate" required error={errors.paymentDate && t(`common:${errors.paymentDate.message}`)}>
          <TextInput id="paymentDate" type="date" hasError={!!errors.paymentDate} {...register('paymentDate')} />
        </FormField>
        <FormField label={t('finance:invoices.fields.method')} htmlFor="method" required>
          <select id="method" {...register('method')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            {['cash', 'bank_transfer', 'card', 'cheque', 'other'].map((m) => (
              <option key={m} value={m}>{t(`finance:invoices.paymentMethod.${m}`)}</option>
            ))}
          </select>
        </FormField>
        <FormField label={t('finance:invoices.fields.reference')} htmlFor="reference">
          <TextInput id="reference" {...register('reference')} />
        </FormField>
        {invoiceCurrencyCode !== 'SAR' && (
          <FormField
            label={t('finance:invoices.fields.exchangeRateToBase')}
            htmlFor="exchangeRateToBase"
            required
            hint={t('finance:invoices.form.paymentExchangeRateHint', { currency: invoiceCurrencyCode })}
            error={errors.exchangeRateToBase && t(`common:${errors.exchangeRateToBase.message}`)}
          >
            <TextInput id="exchangeRateToBase" type="number" step="0.000001" min="0.000001" hasError={!!errors.exchangeRateToBase} {...register('exchangeRateToBase')} />
          </FormField>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('common:action.cancel')}
          </button>
          <button type="submit" disabled={isSubmitting} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
            {isSubmitting ? t('common:action.processing') : t('finance:invoices.detail.recordPayment')}
          </button>
        </div>
        {submitError && <p className="mt-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{submitError}</p>}
      </form>
    </Modal>
  );
}
