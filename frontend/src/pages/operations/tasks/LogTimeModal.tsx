import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { useEmployees } from '../../../api/queries/useEmployees';
import { useCreateTimeEntry, useUpdateTimeEntry } from '../../../api/queries/useTimeEntries';
import { ApiError } from '../../../api/client';
import type { TimeEntry } from '../../../types/entities/timeEntry';

const schema = z.object({
  employeeId: z.string().uuid('validation.uuid'),
  entryDate: z.string().min(1, 'validation.required'),
  hours: z.string().min(1, 'validation.required'),
  notes: z.string().optional(),
  billable: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

interface LogTimeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  /** When provided, the modal edits this entry instead of creating a new one — employee/task cannot be changed on edit, matching the backend's UpdateTimeEntryDto scope. */
  editingEntry?: TimeEntry;
}

export function LogTimeModal({ open, onOpenChange, taskId, editingEntry }: LogTimeModalProps) {
  const { t } = useTranslation(['timeTracking', 'common']);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { data: employeesData } = useEmployees({ page: 1, pageSize: 200 });
  const createMutation = useCreateTimeEntry();
  const updateMutation = useUpdateTimeEntry(editingEntry?.id ?? '', taskId);
  const isEditing = !!editingEntry;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { entryDate: new Date().toISOString().slice(0, 10), billable: true },
  });

  useEffect(() => {
    if (open) {
      reset({
        employeeId: editingEntry?.employeeId ?? '',
        entryDate: editingEntry?.entryDate.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        hours: editingEntry?.hours ?? '',
        notes: editingEntry?.notes ?? '',
        billable: editingEntry?.billable ?? true,
      });
      setSubmitError(null);
    }
  }, [open, editingEntry, reset]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = handleSubmit((values) => {
    setSubmitError(null);
    const onError = (err: unknown) => setSubmitError(err instanceof ApiError ? err.message : t('common:error.generic'));
    const onSuccess = () => onOpenChange(false);

    if (isEditing) {
      updateMutation.mutate(
        { entryDate: values.entryDate, hours: Number(values.hours), notes: values.notes || undefined, billable: values.billable },
        { onSuccess, onError },
      );
    } else {
      createMutation.mutate(
        { taskId, employeeId: values.employeeId, entryDate: values.entryDate, hours: Number(values.hours), notes: values.notes || undefined, billable: values.billable },
        { onSuccess, onError },
      );
    }
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={isEditing ? t('timeTracking:form.editTitle') : t('timeTracking:form.createTitle')}>
      <form onSubmit={onSubmit} noValidate>
        {!isEditing && (
          <FormField label={t('timeTracking:fields.employee')} htmlFor="employeeId" required error={errors.employeeId && t(`common:${errors.employeeId.message}`)}>
            <select id="employeeId" {...register('employeeId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
              <option value="">—</option>
              {(employeesData?.items ?? []).map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
              ))}
            </select>
          </FormField>
        )}

        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('timeTracking:fields.entryDate')} htmlFor="entryDate" required error={errors.entryDate && t(`common:${errors.entryDate.message}`)}>
            <TextInput id="entryDate" type="date" hasError={!!errors.entryDate} {...register('entryDate')} />
          </FormField>
          <FormField label={t('timeTracking:fields.hours')} htmlFor="hours" required error={errors.hours && t(`common:${errors.hours.message}`)}>
            <TextInput id="hours" type="number" step="0.25" min="0.01" max="24" hasError={!!errors.hours} {...register('hours')} />
          </FormField>
        </div>

        <FormField label={t('timeTracking:fields.notes')} htmlFor="notes">
          <textarea id="notes" {...register('notes')} rows={2} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </FormField>

        <label className="mb-3 flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" {...register('billable')} />
          {t('timeTracking:fields.billable')}
        </label>

        {submitError && <p className="mt-1 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{submitError}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('common:action.cancel')}
          </button>
          <button type="submit" disabled={isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
            {isPending ? t('common:action.processing') : isEditing ? t('common:action.save') : t('common:action.create')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
