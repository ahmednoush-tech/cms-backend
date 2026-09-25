import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuotations } from '../../../api/queries/useQuotations';
import { useCustomers } from '../../../api/queries/useCustomers';
import { useCreateInvoice, useCurrencies } from '../../../api/queries/useFinance';
import { useWarehouses } from '../../../api/queries/useStockInventory';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { InvoiceItemsEditor } from './InvoiceItemsEditor';
import { ApiError } from '../../../api/client';

const itemSchema = z.object({
  description: z.string().min(1, 'validation.required'),
  quantity: z.string().min(1, 'validation.required'),
  unitPrice: z.string().min(1, 'validation.required'),
  discount: z.string().optional(),
  tax: z.string().optional(),
  inventoryItemId: z.string().optional(),
  stockItemId: z.string().optional(),
});

const standaloneSchema = z
  .object({
    customerId: z.string().uuid('validation.uuid'),
    issueDate: z.string().min(1, 'validation.required'),
    dueDate: z.string().optional(),
    notes: z.string().optional(),
    warehouseId: z.string().optional(),
    items: z.array(itemSchema).min(1, 'validation.required'),
    currencyCode: z.string().default('SAR'),
    exchangeRateToBase: z.string().optional(),
  })
  .refine((data) => data.currencyCode === 'SAR' || (data.exchangeRateToBase && Number(data.exchangeRateToBase) > 0), {
    message: 'validation.required',
    path: ['exchangeRateToBase'],
  });

export type StandaloneInvoiceFormValues = z.infer<typeof standaloneSchema>;

