import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useVendors, useCreateBill } from '../../../api/queries/useFinance';
import { useProjects } from '../../../api/queries/useProjects';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { BillItemsEditor } from './BillItemsEditor';
import { ApiError } from '../../../api/client';

const itemSchema = z.object({
  description: z.string().min(1, 'validation.required'),
  quantity: z.string().min(1, 'validation.required'),
  unitPrice: z.string().min(1, 'validation.required'),
  discount: z.string().optional(),
  tax: z.string().optional(),
  inventoryItemId: z.string().optional(),
});

const createBillSchema = z.object({
  vendorId: z.string().uuid('validation.uuid'),
  vendorReference: z.string().optional(),
  billDate: z.string().min(1, 'validation.required'),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  projectId: z.string().optional(),
  items: z.array(itemSchema).min(1, 'validation.required'),
});

export type CreateBillFormValues = z.infer<typeof createBillSchema>;

export function CreateBillPage() {
  const { t } = useTranslation(['finance', 'common']);
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { data: vendorsData } = useVendors({ page: 1, pageSize: 200 });
  const { data: projectsData } = useProjects({ page: 1, pageSize: 200 });
  const createMutation = useCreateBill();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateBillFormValues>({
    resolver: zodResolver(createBillSchema),
    defaultValues: {
      billDate: new Date().toISOString().slice(0, 10),
      items: [{ description: '', quantity: '1', unitPrice: '0', discount: '0', tax: '0', inventoryItemId: '' }],
    },
  });

  const onSubmit = (values: CreateBillFormValues) => {
    setSubmitError(null);
    createMutation.mutate(
      {
        vendorId: values.vendorId,
        vendorReference: values.vendorReference || undefined,
        billDate: values.billDate,
        dueDate: values.dueDate || undefined,
        notes: values.notes || undefined,
        projectId: values.projectId || undefined,
        items: values.items.map((i) => ({
          description: i.description,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          discount: i.discount ? Number(i.discount) : undefined,
          tax: i.tax ? Number(i.tax) : undefined,
          inventoryItemId: i.inventoryItemId || undefined,
        })),
      },
      {
        onSuccess: (bill) => navigate(`/finance/bills/${bill.id}`),
        onError: (err) => setSubmitError(err instanceof ApiError ? err.message : t('common:error.generic')),
      },
    );
  };

  return (
    <div>
      <PageHeader title={t('finance:bills.form.createTitle')} breadcrumb={t('finance:bills.title')} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="rounded-lg border border-border bg-surface p-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('finance:bills.fields.vendor')} htmlFor="vendorId" required error={errors.vendorId && t(`common:${errors.vendorId.message}`)}>
            <select id="vendorId" {...register('vendorId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
              <option value="">—</option>
              {(vendorsData?.items ?? []).map((v) => (
                <option key={v.id} value={v.id}>{v.vendorCode} — {v.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label={t('finance:bills.fields.vendorReference')} htmlFor="vendorReference">
            <TextInput id="vendorReference" {...register('vendorReference')} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('finance:bills.fields.billDate')} htmlFor="billDate" required error={errors.billDate && t(`common:${errors.billDate.message}`)}>
            <TextInput id="billDate" type="date" hasError={!!errors.billDate} {...register('billDate')} />
          </FormField>
          <FormField label={t('finance:bills.fields.dueDate')} htmlFor="dueDate">
            <TextInput id="dueDate" type="date" {...register('dueDate')} />
          </FormField>
        </div>
        <FormField label={t('finance:bills.fields.project')} htmlFor="projectId" hint={t('finance:bills.fields.projectHint')}>
          <select id="projectId" {...register('projectId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">—</option>
            {(projectsData?.items ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.projectNumber} — {p.name}</option>
            ))}
          </select>
        </FormField>
        <FormField label={t('finance:invoices.fields.notes')} htmlFor="notes">
          <textarea id="notes" {...register('notes')} rows={2} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </FormField>

        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-3 text-sm font-medium text-ink">{t('finance:invoices.items')}</p>
          <BillItemsEditor control={control} register={register} errors={errors} />
        </div>

        {submitError && <p className="mt-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{submitError}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => navigate('/finance/bills')} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
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
