import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../../components/Form/FormField';
import { InvoiceNoteItemsEditor } from './InvoiceNoteItemsEditor';
import { useCreateInvoiceNote } from '../../../../api/queries/useFinance';
import { ApiError } from '../../../../api/client';

const itemSchema = z.object({
  description: z.string().min(1, 'validation.required'),
  quantity: z.string().min(1, 'validation.required'),
  unitPrice: z.string().min(1, 'validation.required'),
  discount: z.string().optional(),
  tax: z.string().optional(),
});

const noteSchema = z.object({
  noteType: z.enum(['credit', 'debit']),
  noteDate: z.string().min(1, 'validation.required'),
  reason: z.string().optional(),
  items: z.array(itemSchema).min(1, 'validation.required'),
});

export type CreateInvoiceNoteFormValues = z.infer<typeof noteSchema>;

interface CreateInvoiceNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
}

export function CreateInvoiceNoteModal({ open, onOpenChange, invoiceId }: CreateInvoiceNoteModalProps) {
  const { t } = useTranslation(['finance', 'common']);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const createMutation = useCreateInvoiceNote();

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreateInvoiceNoteFormValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: {
      noteType: 'credit',
      noteDate: new Date().toISOString().slice(0, 10),
      items: [{ description: '', quantity: '1', unitPrice: '0', discount: '0', tax: '0' }],
    },
  });
  const noteType = watch('noteType');

  const onSubmit = (values: CreateInvoiceNoteFormValues) => {
    setSubmitError(null);
    createMutation.mutate(
      {
        invoiceId,
        noteType: values.noteType,
        noteDate: values.noteDate,
        reason: values.reason || undefined,
        items: values.items.map((i) => ({
          description: i.description,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          discount: i.discount ? Number(i.discount) : undefined,
          tax: i.tax ? Number(i.tax) : undefined,
        })),
      },
      {
        onSuccess: () => {
          reset();
          onOpenChange(false);
        },
        onError: (err) => setSubmitError(err instanceof ApiError ? err.message : t('common:error.generic')),
      },
    );
  };

  return (
    <Modal open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }} title={t('finance:invoiceNotes.form.createTitle')}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label={t('finance:invoiceNotes.fields.noteType')} htmlFor="noteType" required>
          <div className="flex gap-2">
            <label className={`flex-1 cursor-pointer rounded border px-3 py-2 text-center text-sm font-medium ${noteType === 'credit' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-ink'}`}>
              <input type="radio" value="credit" {...register('noteType')} className="sr-only" />
              {t('finance:invoiceNotes.type.credit')}
            </label>
            <label className={`flex-1 cursor-pointer rounded border px-3 py-2 text-center text-sm font-medium ${noteType === 'debit' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-ink'}`}>
              <input type="radio" value="debit" {...register('noteType')} className="sr-only" />
              {t('finance:invoiceNotes.type.debit')}
            </label>
          </div>
        </FormField>
        <p className="mb-4 text-xs text-ink-muted">
          {noteType === 'credit' ? t('finance:invoiceNotes.type.creditHint') : t('finance:invoiceNotes.type.debitHint')}
        </p>

        <FormField label={t('finance:invoiceNotes.fields.noteDate')} htmlFor="noteDate" required error={errors.noteDate && t(`common:${errors.noteDate.message}`)}>
          <TextInput id="noteDate" type="date" hasError={!!errors.noteDate} {...register('noteDate')} />
        </FormField>
        <FormField label={t('finance:invoiceNotes.fields.reason')} htmlFor="reason">
          <textarea id="reason" {...register('reason')} rows={2} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </FormField>

        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-3 text-sm font-medium text-ink">{t('finance:invoices.items')}</p>
          <InvoiceNoteItemsEditor control={control} register={register} errors={errors} />
        </div>

        {submitError && <p className="mt-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{submitError}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('common:action.cancel')}
          </button>
          <button type="submit" disabled={createMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
            {createMutation.isPending ? t('common:action.processing') : t('common:action.create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
