import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAccounts } from '../../../api/queries/useFinance';
import { useCreateJournalEntry } from '../../../api/queries/useFinance';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { JournalEntryLinesEditor } from './JournalEntryLinesEditor';
import { ApiError } from '../../../api/client';

const lineSchema = z.object({
  accountId: z.string().uuid('validation.uuid'),
  debit: z.string().optional(),
  credit: z.string().optional(),
  description: z.string().optional(),
});

const createJournalEntrySchema = z.object({
  entryDate: z.string().min(1, 'validation.required'),
  reference: z.string().optional(),
  description: z.string().optional(),
  lines: z.array(lineSchema).min(2, 'validation.journalEntryMinLines'),
});

export type CreateJournalEntryFormValues = z.infer<typeof createJournalEntrySchema>;

/**
 * All lines are entered up front, in one form — unlike Quotation
 * items (added one at a time via separate endpoints after
 * creation), CreateJournalEntryDto always carries its complete
 * line set in a single request, matching the backend's own
 * balance-at-creation validation (see JournalEntryValidator).
 */
export function CreateJournalEntryPage() {
  const { t } = useTranslation(['finance', 'common']);
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: accountsData } = useAccounts({ page: 1, pageSize: 200 });
  const createMutation = useCreateJournalEntry();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateJournalEntryFormValues>({
    resolver: zodResolver(createJournalEntrySchema),
    defaultValues: {
      entryDate: new Date().toISOString().slice(0, 10),
      lines: [
        { accountId: '', debit: '', credit: '', description: '' },
        { accountId: '', debit: '', credit: '', description: '' },
      ],
    },
  });

  const onSubmit = (values: CreateJournalEntryFormValues) => {
    setSubmitError(null);
    createMutation.mutate(
      {
        entryDate: values.entryDate,
        reference: values.reference || undefined,
        description: values.description || undefined,
        lines: values.lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit ? Number(l.debit) : undefined,
          credit: l.credit ? Number(l.credit) : undefined,
          description: l.description || undefined,
        })),
      },
      {
        onSuccess: (entry) => navigate(`/finance/journal-entries/${entry.id}`),
        onError: (err) => setSubmitError(err instanceof ApiError ? err.message : t('common:error.generic')),
      },
    );
  };

  return (
    <div>
      <PageHeader title={t('finance:journalEntries.form.createTitle')} breadcrumb={t('finance:journalEntries.title')} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="rounded-lg border border-border bg-surface p-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('finance:journalEntries.fields.entryDate')} htmlFor="entryDate" required error={errors.entryDate && t(`common:${errors.entryDate.message}`)}>
            <TextInput id="entryDate" type="date" hasError={!!errors.entryDate} {...register('entryDate')} />
          </FormField>
          <FormField label={t('finance:journalEntries.fields.reference')} htmlFor="reference">
            <TextInput id="reference" {...register('reference')} />
          </FormField>
        </div>
        <FormField label={t('finance:journalEntries.fields.description')} htmlFor="description">
          <textarea id="description" {...register('description')} rows={2} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </FormField>

        <div className="mt-4 border-t border-border pt-4">
          <p className="mb-3 text-sm font-medium text-ink">{t('finance:journalEntries.lines')}</p>
          <JournalEntryLinesEditor control={control} register={register} errors={errors} accounts={accountsData?.items ?? []} />
        </div>

        {submitError && (
          <p className="mt-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {submitError}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => navigate('/finance/journal-entries')} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
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