const fromQuotationSchema = z.object({
  quotationId: z.string().uuid('validation.uuid'),
  issueDate: z.string().min(1, 'validation.required'),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

type FromQuotationFormValues = z.infer<typeof fromQuotationSchema>;

export function CreateInvoicePage() {
  const { t } = useTranslation(['finance', 'common']);
  const [mode, setMode] = useState<'quotation' | 'standalone'>('quotation');

  return (
    <div>
      <PageHeader title={t('finance:invoices.form.createTitle')} breadcrumb={t('finance:invoices.title')} />

      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMode('quotation')}
          className={`rounded px-3 py-1.5 text-sm font-medium ${mode === 'quotation' ? 'bg-primary text-primary-fg' : 'border border-border text-ink hover:bg-surface-muted'}`}
        >
          {t('finance:invoices.form.fromQuotation')}
        </button>
        <button
          type="button"
          onClick={() => setMode('standalone')}
          className={`rounded px-3 py-1.5 text-sm font-medium ${mode === 'standalone' ? 'bg-primary text-primary-fg' : 'border border-border text-ink hover:bg-surface-muted'}`}
        >
          {t('finance:invoices.form.standalone')}
        </button>
      </div>

      {mode === 'quotation' ? <FromQuotationForm /> : <StandaloneForm />}
    </div>
  );
}

function FromQuotationForm() {
  const { t } = useTranslation(['finance', 'common']);
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { data: quotationsData } = useQuotations({ page: 1, pageSize: 100, status: 'accepted' });
  const createMutation = useCreateInvoice();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FromQuotationFormValues>({
    resolver: zodResolver(fromQuotationSchema),
    defaultValues: { issueDate: new Date().toISOString().slice(0, 10) },
  });

  const onSubmit = (values: FromQuotationFormValues) => {
    setSubmitError(null);
    createMutation.mutate(
      { quotationId: values.quotationId, issueDate: values.issueDate, dueDate: values.dueDate || undefined, notes: values.notes || undefined },
      {
        onSuccess: (invoice) => navigate(`/finance/invoices/${invoice.id}`),
        onError: (err) => setSubmitError(err instanceof ApiError ? err.message : t('common:error.generic')),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-lg rounded-lg border border-border bg-surface p-4">
      <FormField label={t('finance:invoices.fields.quotation')} htmlFor="quotationId" required error={errors.quotationId && t(`common:${errors.quotationId.message}`)}>
        <select id="quotationId" {...register('quotationId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
          <option value="">—</option>
          {(quotationsData?.items ?? []).map((q) => (
            <option key={q.id} value={q.id}>{q.quotationNumber} — {q.total}</option>
          ))}
        </select>
      </FormField>
      {(quotationsData?.items ?? []).length === 0 && (
        <p className="mb-4 text-xs text-ink-muted">{t('finance:invoices.form.noAcceptedQuotations')}</p>
      )}
      <FormField label={t('finance:invoices.fields.issueDate')} htmlFor="issueDate" required error={errors.issueDate && t(`common:${errors.issueDate.message}`)}>
        <TextInput id="issueDate" type="date" hasError={!!errors.issueDate} {...register('issueDate')} />
      </FormField>
      <FormField label={t('finance:invoices.fields.dueDate')} htmlFor="dueDate">
        <TextInput id="dueDate" type="date" {...register('dueDate')} />
      </FormField>

      {submitError && <p className="mb-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{submitError}</p>}

      <button type="submit" disabled={createMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
        {createMutation.isPending ? t('common:action.processing') : t('common:action.create')}
      </button>
    </form>
  );
}

function StandaloneForm() {
  const { t } = useTranslation(['finance', 'common']);
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { data: customersData } = useCustomers({ page: 1, pageSize: 200 });
  const { data: currencies } = useCurrencies();
  const createMutation = useCreateInvoice();

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<StandaloneInvoiceFormValues>({
    resolver: zodResolver(standaloneSchema),
    defaultValues: {
      issueDate: new Date().toISOString().slice(0, 10),
      currencyCode: 'SAR',
      items: [{ description: '', quantity: '1', unitPrice: '0', discount: '0', tax: '0' }],
    },
  });
  const selectedCurrency = watch('currencyCode');
  const { data: warehouses } = useWarehouses();
  const activeWarehouses = (warehouses ?? []).filter((w) => w.isActive);

  const onSubmit = (values: StandaloneInvoiceFormValues) => {
    setSubmitError(null);
    createMutation.mutate(
      {
        customerId: values.customerId,
        issueDate: values.issueDate,
        dueDate: values.dueDate || undefined,
        notes: values.notes || undefined,
        warehouseId: values.warehouseId || undefined,
        currencyCode: values.currencyCode,
        exchangeRateToBase: values.currencyCode !== 'SAR' && values.exchangeRateToBase ? Number(values.exchangeRateToBase) : undefined,
        items: values.items.map((i) => ({
          description: i.description,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          discount: i.discount ? Number(i.discount) : undefined,
          tax: i.tax ? Number(i.tax) : undefined,
          inventoryItemId: i.inventoryItemId || undefined,
          stockItemId: i.stockItemId || undefined,
        })),
      },
      {
        onSuccess: (invoice) => navigate(`/finance/invoices/${invoice.id}`),
        onError: (err) => setSubmitError(err instanceof ApiError ? err.message : t('common:error.generic')),
      },
    );
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="rounded-lg border border-border bg-surface p-4">
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t('finance:invoices.fields.customer')} htmlFor="customerId" required error={errors.customerId && t(`common:${errors.customerId.message}`)}>
          <select id="customerId" {...register('customerId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">—</option>
            {(customersData?.items ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.companyName ?? c.customerCode}</option>
            ))}
          </select>
        </FormField>
        <FormField label={t('finance:invoices.fields.issueDate')} htmlFor="issueDate" required error={errors.issueDate && t(`common:${errors.issueDate.message}`)}>
          <TextInput id="issueDate" type="date" hasError={!!errors.issueDate} {...register('issueDate')} />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label={t('finance:invoices.fields.currency')} htmlFor="currencyCode">
          <select id="currencyCode" {...register('currencyCode')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            {(currencies ?? [{ code: 'SAR', name: 'Saudi Riyal' }]).map((c) => (
              <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
            ))}
          </select>
        </FormField>
        {selectedCurrency !== 'SAR' && (
          <FormField
            label={t('finance:invoices.fields.exchangeRateToBase')}
            htmlFor="exchangeRateToBase"
            required
            hint={t('finance:invoices.form.exchangeRateHint')}
            error={errors.exchangeRateToBase && t(`common:${errors.exchangeRateToBase.message}`)}
          >
            <TextInput id="exchangeRateToBase" type="number" step="0.000001" min="0.000001" hasError={!!errors.exchangeRateToBase} {...register('exchangeRateToBase')} />
          </FormField>
        )}
      </div>
      <FormField label={t('finance:invoices.fields.dueDate')} htmlFor="dueDate">
        <TextInput id="dueDate" type="date" {...register('dueDate')} />
      </FormField>
      <FormField label={t('finance:invoices.fields.notes')} htmlFor="notes">
        <textarea id="notes" {...register('notes')} rows={2} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
      </FormField>
      <FormField label={t('finance:invoices.fields.warehouse')} htmlFor="warehouseId">
        <select id="warehouseId" {...register('warehouseId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
          <option value="">—</option>
          {activeWarehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </FormField>

      <div className="mt-4 border-t border-border pt-4">
        <p className="mb-3 text-sm font-medium text-ink">{t('finance:invoices.items')}</p>
        <InvoiceItemsEditor control={control} register={register} errors={errors} />
      </div>

      {submitError && <p className="mt-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{submitError}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={() => navigate('/finance/invoices')} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
          {t('common:action.cancel')}
        </button>
        <button type="submit" disabled={createMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
          {createMutation.isPending ? t('common:action.processing') : t('common:action.create')}
        </button>
      </div>
    </form>
  );
}
