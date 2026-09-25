import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { useEmployees } from '../../../api/queries/useEmployees';
import type { Department } from '../../../types/entities/administration';

const departmentSchema = z.object({
  name: z.string().min(1, 'validation.required'),
  description: z.string().optional(),
  managerId: z.string().uuid('validation.uuid').optional().or(z.literal('')),
});

export type DepartmentFormValues = z.infer<typeof departmentSchema>;

interface DepartmentFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: DepartmentFormValues) => void;
  isSubmitting: boolean;
  submitError?: string | null;
  initialValues?: Partial<Department>;
  mode: 'create' | 'edit';
}

export function DepartmentFormModal({ open, onOpenChange, onSubmit, isSubmitting, submitError, initialValues, mode }: DepartmentFormModalProps) {
  const { t } = useTranslation(['departments', 'common']);
  const { data: employeesData } = useEmployees({ page: 1, pageSize: 500 });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DepartmentFormValues>({ resolver: zodResolver(departmentSchema) });

  useEffect(() => {
    if (open) {
      reset({
        name: initialValues?.name ?? '',
        description: initialValues?.description ?? '',
        managerId: initialValues?.managerId ?? '',
      });
    }
  }, [open, initialValues, reset]);

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={mode === 'create' ? t('departments:form.createTitle') : t('departments:form.editTitle')}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label={t('departments:fields.name')} htmlFor="name" required error={errors.name && t(`common:${errors.name.message}`)}>
          <TextInput id="name" hasError={!!errors.name} {...register('name')} />
        </FormField>
        <FormField label={t('departments:fields.description')} htmlFor="description">
          <textarea id="description" {...register('description')} rows={2} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </FormField>
        <FormField
          label={t('departments:fields.managerId')}
          htmlFor="managerId"
          hint={t('departments:form.managerIdHint')}
          error={errors.managerId && t(`common:${errors.managerId.message}`)}
        >
          <select id="managerId" {...register('managerId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">—</option>
            {(employeesData?.items ?? []).map((e) => (
              <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
            ))}
          </select>
        </FormField>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('common:action.cancel')}
          </button>
          <button type="submit" disabled={isSubmitting} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
            {isSubmitting ? t('common:action.processing') : t('common:action.save')}
          </button>
        </div>
        {submitError && (
          <p className="mt-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {submitError}
          </p>
        )}
      </form>
    </Modal>
  );
}
