import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useVendors } from '../../../api/queries/useFinance';
import { useCreatePurchaseOrder } from '../../../api/queries/usePurchaseOrders';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { PurchaseOrderItemsEditor } from './PurchaseOrderItemsEditor';
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

const createPurchaseOrderSchema = z.object({
  vendorId: z.string().uuid('validation.uuid'),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, 'validation.required'),
});

export type CreatePurchaseOrderFormValues = z.infer<typeof createPurchaseOrderSchema>;

/**
 * Unlike QuotationCreateModal (which defers items to after creation
 * via a lightweight modal), this is a full page with items included
 * upfront — mirroring CreateBillPage exactly, since a purchase order
 * and a bill share the identical vendor + line-item shape and a
 * PO with zero planned items is rarely useful in practice.
 */
export function CreatePurchaseOrderPage() {
  const { t } = useTranslation(['purchaseOrders', 'finance', 'common']);
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { data: vendorsData } = useVendors({ page: 1, pageSize: 200 });
  const createMutation = useCreatePurchaseOrder();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreatePurchaseOrderFormValues>({
    resolver: zodResolver(createPurchaseOrderSchema),
    defaultValues: {
      items: [{ description: '', quantity: '1', unitPrice: '0', discount: '0', tax: '0', inventoryItemId: '', stockItemId: '' }],
    },
  });

  const onSubmit = (values: CreatePurchaseOrderFormValues) => {
    setSubmitError(null);
    createMutation.mutate(
      {
        vendorId: values.vendorId,
        expectedDeliveryDate: values.expectedDeliveryDate || undefined,
        notes: values.notes || undefined,
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
        onSuccess: (po) => navigate(`/finance/purchase-orders/${po.id}`),
        onError: (err) => setSubmitError(err instanceof ApiError ? err.message : t('common:error.generic')),
      },
    );
  };

  return (
    <div>
      <PageHeader title={t('purchaseOrders:form.createTitle')} breadcrumb={t('purchaseOrders:title')} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="rounded-lg border border-border bg-surface p-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('purchaseOrders:fields.vendor')} htmlFor="vendorId" required error={errors.vendorId && t(`common:${errors.vendorId.message}`)}>
            <select id="vendorId" {...register('vendorId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
              <option value="">—</option>
              {(vendorsData?.items ?? []).map((v) => (
                <option key={v.id} value={v.id}>{v.vendorCode} — {v.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label={t('purchaseOrders:fields.expectedDeliveryDate')} htmlFor="expectedDeliveryDate">
            <TextInput id="expectedDeliveryDate" type="date" {...register('expectedDeliveryDate')} />
          </FormField>
        </div>
        <FormField label={t('purchaseOrders:fields.notes')} htmlFor="notes">
          <textarea id="notes" {...register('notes')} rows={2} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </FormField>

        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-3 text-sm font-medium text-ink">{t('finance:invoices.items')}</p>
          <PurchaseOrderItemsEditor control={control} register={register} errors={errors} />
        </div>

        {submitError && <p className="mt-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{submitError}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => navigate('/finance/purchase-orders')} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
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
