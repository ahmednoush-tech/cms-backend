import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { useCustomers } from '../../../api/queries/useCustomers';
import { useOpportunities } from '../../../api/queries/useOpportunities';
import { useQuotations } from '../../../api/queries/useQuotations';
import { useEmployees } from '../../../api/queries/useEmployees';

const projectSchema = z.object({
  customerId: z.string().uuid('validation.uuid'),
  opportunityId: z.string().uuid('validation.uuid').optional().or(z.literal('')),
  quotationId: z.string().uuid('validation.uuid').optional().or(z.literal('')),
  name: z.string().min(1, 'validation.required'),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  projectManagerId: z.string().uuid('validation.uuid').optional().or(z.literal('')),
});

export type ProjectFormValues = z.infer<typeof projectSchema>;

interface ProjectFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ProjectFormValues) => void;
  isSubmitting: boolean;
  submitError?: string | null;
}

/**
 * Create-only, per the backend's actual capability: UpdateProjectDto
 * has just name/description/startDate/endDate (confirmed this
 * session — customerId/opportunityId/quotationId/projectManagerId
 * are not editable post-creation; manager changes go through the
 * dedicated assign-manager action instead). No edit-everything
 * form is offered here since the backend has nothing to receive it.
 */
export function ProjectFormModal({ open, onOpenChange, onSubmit, isSubmitting, submitError }: ProjectFormModalProps) {
  const { t } = useTranslation(['projects', 'common']);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ProjectFormValues>({ resolver: zodResolver(projectSchema) });
  const selectedCustomerId = watch('customerId');
  const { data: customersData } = useCustomers({ page: 1, pageSize: 500 });
  // Opportunities and quotations are scoped to the SELECTED customer
  // — one from a different customer would never be a valid choice
  // for this project.
  const { data: opportunitiesData } = useOpportunities({ page: 1, pageSize: 500, customerId: selectedCustomerId || undefined });
  const { data: quotationsData } = useQuotations({ page: 1, pageSize: 500, customerId: selectedCustomerId || undefined });
  const { data: employeesData } = useEmployees({ page: 1, pageSize: 500 });

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title={t('projects:form.createTitle')}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label={t('projects:fields.customerId')} htmlFor="customerId" required error={errors.customerId && t(`common:${errors.customerId.message}`)}>
          <select id="customerId" {...register('customerId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">—</option>
            {(customersData?.items ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.companyName ?? c.customerCode}</option>
            ))}
          </select>
        </FormField>
        <FormField label={t('projects:fields.name')} htmlFor="name" required error={errors.name && t(`common:${errors.name.message}`)}>
          <TextInput id="name" hasError={!!errors.name} {...register('name')} />
        </FormField>
        <FormField label={t('projects:fields.description')} htmlFor="description">
          <textarea id="description" {...register('description')} rows={2} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </FormField>
        <FormField
          label={t('projects:fields.opportunityId')}
          htmlFor="opportunityId"
          error={errors.opportunityId && t(`common:${errors.opportunityId.message}`)}
        >
          <select id="opportunityId" {...register('opportunityId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">—</option>
            {(opportunitiesData?.items ?? []).map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </FormField>
        <FormField
          label={t('projects:fields.quotationId')}
          htmlFor="quotationId"
          hint={t('projects:form.quotationIdHint')}
          error={errors.quotationId && t(`common:${errors.quotationId.message}`)}
        >
          <select id="quotationId" {...register('quotationId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">—</option>
            {(quotationsData?.items ?? []).map((q) => (
              <option key={q.id} value={q.id}>{q.quotationNumber}</option>
            ))}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('projects:fields.startDate')} htmlFor="startDate">
            <TextInput id="startDate" type="date" {...register('startDate')} />
          </FormField>
          <FormField label={t('projects:fields.endDate')} htmlFor="endDate">
            <TextInput id="endDate" type="date" {...register('endDate')} />
          </FormField>
        </div>
        <FormField
          label={t('projects:fields.projectManagerId')}
          htmlFor="projectManagerId"
          hint={t('projects:form.projectManagerIdHint')}
          error={errors.projectManagerId && t(`common:${errors.projectManagerId.message}`)}
        >
          <select id="projectManagerId" {...register('projectManagerId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
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
            {isSubmitting ? t('common:action.processing') : t('common:action.create')}
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
