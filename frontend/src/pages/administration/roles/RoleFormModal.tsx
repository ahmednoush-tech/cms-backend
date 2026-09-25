import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';

const roleSchema = z.object({
  name: z.string().min(1, 'validation.required'),
  description: z.string().optional(),
});

export type RoleFormValues = z.infer<typeof roleSchema>;

interface RoleFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: RoleFormValues) => void;
  isSubmitting: boolean;
  submitError?: string | null;
}

/**
 * Create-only. Confirmed this session: the backend has no
 * PATCH /roles/:id and no DELETE /roles/:id — a role's name/
 * description cannot be changed and a role cannot be deleted
 * once created, via this API. Not offered here since there is
 * nothing to call (see Phase 3E report, backend gaps).
 */
export function RoleFormModal({ open, onOpenChange, onSubmit, isSubmitting, submitError }: RoleFormModalProps) {
  const { t } = useTranslation(['roles', 'common']);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RoleFormValues>({ resolver: zodResolver(roleSchema) });

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title={t('roles:form.createTitle')}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label={t('roles:fields.name')} htmlFor="name" required error={errors.name && t(`common:${errors.name.message}`)}>
          <TextInput id="name" hasError={!!errors.name} {...register('name')} />
        </FormField>
        <FormField label={t('roles:fields.description')} htmlFor="description">
          <textarea id="description" {...register('description')} rows={2} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </FormField>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('common:action.cancel')}
          </button>
          <button type="submit" disabled={isSubmitting} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
            {isSubmitting ? t('common:action.processing') : t('common:action.create')}
          </button>
        </div>
        {submitError && <p className="mt-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{submitError}</p>}
      </form>
    </Modal>
  );
}
