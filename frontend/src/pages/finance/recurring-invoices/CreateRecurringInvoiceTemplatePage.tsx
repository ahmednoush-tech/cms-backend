import { useState } from 'react';
import { z } from 'zod';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCurrencies } from '../../../api/queries/useFinance';
import { useCustomers } from '../../../api/queries/useCustomers';
import { useCreateRecurringInvoiceTemplate } from '../../../api/queries/useRecurringInvoiceTemplates';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { ApiError } from '../../../api/client';

const itemSchema = z.object({
  description: z.string().min(1, 'validation.required'),
  quantity: z.string().min(1, 'validation.required'),
  unitPrice: z.string().min(1, 'validation.required'),
});

const templateSchema = z
  .object({
    customerId: z.string().uuid('validation.uuid'),
    name: z.string().min(1, 'validation.required'),
    frequency: z.enum(['monthly', 'quarterly', 'yearly']),
    startDate: z.string().min(1, 'validation.required'),
    endDate: z.string().optional(),
    currencyCode: z.string().default('SAR'),
    exchangeRateToBase: z.string().optional(),
    notes: z.string().optional(),
    items: z.array(itemSchema).min(1, 'validation.required'),
  })
  .refine((data) => data.currencyCode === 'SAR' || (data.exchangeRateToBase && Number(data.exchangeRateToBase) > 0), {
    message: 'validation.required',
    path: ['exchangeRateToBase'],
  });

type TemplateFormValues = z.infer<typeof templateSchema>;

export function CreateRecurringInvoiceTemplatePage() {
  const { t } = useTranslation(['recurringInvoices', 'finance', 'common']);
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { data: customersData } = useCustomers({ page: 1, pageSize: 200 });
  const { data: currencies } = useCurrencies();
  const createMutation = useCreateRecurringInvoiceTemplate();

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: { currencyCode: 'SAR', frequency: 'monthly', items: [{ description: '', quantity: '1', unitPrice: '0' }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const selectedCurrency = watch('currencyCode');

  const onSubmit = (values: TemplateFormValues) => {
    setSubmitError(null);
    createMutation.mutate(
      {
        customerId: values.customerId,
        name: values.name,
        frequency: values.frequency,
        startDate: values.startDate,
        endDate: values.endDate || undefined,
        currencyCode: values.currencyCode,
        exchangeRateToBase: values.currencyCode !== 'SAR' && values.exchangeRateToBase ? Number(values.exchangeRateToBase) : undefined,
        notes: values.notes || undefined,
        items: values.items.map((i) => ({ description: i.description, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice) })),
      },
      {
        onSuccess: (template) => navigate(`/finance/recurring-invoices/${template.id}`),
        onError: (err) => setSubmitError(err instanceof ApiError ? err.message : t('common:error.generic')),
      },
    );
  };

  return (
    <div>
      <PageHeader title={t('recurringInvoices:form.createTitle')} breadcrumb={t('recurringInvoices:title')} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-2xl rounded-lg border border-border bg-surface p-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('recurringInvoices:fields.customer')} htmlFor="customerId" required error={errors.customerId && t(`common:${errors.customerId.message}`)}>
            <select id="customerId" {...register('customerId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
              <option value="">—</option>
              {(customersData?.items ?? []).map((c) => (<option key={c.id} value={c.id}>{c.customerCode} — {c.companyName}</option>))}
            </select>
          </FormField>
          <FormField label={t('recurringInvoices:fields.name')} htmlFor="name" required error={errors.name && t(`common:${errors.name.message}`)}>
            <TextInput id="name" hasError={!!errors.name} {...register('name')} />
          </FormField>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <FormField label={t('recurringInvoices:fields.frequency')} htmlFor="frequency" required>
            <select id="frequency" {...register('frequency')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
              <option value="monthly">{t('recurringInvoices:frequency.monthly')}</option>
              <option value="quarterly">{t('recurringInvoices:frequency.quarterly')}</option>
              <option value="yearly">{t('recurringInvoices:frequency.yearly')}</option>
            </select>
          </FormField>
          <FormField label={t('recurringInvoices:fields.startDate')} htmlFor="startDate" required error={errors.startDate && t(`common:${errors.startDate.message}`)}>
            <TextInput id="startDate" type="date" hasError={!!errors.startDate} {...register('startDate')} />
          </FormField>
          <FormField label={t('recurringInvoices:fields.endDate')} htmlFor="endDate" hint={t('recurringInvoices:form.endDateHint')}>
            <TextInput id="endDate" type="date" {...register('endDate')} />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('recurringInvoices:fields.currency')} htmlFor="currencyCode">
            <select id="currencyCode" {...register('currencyCode')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
              {(currencies ?? [{ code: 'SAR', name: 'Saudi Riyal' }]).map((c) => (<option key={c.code} value={c.code}>{c.code} — {c.name}</option>))}
            </select>
          </FormField>
          {selectedCurrency !== 'SAR' && (
            <FormField
              label={t('recurringInvoices:fields.exchangeRateToBase')}
              htmlFor="exchangeRateToBase"
              required
              error={errors.exchangeRateToBase && t(`common:${errors.exchangeRateToBase.message}`)}
            >
              <TextInput id="exchangeRateToBase" type="number" step="0.000001" min="0.000001" hasError={!!errors.exchangeRateToBase} {...register('exchangeRateToBase')} />
            </FormField>
          )}
        </div>

        <FormField label={t('recurringInvoices:fields.notes')} htmlFor="notes">
          <textarea id="notes" {...register('notes')} rows={2} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </FormField>

        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-3 text-sm font-medium text-ink">{t('finance:invoices.items')}</p>
          <table className="w-full text-start text-sm">
            <thead className="text-xs uppercase text-ink-muted">
              <tr>
                <th className="pb-2 text-start">{t('finance:invoices.fields.description')}</th>
                <th className="pb-2 text-start">{t('finance:invoices.fields.quantity')}</th>
                <th className="pb-2 text-start">{t('finance:invoices.fields.unitPrice')}</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {fields.map((field, index) => (
                <tr key={field.id}>
                  <td className="py-1.5 pe-2">
                    <input {...register(`items.${index}.description` as const)} className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink" />
                  </td>
                  <td className="py-1.5 pe-2">
                    <input type="number" step="0.01" min="0.01" {...register(`items.${index}.quantity` as const)} className="w-20 rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink" />
                  </td>
                  <td className="py-1.5 pe-2">
                    <input type="number" step="0.01" min="0" {...register(`items.${index}.unitPrice` as const)} className="w-24 rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink" />
                  </td>
                  <td className="py-1.5">
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(index)} className="text-xs font-medium text-danger hover:underline">
                        {t('common:action.delete')}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {errors.items?.message && <p className="mt-2 text-sm text-danger" role="alert">{t(`common:${errors.items.message}`)}</p>}
          <button type="button" onClick={() => append({ description: '', quantity: '1', unitPrice: '0' })} className="mt-3 text-sm font-medium text-primary hover:underline">
            {t('finance:invoices.addItem')}
          </button>
        </div>

        {submitError && <p className="mt-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{submitError}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => navigate('/finance/recurring-invoices')} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('common:action.cancel')}
          </button>
          <button type="submit" disabled={createMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
            {createMutation.isPending ? t('common:action.processing') : t('common:action.create')}
          </button>
        </div>
      </form>
    </div>
  );
}
