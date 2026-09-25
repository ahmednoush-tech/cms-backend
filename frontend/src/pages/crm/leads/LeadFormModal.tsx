import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { DynamicCustomFields } from '../../../components/DynamicCustomFields/DynamicCustomFields';
import type { Lead } from '../../../types/entities/lead';

const leadSchema = z.object({
  name: z.string().min(1, 'validation.required'),
  companyName: z.string().optional(),
  email: z.string().email('validation.email').optional().or(z.literal('')),
  phone: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
});

export type LeadFormValues = z.infer<typeof leadSchema> & { customFields?: Record<string, string> };

interface LeadFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: LeadFormValues) => void;
  isSubmitting: boolean;
  initialValues?: Partial<Lead>;
  mode: 'create' | 'edit';
}

export function LeadFormModal({ open, onOpenChange, onSubmit, isSubmitting, initialValues, mode }: LeadFormModalProps) {
  const { t } = useTranslation(['leads', 'common']);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof leadSchema>>({ resolver: zodResolver(leadSchema) });

  /**
   * Managed as its OWN state, separate from react-hook-form —
   * DynamicCustomFields is a plain controlled component (a
   * values/onChange pair), which keeps it entity-agnostic and
   * reusable rather than coupled to this specific form's
   * react-hook-form instance.
   */
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      reset({
        name: initialValues?.name ?? '',
        companyName: initialValues?.companyName ?? '',
        email: initialValues?.email ?? '',
        phone: initialValues?.phone ?? '',
        source: initialValues?.source ?? '',
        notes: initialValues?.notes ?? '',
      });
      const existingCustomFields = initialValues?.customFields ?? {};
      setCustomFieldValues(
        Object.fromEntries(Object.entries(existingCustomFields).map(([k, v]) => [k, String(v)])),
      );
    }
  }, [open, initialValues, reset]);

  const handleFormSubmit = (values: z.infer<typeof leadSchema>) => {
    onSubmit({ ...values, customFields: customFieldValues });
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={mode === 'create' ? t('leads:form.createTitle') : t('leads:form.editTitle')}>
      <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
        <FormField label={t('leads:fields.name')} htmlFor="name" required error={errors.name && t(`common:${errors.name.message}`)}>
          <TextInput id="name" hasError={!!errors.name} {...register('name')} />
        </FormField>
        <FormField label={t('leads:fields.companyName')} htmlFor="companyName">
          <TextInput id="companyName" {...register('companyName')} />
        </FormField>
        <FormField label={t('leads:fields.email')} htmlFor="email" error={errors.email && t(`common:${errors.email.message}`)}>
          <TextInput id="email" type="email" hasError={!!errors.email} {...register('email')} />
        </FormField>
        <FormField label={t('leads:fields.phone')} htmlFor="phone">
          <TextInput id="phone" {...register('phone')} />
        </FormField>
        <FormField label={t('leads:fields.source')} htmlFor="source">
          <TextInput id="source" {...register('source')} />
        </FormField>
        <FormField label={t('leads:fields.notes')} htmlFor="notes">
          <textarea
            id="notes"
            {...register('notes')}
            rows={3}
            className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink"
          />
        </FormField>

        <DynamicCustomFields
          entityType="lead"
          values={customFieldValues}
          onChange={(fieldKey, value) => setCustomFieldValues((prev) => ({ ...prev, [fieldKey]: value }))}
        />

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('common:action.cancel')}
          </button>
          <button type="submit" disabled={isSubmitting} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
            {isSubmitting ? t('common:action.processing') : t('common:action.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
