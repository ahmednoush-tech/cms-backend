import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';

const periodSchema = z.object({
  name: z.string().min(1, 'validation.required').max(100),
  startDate: z.string().min(1, 'validation.required'),
  endDate: z.string().min(1, 'validation.required'),
});

export type PeriodFormValues = z.infer<typeof periodSchema>;

interface PeriodFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  submitError?: string | null;
  onSubmit: (values: PeriodFormValues) => void;
}

export function PeriodFormModal({ open, onOpenChange, isSubmitting, submitError, onSubmit }: PeriodFormModalProps) {
  const { t } = useTranslation(['finance', 'common']);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PeriodFormValues>({ resolver: zodResolver(periodSchema) });

  return (
    <Modal open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }} title={t('finance:periods.form.createTitle')}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label={t('finance:periods.fields.name')} htmlFor="name" required error={errors.name && t(`common:${errors.name.message}`)}>
          <TextInput id="name" placeholder={t('finance:periods.form.namePlaceholder')} hasError={!!errors.name} {...register('name')} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('finance:periods.fields.startDate')} htmlFor="startDate" required error={errors.startDate && t(`common:${errors.startDate.message}`)}>
            <TextInput id="startDate" type="date" hasError={!!errors.startDate} {...register('startDate')} />
          </FormField>
          <FormField label={t('finance:periods.fields.endDate')} htmlFor="endDate" required error={errors.endDate && t(`common:${errors.endDate.message}`)}>
            <TextInput id="endDate" type="date" hasError={!!errors.endDate} {...register('endDate')} />
          </FormField>
        </div>

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
