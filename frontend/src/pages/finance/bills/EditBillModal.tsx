import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { useUpdateBill } from '../../../api/queries/useFinance';
import { ApiError } from '../../../api/client';
import type { Bill } from '../../../types/entities/finance';

const editBillSchema = z.object({
  vendorReference: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

type EditBillFormValues = z.infer<typeof editBillSchema>;

interface EditBillModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: Bill;
}

/**
 * Deliberately narrow — matches backend UpdateBillDto exactly
 * (vendorReference + dueDate + notes only). Line items, vendor,
 * and bill date cannot be changed on a draft; the correct fix for
 * a wrong draft is to delete it and create a new one.
 */
export function EditBillModal({ open, onOpenChange, bill }: EditBillModalProps) {
  const { t } = useTranslation(['finance', 'common']);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const updateMutation = useUpdateBill(bill.id);
  const { register, handleSubmit, reset } = useForm<EditBillFormValues>({ resolver: zodResolver(editBillSchema) });

  useEffect(() => {
    if (open) {
      reset({ vendorReference: bill.vendorReference ?? '', dueDate: bill.dueDate ?? '', notes: bill.notes ?? '' });
      setSubmitError(null);
    }
  }, [open, bill, reset]);

  const onSubmit = handleSubmit((values) => {
    setSubmitError(null);
    updateMutation.mutate(
      { vendorReference: values.vendorReference || undefined, dueDate: values.dueDate || undefined, notes: values.notes || undefined },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) => setSubmitError(err instanceof ApiError ? err.message : t('common:error.generic')),
      },
    );
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('finance:bills.form.editTitle')}>
      <form onSubmit={onSubmit} noValidate>
        <p className="mb-3 text-xs text-ink-muted">{t('finance:bills.form.editScopeHint')}</p>
        <FormField label={t('finance:bills.fields.vendorReference')} htmlFor="vendorReference">
          <TextInput id="vendorReference" {...register('vendorReference')} />
        </FormField>
        <FormField label={t('finance:bills.fields.dueDate')} htmlFor="dueDate">
          <TextInput id="dueDate" type="date" {...register('dueDate')} />
        </FormField>
        <FormField label={t('finance:invoices.fields.notes')} htmlFor="notes">
          <textarea id="notes" {...register('notes')} rows={3} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </FormField>

        {submitError && <p className="mt-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{submitError}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('common:action.cancel')}
          </button>
          <button type="submit" disabled={updateMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
            {updateMutation.isPending ? t('common:action.processing') : t('common:action.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
