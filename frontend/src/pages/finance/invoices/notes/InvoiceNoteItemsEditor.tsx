import { useFieldArray, type Control, type UseFormRegister, type FieldErrors } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { CreateInvoiceNoteFormValues } from './CreateInvoiceNoteModal';

interface InvoiceNoteItemsEditorProps {
  control: Control<CreateInvoiceNoteFormValues>;
  register: UseFormRegister<CreateInvoiceNoteFormValues>;
  errors: FieldErrors<CreateInvoiceNoteFormValues>;
}

export function InvoiceNoteItemsEditor({ control, register, errors }: InvoiceNoteItemsEditorProps) {
  const { t } = useTranslation(['finance', 'common']);
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  return (
    <div>
      <table className="w-full text-start text-sm">
        <thead className="text-xs uppercase text-ink-muted">
          <tr>
            <th className="pb-2 text-start">{t('finance:invoices.fields.description')}</th>
            <th className="pb-2 text-start">{t('finance:invoices.fields.quantity')}</th>
            <th className="pb-2 text-start">{t('finance:invoices.fields.unitPrice')}</th>
            <th className="pb-2 text-start">{t('finance:invoices.fields.discount')}</th>
            <th className="pb-2 text-start">{t('finance:invoices.fields.tax')}</th>
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
              <td className="py-1.5 pe-2">
                <input type="number" step="0.01" min="0" {...register(`items.${index}.discount` as const)} className="w-20 rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink" />
              </td>
              <td className="py-1.5 pe-2">
                <input type="number" step="0.01" min="0" {...register(`items.${index}.tax` as const)} className="w-20 rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink" />
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
      {errors.items?.message && <p className="mt-2 text-sm text-danger" role="alert">{errors.items.message as string}</p>}

      <button
        type="button"
        onClick={() => append({ description: '', quantity: '1', unitPrice: '0', discount: '0', tax: '0' })}
        className="mt-3 text-sm font-medium text-primary hover:underline"
      >
        {t('finance:invoices.addItem')}
      </button>
    </div>
  );
}
