import { useFieldArray, type Control, type UseFormRegister, type FieldErrors } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { CreateJournalEntryFormValues } from './CreateJournalEntryPage';
import type { Account } from '../../../types/entities/finance';

interface JournalEntryLinesEditorProps {
  control: Control<CreateJournalEntryFormValues>;
  register: UseFormRegister<CreateJournalEntryFormValues>;
  errors: FieldErrors<CreateJournalEntryFormValues>;
  accounts: Account[];
}

/**
 * The live "Debits {{x}} / Credits {{y}}" indicator here is purely
 * a client-side convenience — it does NOT replace the backend's
 * own JournalEntryValidator.assertBalanced() check, which runs
 * again on submit regardless and is the actual source of truth
 * for whether an entry is allowed to save at all.
 */
export function JournalEntryLinesEditor({ control, register, errors, accounts }: JournalEntryLinesEditorProps) {
  const { t } = useTranslation(['finance', 'common']);
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  const values = fields as unknown as Array<{ debit?: string; credit?: string }>;
  const totalDebit = values.reduce((sum, l) => sum + (Number(l.debit) || 0), 0);
  const totalCredit = values.reduce((sum, l) => sum + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005;

  return (
    <div>
      <table className="w-full text-start text-sm">
        <thead className="text-xs uppercase text-ink-muted">
          <tr>
            <th className="pb-2 text-start">{t('finance:journalEntries.fields.account')}</th>
            <th className="pb-2 text-start">{t('finance:journalEntries.fields.debit')}</th>
            <th className="pb-2 text-start">{t('finance:journalEntries.fields.credit')}</th>
            <th className="pb-2 text-start">{t('finance:journalEntries.fields.lineDescription')}</th>
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {fields.map((field, index) => (
            <tr key={field.id}>
              <td className="py-1.5 pe-2">
                <select {...register(`lines.${index}.accountId` as const)} className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink">
                  <option value="">—</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                  ))}
                </select>
              </td>
              <td className="py-1.5 pe-2">
                <input type="number" step="0.01" min="0" {...register(`lines.${index}.debit` as const)} className="w-24 rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink" />
              </td>
              <td className="py-1.5 pe-2">
                <input type="number" step="0.01" min="0" {...register(`lines.${index}.credit` as const)} className="w-24 rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink" />
              </td>
              <td className="py-1.5 pe-2">
                <input {...register(`lines.${index}.description` as const)} className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink" />
              </td>
              <td className="py-1.5">
                {fields.length > 2 && (
                  <button type="button" onClick={() => remove(index)} className="text-xs font-medium text-danger hover:underline">
                    {t('common:action.delete')}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {errors.lines?.message && <p className="mt-2 text-sm text-danger" role="alert">{errors.lines.message as string}</p>}

      <button
        type="button"
        onClick={() => append({ accountId: '', debit: '', credit: '', description: '' })}
        className="mt-3 text-sm font-medium text-primary hover:underline"
      >
        {t('finance:journalEntries.addLine')}
      </button>

      <div className={`mt-4 rounded border px-3 py-2 text-sm ${balanced ? 'border-success/40 bg-success/10 text-success' : 'border-warning/40 bg-warning/10 text-warning'}`}>
        {t('finance:journalEntries.runningBalance', { debit: totalDebit.toFixed(2), credit: totalCredit.toFixed(2) })}
      </div>
    </div>
  );
}
