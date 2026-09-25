import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { useAccounts } from '../../../api/queries/useFinance';
import type { InventoryItem } from '../../../types/entities/finance';

const adjustStockSchema = z.object({
  direction: z.enum(['increase', 'decrease']),
  quantity: z.string().min(1, 'validation.required'),
  unitCost: z.string().optional(),
  offsetAccountId: z.string().uuid('validation.uuid'),
  notes: z.string().optional(),
});

export type AdjustStockFormValues = z.infer<typeof adjustStockSchema>;

interface AdjustStockModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  submitError?: string | null;
  item: InventoryItem;
  onSubmit: (values: AdjustStockFormValues) => void;
}

export function AdjustStockModal({ open, onOpenChange, isSubmitting, submitError, item, onSubmit }: AdjustStockModalProps) {
  const { t } = useTranslation(['finance', 'common']);
  const { data: accountsData } = useAccounts({ page: 1, pageSize: 300 });
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<AdjustStockFormValues>({ resolver: zodResolver(adjustStockSchema), defaultValues: { direction: 'increase' } });
  const direction = watch('direction');

  return (
    <Modal open={open} onOpenChange={(next: boolean) => { if (!next) reset(); onOpenChange(next); }} title={t('finance:inventory.adjust.title', { name: item.name })}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <p className="mb-3 text-sm text-ink-muted">
          {t('finance:inventory.adjust.currentStock', { qty: item.quantityOnHand, unit: item.unitOfMeasure, cost: item.averageUnitCost })}
        </p>

        <FormField label={t('finance:inventory.adjust.direction')} htmlFor="direction" required>
          <div className="flex gap-2">
            <label className={`flex-1 cursor-pointer rounded border px-3 py-2 text-center text-sm font-medium ${direction === 'increase' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-ink'}`}>
              <input type="radio" value="increase" {...register('direction')} className="sr-only" />
              {t('finance:inventory.adjust.increase')}
            </label>
            <label className={`flex-1 cursor-pointer rounded border px-3 py-2 text-center text-sm font-medium ${direction === 'decrease' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-ink'}`}>
              <input type="radio" value="decrease" {...register('direction')} className="sr-only" />
              {t('finance:inventory.adjust.decrease')}
            </label>
          </div>
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('finance:inventory.adjust.quantity')} htmlFor="quantity" required error={errors.quantity && t(`common:${errors.quantity.message}`)}>
            <TextInput id="quantity" type="number" step="0.001" min="0.001" hasError={!!errors.quantity} {...register('quantity')} />
          </FormField>
          {direction === 'increase' && (
            <FormField label={t('finance:inventory.fields.openingUnitCost')} htmlFor="unitCost" required>
              <TextInput id="unitCost" type="number" step="0.0001" min="0" {...register('unitCost')} />
            </FormField>
          )}
        </div>

        <FormField
          label={t('finance:inventory.adjust.offsetAccount')}
          htmlFor="offsetAccountId"
          required
          hint={t('finance:inventory.adjust.offsetAccountHint')}
          error={errors.offsetAccountId && t(`common:${errors.offsetAccountId.message}`)}
        >
          <select id="offsetAccountId" {...register('offsetAccountId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">—</option>
            {(accountsData?.items ?? []).map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </FormField>

        <FormField label={t('finance:invoiceNotes.fields.reason')} htmlFor="notes">
          <textarea id="notes" {...register('notes')} rows={2} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </FormField>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('common:action.cancel')}
          </button>
          <button type="submit" disabled={isSubmitting} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
            {isSubmitting ? t('common:action.processing') : t('common:action.save')}
          </button>
        </div>
        {submitError && <p className="mt-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{submitError}</p>}
      </form>
    </Modal>
  );
}
