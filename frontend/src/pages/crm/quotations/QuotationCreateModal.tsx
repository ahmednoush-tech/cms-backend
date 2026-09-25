import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { useCurrencies } from '../../../api/queries/useFinance';
import { useCustomers } from '../../../api/queries/useCustomers';
import { useOpportunities } from '../../../api/queries/useOpportunities';

const quotationSchema = z
  .object({
    customerId: z.string().uuid('validation.uuid'),
    opportunityId: z.string().uuid('validation.uuid').optional().or(z.literal('')),
    validUntil: z.string().optional(),
    currencyCode: z.string().default('SAR'),
    exchangeRateToBase: z.string().optional(),
  })
  .refine((data) => data.currencyCode === 'SAR' || (data.exchangeRateToBase && Number(data.exchangeRateToBase) > 0), {
    message: 'validation.required',
    path: ['exchangeRateToBase'],
  });

export type QuotationFormValues = z.infer<typeof quotationSchema>;

interface QuotationCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: QuotationFormValues) => void;
  isSubmitting: boolean;
}

/** Items are added on the detail page after creation (the backend's CreateQuotationDto accepts an optional items array, but starting empty then adding items via the items sub-resource keeps this form simple and matches the pattern the backend's own e2e tests use). */
export function QuotationCreateModal({ open, onOpenChange, onSubmit, isSubmitting }: QuotationCreateModalProps) {
  const { t } = useTranslation(['quotations', 'common']);
  const { data: currencies } = useCurrencies();
  const { data: customersData } = useCustomers({ page: 1, pageSize: 500 });
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<QuotationFormValues>({ resolver: zodResolver(quotationSchema), defaultValues: { currencyCode: 'SAR' } });
  const selectedCustomerId = watch('customerId');
  // Only offer opportunities belonging to the SELECTED customer — an
  // opportunity from a different customer would never be a valid
  // choice here, and showing the full unfiltered list would just
  // invite picking the wrong one.
  const { data: opportunitiesData } = useOpportunities({ page: 1, pageSize: 500, customerId: selectedCustomerId || undefined });
  const selectedCurrency = watch('currencyCode');

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('quotations:form.createTitle')}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField
          label={t('quotations:fields.customerId')}
          htmlFor="customerId"
          required
          error={errors.customerId && t(`common:${errors.customerId.message}`)}
          hint={t('quotations:form.customerIdHint')}
        >
          <select id="customerId" {...register('customerId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">—</option>
            {(customersData?.items ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.companyName ?? c.customerCode}</option>
            ))}
          </select>
        </FormField>
        <FormField label={t('quotations:fields.opportunityId')} htmlFor="opportunityId">
          <select id="opportunityId" {...register('opportunityId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">—</option>
            {(opportunitiesData?.items ?? []).map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </FormField>
        <FormField label={t('quotations:fields.validUntil')} htmlFor="validUntil">
          <TextInput id="validUntil" type="date" {...register('validUntil')} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('quotations:fields.currency')} htmlFor="currencyCode">
            <select id="currencyCode" {...register('currencyCode')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
              {(currencies ?? [{ code: 'SAR', name: 'Saudi Riyal' }]).map((c) => (
                <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
              ))}
            </select>
          </FormField>
          {selectedCurrency !== 'SAR' && (
            <FormField
              label={t('quotations:fields.exchangeRateToBase')}
              htmlFor="exchangeRateToBase"
              required
              hint={t('quotations:form.exchangeRateHint')}
              error={errors.exchangeRateToBase && t(`common:${errors.exchangeRateToBase.message}`)}
            >
              <TextInput id="exchangeRateToBase" type="number" step="0.000001" min="0.000001" hasError={!!errors.exchangeRateToBase} {...register('exchangeRateToBase')} />
            </FormField>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('common:action.cancel')}
          </button>
          <button type="submit" disabled={isSubmitting} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
            {isSubmitting ? t('common:action.processing') : t('common:action.create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
