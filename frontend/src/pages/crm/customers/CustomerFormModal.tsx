import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { DynamicCustomFields } from '../../../components/DynamicCustomFields/DynamicCustomFields';
import type { Customer } from '../../../types/entities/customer';

/** Mirrors CreateCustomerDto/UpdateCustomerDto validation exactly. */
const customerSchema = z.object({
  customerType: z.enum(['company', 'individual']),
  companyName: z.string().optional(),
  customerCode: z.string().min(1, 'validation.required'),
  email: z.string().email('validation.email').optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  vatRegistrationNumber: z.string().optional(),
});

export type CustomerFormValues = z.infer<typeof customerSchema> & { customFields?: Record<string, string> };

interface CustomerFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: CustomerFormValues) => void;
  isSubmitting: boolean;
  initialValues?: Partial<Customer>;
  mode: 'create' | 'edit';
}

export function CustomerFormModal({ open, onOpenChange, onSubmit, isSubmitting, initialValues, mode }: CustomerFormModalProps) {
  const { t } = useTranslation(['customers', 'common']);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<z.infer<typeof customerSchema>>({
    resolver: zodResolver(customerSchema),
    defaultValues: { customerType: 'company' },
  });

  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      reset({
        customerType: (initialValues?.customerType as 'company' | 'individual') ?? 'company',
        companyName: initialValues?.companyName ?? '',
        customerCode: initialValues?.customerCode ?? '',
        email: initialValues?.email ?? '',
        phone: initialValues?.phone ?? '',
        website: initialValues?.website ?? '',
        address: initialValues?.address ?? '',
        city: initialValues?.city ?? '',
        country: initialValues?.country ?? '',
        vatRegistrationNumber: initialValues?.vatRegistrationNumber ?? '',
      });
      const existingCustomFields = initialValues?.customFields ?? {};
      setCustomFieldValues(
        Object.fromEntries(Object.entries(existingCustomFields).map(([k, v]) => [k, String(v)])),
      );
    }
  }, [open, initialValues, reset]);

  const customerType = watch('customerType');

  const handleFormSubmit = (values: z.infer<typeof customerSchema>) => {
    onSubmit({ ...values, customFields: customFieldValues });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={mode === 'create' ? t('customers:form.createTitle') : t('customers:form.editTitle')}
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
        {mode === 'create' && (
          <FormField label={t('customers:fields.customerType')} htmlFor="customerType" required>
            <select id="customerType" {...register('customerType')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
              <option value="company">{t('customers:type.company')}</option>
              <option value="individual">{t('customers:type.individual')}</option>
            </select>
          </FormField>
        )}

        {customerType === 'company' && (
          <FormField label={t('customers:fields.companyName')} htmlFor="companyName">
            <TextInput id="companyName" {...register('companyName')} />
          </FormField>
        )}

        {mode === 'create' && (
          <FormField
            label={t('customers:fields.customerCode')}
            htmlFor="customerCode"
            required
            error={errors.customerCode && t(`common:${errors.customerCode.message}`)}
            hint={t('customers:form.customerCodeHint')}
          >
            <TextInput id="customerCode" hasError={!!errors.customerCode} {...register('customerCode')} />
          </FormField>
        )}

        <FormField label={t('customers:fields.email')} htmlFor="email" error={errors.email && t(`common:${errors.email.message}`)}>
          <TextInput id="email" type="email" hasError={!!errors.email} {...register('email')} />
        </FormField>
        <FormField label={t('customers:fields.phone')} htmlFor="phone">
          <TextInput id="phone" {...register('phone')} />
        </FormField>
        <FormField label={t('customers:fields.website')} htmlFor="website">
          <TextInput id="website" {...register('website')} />
        </FormField>
        <FormField label={t('customers:fields.address')} htmlFor="address">
          <TextInput id="address" {...register('address')} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('customers:fields.city')} htmlFor="city">
            <TextInput id="city" {...register('city')} />
          </FormField>
          <FormField label={t('customers:fields.country')} htmlFor="country">
            <TextInput id="country" {...register('country')} />
          </FormField>
          <FormField label={t('customers:fields.vatRegistrationNumber')} htmlFor="vatRegistrationNumber" hint={t('customers:fields.vatRegistrationNumberHint')}>
            <TextInput id="vatRegistrationNumber" {...register('vatRegistrationNumber')} maxLength={15} />
          </FormField>
        </div>

        <DynamicCustomFields
          entityType="customer"
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
