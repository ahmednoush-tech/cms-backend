import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { useProjects } from '../../../api/queries/useProjects';
import { useWorkOrders } from '../../../api/queries/useWorkOrders';
import { useEmployees } from '../../../api/queries/useEmployees';

const taskSchema = z.object({
  projectId: z.string().uuid('validation.uuid').optional().or(z.literal('')),
  workOrderId: z.string().uuid('validation.uuid').optional().or(z.literal('')),
  title: z.string().min(1, 'validation.required'),
  description: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignedToEmployeeId: z.string().uuid('validation.uuid').optional().or(z.literal('')),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
});
// The "at least one of projectId/workOrderId" cross-field rule
// (mirrors the backend's own rule, also DB-enforced via
// chk_task_parent — this is a client-side convenience hint only,
// the backend independently re-validates) is deliberately NOT a
// schema-level .refine(). It previously was, relying on
// @hookform/resolvers/zod mapping a refine's `path` back onto
// `formState.errors.projectId` — real testing showed this error
// was never actually attached to the field in practice. Checking
// it explicitly inside the submit handler with RHF's own
// `setError` (below) is unambiguous and directly verifiable: it's
// the same primitive every other manually-triggered error in this
// app already uses.

export type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: TaskFormValues) => void;
  isSubmitting: boolean;
  submitError?: string | null;
  defaultProjectId?: string;
  defaultWorkOrderId?: string;
}

export function TaskFormModal({ open, onOpenChange, onSubmit, isSubmitting, submitError, defaultProjectId, defaultWorkOrderId }: TaskFormModalProps) {
  const { t } = useTranslation(['tasks', 'common']);
  const { data: projectsData } = useProjects({ page: 1, pageSize: 500 });
  const { data: workOrdersData } = useWorkOrders({ page: 1, pageSize: 500 });
  const { data: employeesData } = useEmployees({ page: 1, pageSize: 500 });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: { projectId: defaultProjectId, workOrderId: defaultWorkOrderId, priority: 'medium' },
  });

  const onValid = (values: TaskFormValues) => {
    if (!values.projectId && !values.workOrderId) {
      setError('projectId', { type: 'manual', message: 'validation.atLeastOneParent' });
      return;
    }
    onSubmit(values);
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title={t('tasks:form.createTitle')}
    >
      <form onSubmit={handleSubmit(onValid)} noValidate>
        <FormField
          label={t('tasks:fields.projectId')}
          htmlFor="projectId"
          hint={t('tasks:form.parentHint')}
          error={errors.projectId && t(`common:${errors.projectId.message}`)}
        >
          <select id="projectId" {...register('projectId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">—</option>
            {(projectsData?.items ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.projectNumber} — {p.name}</option>
            ))}
          </select>
        </FormField>
        <FormField label={t('tasks:fields.workOrderId')} htmlFor="workOrderId" error={errors.workOrderId && t(`common:${errors.workOrderId.message}`)}>
          <select id="workOrderId" {...register('workOrderId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">—</option>
            {(workOrdersData?.items ?? []).map((w) => (
              <option key={w.id} value={w.id}>{w.workOrderNumber}</option>
            ))}
          </select>
        </FormField>
        <FormField label={t('tasks:fields.title')} htmlFor="title" required error={errors.title && t(`common:${errors.title.message}`)}>
          <TextInput id="title" hasError={!!errors.title} {...register('title')} />
        </FormField>
        <FormField label={t('tasks:fields.description')} htmlFor="description">
          <textarea id="description" {...register('description')} rows={2} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('tasks:fields.priority')} htmlFor="priority">
            <select id="priority" {...register('priority')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
              {['low', 'medium', 'high', 'urgent'].map((p) => (
                <option key={p} value={p}>
                  {t(`common:priority.${p}`)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label={t('tasks:fields.dueDate')} htmlFor="dueDate">
            <TextInput id="dueDate" type="date" {...register('dueDate')} />
          </FormField>
        </div>
        <FormField
          label={t('tasks:fields.assignedToEmployeeId')}
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
