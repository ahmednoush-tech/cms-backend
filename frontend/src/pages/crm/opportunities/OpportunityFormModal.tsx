import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { DynamicCustomFields } from '../../../components/DynamicCustomFields/DynamicCustomFields';
import { useCustomers } from '../../../api/queries/useCustomers';
import type { Opportunity } from '../../../types/entities/opportunity';

const opportunitySchema = z.object({
  customerId: z.string().uuid('validation.uuid'),
  name: z.string().min(1, 'validation.required'),
  description: z.string().optional(),
  value: z.coerce.number().min(0).optional(),
  currency: z.string().optional(),
  probability: z.coerce.number().min(0).max(100).optional(),
  expectedCloseDate: z.string().optional(),
});

export type OpportunityFormValues = z.infer<typeof opportunitySchema> & { customFields?: Record<string, string> };

interface OpportunityFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: OpportunityFormValues) => void;
  isSubmitting: boolean;
  initialValues?: Partial<Opportunity>;
  mode: 'create' | 'edit';
}

export function OpportunityFormModal({ open, onOpenChange, onSubmit, isSubmitting, initialValues, mode }: OpportunityFormModalProps) {
  const { t } = useTranslation(['opportunities', 'common']);
  const { data: customersData } = useCustomers({ page: 1, pageSize: 500 });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.infer<typeof opportunitySchema>>({ resolver: zodResolver(opportunitySchema) });

  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      reset({
        customerId: initialValues?.customerId ?? '',
        name: initialValues?.name ?? '',
        description: initialValues?.description ?? '',
        value: initialValues?.value ? Number(initialValues.value) : undefined,
        currency: initialValues?.currency ?? 'SAR',
        probability: initialValues?.probability ?? undefined,
        expectedCloseDate: initialValues?.expectedCloseDate?.slice(0, 10) ?? '',
      });
      const existingCustomFields = initialValues?.customFields ?? {};
      setCustomFieldValues(
        Object.fromEntries(Object.entries(existingCustomFields).map(([k, v]) => [k, String(v)])),
      );
    }
  }, [open, initialValues, reset]);

  const handleFormSubmit = (values: z.infer<typeof opportunitySchema>) => {
    onSubmit({ ...values, customFields: customFieldValues });
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={mode === 'create' ? t('opportunities:form.createTitle') : t('opportunities:form.editTitle')}>
      <form onSubmit={handleSubmit(handleFormSubmit)} noValidate>
        {mode === 'create' && (
          <FormField
            label={t('opportunities:fields.customerId')}
            htmlFor="customerId"
            required
            error={errors.customerId && t(`common:${errors.customerId.message}`)}
            hint={t('opportunities:form.customerIdHint')}
          >
            <select id="customerId" {...register('customerId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
              <option value="">—</option>
              {(customersData?.items ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.companyName ?? c.customerCode}</option>
              ))}
            </select>
          </FormField>
        )}
        <FormField label={t('opportunities:fields.name')} htmlFor="name" required error={errors.name && t(`common:${errors.name.message}`)}>
          <TextInput id="name" hasError={!!errors.name} {...register('name')} />
        </FormField>
        <FormField label={t('opportunities:fields.description')} htmlFor="description">
          <textarea id="description" {...register('description')} rows={2} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('opportunities:fields.value')} htmlFor="value">
            <TextInput id="value" type="number" step="0.01" {...register('value')} />
          </FormField>
          <FormField label={t('opportunities:fields.currency')} htmlFor="currency">
            <TextInput id="currency" {...register('currency')} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('opportunities:fields.probability')} htmlFor="probability">
            <TextInput id="probability" type="number" min={0} max={100} {...register('probability')} />
          </FormField>
          <FormField label={t('opportunities:fields.expectedCloseDate')} htmlFor="expectedCloseDate">
            <TextInput id="expectedCloseDate" type="date" {...register('expectedCloseDate')} />
          </FormField>
        </div>

        <DynamicCustomFields
          entityType="opportunity"
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
