import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';
import type { Vendor } from '../../../types/entities/finance';

const vendorSchema = z.object({
  vendorCode: z.string().min(1, 'validation.required').max(50),
  name: z.string().min(1, 'validation.required').max(200),
  email: z.string().email('validation.email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

export type VendorFormValues = z.infer<typeof vendorSchema>;

interface VendorFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  submitError?: string | null;
  mode: 'create' | 'edit';
  initialValues?: Partial<Vendor>;
  onSubmit: (values: VendorFormValues) => void;
}

export function VendorFormModal({ open, onOpenChange, isSubmitting, submitError, mode, initialValues, onSubmit }: VendorFormModalProps) {
  const { t } = useTranslation(['finance', 'common']);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VendorFormValues>({ resolver: zodResolver(vendorSchema) });

  useEffect(() => {
    if (open) {
      reset({
        vendorCode: initialValues?.vendorCode ?? '',
        name: initialValues?.name ?? '',
        email: initialValues?.email ?? '',
        phone: initialValues?.phone ?? '',
        address: initialValues?.address ?? '',
        city: initialValues?.city ?? '',
        country: initialValues?.country ?? '',
      });
    }
  }, [open, initialValues, reset]);

  return (
    <Modal
      open={open}
      onOpenChange={(next) => { if (!next) reset(); onOpenChange(next); }}
      title={mode === 'create' ? t('finance:vendors.form.createTitle') : t('finance:vendors.form.editTitle')}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('finance:vendors.fields.vendorCode')} htmlFor="vendorCode" required error={errors.vendorCode && t(`common:${errors.vendorCode.message}`)}>
            <TextInput id="vendorCode" hasError={!!errors.vendorCode} disabled={mode === 'edit'} {...register('vendorCode')} />
          </FormField>
          <FormField label={t('finance:vendors.fields.name')} htmlFor="name" required error={errors.name && t(`common:${errors.name.message}`)}>
            <TextInput id="name" hasError={!!errors.name} {...register('name')} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('finance:vendors.fields.email')} htmlFor="email" error={errors.email && t(`common:${errors.email.message}`)}>
            <TextInput id="email" type="email" hasError={!!errors.email} {...register('email')} />
          </FormField>
          <FormField label={t('finance:vendors.fields.phone')} htmlFor="phone">
            <TextInput id="phone" {...register('phone')} />
          </FormField>
        </div>
        <FormField label={t('finance:vendors.fields.address')} htmlFor="address">
          <TextInput id="address" {...register('address')} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('finance:vendors.fields.city')} htmlFor="city">
            <TextInput id="city" {...register('city')} />
          </FormField>
          <FormField label={t('finance:vendors.fields.country')} htmlFor="country">
            <TextInput id="country" {...register('country')} />
          </FormField>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('common:action.cancel')}
          </button>
          <button type="submit" disabled={isSubmitting} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
            {isSubmitting ? t('common:action.processing') : mode === 'create' ? t('common:action.create') : t('common:action.save')}
          </button>
        </div>
        {submitError && <p className="mt-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{submitError}</p>}
      </form>
    </Modal>
  );
}
