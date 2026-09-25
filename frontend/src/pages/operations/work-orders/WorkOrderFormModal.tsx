import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { useProjects } from '../../../api/queries/useProjects';
import { useEmployees } from '../../../api/queries/useEmployees';

const workOrderSchema = z.object({
  projectId: z.string().uuid('validation.uuid'),
  title: z.string().min(1, 'validation.required'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignedToEmployeeId: z.string().uuid('validation.uuid').optional().or(z.literal('')),
  dueDate: z.string().optional(),
});

export type WorkOrderFormValues = z.infer<typeof workOrderSchema>;

interface WorkOrderFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: WorkOrderFormValues) => void;
  isSubmitting: boolean;
  submitError?: string | null;
  defaultProjectId?: string;
}

/** customerId is NOT a field here — always server-derived from projectId (confirmed this session). */
export function WorkOrderFormModal({ open, onOpenChange, onSubmit, isSubmitting, submitError, defaultProjectId }: WorkOrderFormModalProps) {
  const { t } = useTranslation(['workOrders', 'common']);
  const { data: projectsData } = useProjects({ page: 1, pageSize: 500 });
  const { data: employeesData } = useEmployees({ page: 1, pageSize: 500 });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WorkOrderFormValues>({ resolver: zodResolver(workOrderSchema), defaultValues: { projectId: defaultProjectId, priority: 'medium' } });

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title={t('workOrders:form.createTitle')}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label={t('workOrders:fields.projectId')} htmlFor="projectId" required error={errors.projectId && t(`common:${errors.projectId.message}`)}>
          <select id="projectId" {...register('projectId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">—</option>
            {(projectsData?.items ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.projectNumber} — {p.name}</option>
            ))}
          </select>
        </FormField>
        <FormField label={t('workOrders:fields.title')} htmlFor="title" required error={errors.title && t(`common:${errors.title.message}`)}>
          <TextInput id="title" hasError={!!errors.title} {...register('title')} />
        </FormField>
        <FormField label={t('workOrders:fields.description')} htmlFor="description">
          <textarea id="description" {...register('description')} rows={2} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('workOrders:fields.priority')} htmlFor="priority">
            <select id="priority" {...register('priority')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
              {['low', 'medium', 'high', 'urgent'].map((p) => (
                <option key={p} value={p}>
                  {t(`common:priority.${p}`)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label={t('workOrders:fields.dueDate')} htmlFor="dueDate">
            <TextInput id="dueDate" type="date" {...register('dueDate')} />
          </FormField>
        </div>
        <FormField
          label={t('workOrders:fields.assignedToEmployeeId')}
          htmlFor="assignedToEmployeeId"
          error={errors.assignedToEmployeeId && t(`common:${errors.assignedToEmployeeId.message}`)}
        >
          <select id="assignedToEmployeeId" {...register('assignedToEmployeeId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
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
