import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { useDepartments } from '../../../api/queries/useDepartments';
import { useEmployees } from '../../../api/queries/useEmployees';
import type { Employee } from '../../../types/entities/administration';

const employeeSchema = z.object({
  employeeNumber: z.string().min(1, 'validation.required'),
  firstName: z.string().min(1, 'validation.required'),
  lastName: z.string().min(1, 'validation.required'),
  departmentId: z.string().uuid('validation.uuid').optional().or(z.literal('')),
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('validation.email').optional().or(z.literal('')),
  hireDate: z.string().optional(),
  managerId: z.string().uuid('validation.uuid').optional().or(z.literal('')),
  status: z.enum(['active', 'inactive', 'terminated']).optional(),
  basicSalary: z.string().optional(),
  housingAllowance: z.string().optional(),
  otherAllowances: z.string().optional(),
  gosiEmployeeRate: z.string().optional(),
  gosiEmployerRate: z.string().optional(),
  nationality: z.string().optional(),
  iqamaNumber: z.string().optional(),
  iqamaExpiryDate: z.string().optional(),
});

export type EmployeeFormValues = z.infer<typeof employeeSchema>;

interface EmployeeFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: EmployeeFormValues) => void;
  isSubmitting: boolean;
  submitError?: string | null;
  initialValues?: Partial<Employee>;
  mode: 'create' | 'edit';
}

export function EmployeeFormModal({ open, onOpenChange, onSubmit, isSubmitting, submitError, initialValues, mode }: EmployeeFormModalProps) {
  const { t } = useTranslation(['employees', 'common']);
  const { data: departmentsData } = useDepartments({ page: 1, pageSize: 500 });
  const { data: employeesData } = useEmployees({ page: 1, pageSize: 500 });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EmployeeFormValues>({ resolver: zodResolver(employeeSchema) });

  useEffect(() => {
    if (open) {
      reset({
        employeeNumber: initialValues?.employeeNumber ?? '',
        firstName: initialValues?.firstName ?? '',
        lastName: initialValues?.lastName ?? '',
        departmentId: initialValues?.departmentId ?? '',
        jobTitle: initialValues?.jobTitle ?? '',
        phone: initialValues?.phone ?? '',
        email: initialValues?.email ?? '',
        hireDate: initialValues?.hireDate?.slice(0, 10) ?? '',
        managerId: initialValues?.managerId ?? '',
        status: (initialValues?.status as 'active' | 'inactive' | 'terminated') ?? undefined,
        basicSalary: initialValues?.basicSalary ?? '',
        housingAllowance: initialValues?.housingAllowance ?? '',
        otherAllowances: initialValues?.otherAllowances ?? '',
        gosiEmployeeRate: initialValues?.gosiEmployeeRate ?? '',
        gosiEmployerRate: initialValues?.gosiEmployerRate ?? '',
        nationality: initialValues?.nationality ?? '',
        iqamaNumber: initialValues?.iqamaNumber ?? '',
        iqamaExpiryDate: initialValues?.iqamaExpiryDate?.slice(0, 10) ?? '',
      });
    }
  }, [open, initialValues, reset]);

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={mode === 'create' ? t('employees:form.createTitle') : t('employees:form.editTitle')}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {mode === 'create' && (
          <FormField
            label={t('employees:fields.employeeNumber')}
            htmlFor="employeeNumber"
            required
            error={errors.employeeNumber && t(`common:${errors.employeeNumber.message}`)}
          >
            <TextInput id="employeeNumber" hasError={!!errors.employeeNumber} {...register('employeeNumber')} />
          </FormField>
        )}
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('employees:fields.firstName')} htmlFor="firstName" required error={errors.firstName && t(`common:${errors.firstName.message}`)}>
            <TextInput id="firstName" hasError={!!errors.firstName} {...register('firstName')} />
          </FormField>
          <FormField label={t('employees:fields.lastName')} htmlFor="lastName" required error={errors.lastName && t(`common:${errors.lastName.message}`)}>
            <TextInput id="lastName" hasError={!!errors.lastName} {...register('lastName')} />
          </FormField>
        </div>
        <FormField label={t('employees:fields.jobTitle')} htmlFor="jobTitle">
          <TextInput id="jobTitle" {...register('jobTitle')} />
        </FormField>
        <FormField
          label={t('employees:fields.departmentId')}
          htmlFor="departmentId"
          error={errors.departmentId && t(`common:${errors.departmentId.message}`)}
        >
          <select id="departmentId" {...register('departmentId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">—</option>
            {(departmentsData?.items ?? []).map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('employees:fields.email')} htmlFor="email" error={errors.email && t(`common:${errors.email.message}`)}>
            <TextInput id="email" type="email" hasError={!!errors.email} {...register('email')} />
          </FormField>
          <FormField label={t('employees:fields.phone')} htmlFor="phone">
            <TextInput id="phone" {...register('phone')} />
          </FormField>
        </div>
        <FormField label={t('employees:fields.hireDate')} htmlFor="hireDate">
          <TextInput id="hireDate" type="date" {...register('hireDate')} />
        </FormField>
        <FormField
          label={t('employees:fields.managerId')}
          htmlFor="managerId"
          hint={t('employees:form.managerIdHint')}
          error={errors.managerId && t(`common:${errors.managerId.message}`)}
        >
          <select id="managerId" {...register('managerId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">—</option>
            {(employeesData?.items ?? [])
              .filter((e) => e.id !== initialValues?.id)
              .map((e) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
              ))}
          </select>
        </FormField>
        {mode === 'edit' && (
          <FormField label={t('employees:fields.status')} htmlFor="status">
            <select id="status" {...register('status')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
              {['active', 'inactive', 'terminated'].map((s) => (
                <option key={s} value={s}>
                  {t(`employees:status.${s}`)}
                </option>
              ))}
            </select>
          </FormField>
        )}

        {mode === 'edit' && (
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-1 text-sm font-medium text-ink">{t('employees:compensation.title')}</p>
            <p className="mb-2 text-xs text-ink-muted">{t('employees:compensation.hint')}</p>
            <div className="grid grid-cols-3 gap-3">
              <FormField label={t('employees:compensation.basicSalary')} htmlFor="basicSalary">
                <TextInput id="basicSalary" type="number" step="0.01" min="0" {...register('basicSalary')} />
              </FormField>
              <FormField label={t('employees:compensation.housingAllowance')} htmlFor="housingAllowance">
                <TextInput id="housingAllowance" type="number" step="0.01" min="0" {...register('housingAllowance')} />
              </FormField>
              <FormField label={t('employees:compensation.otherAllowances')} htmlFor="otherAllowances">
                <TextInput id="otherAllowances" type="number" step="0.01" min="0" {...register('otherAllowances')} />
              </FormField>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <FormField label={t('employees:compensation.gosiEmployeeRate')} htmlFor="gosiEmployeeRate" hint={t('employees:compensation.gosiHint')}>
                <TextInput id="gosiEmployeeRate" type="number" step="0.001" min="0" {...register('gosiEmployeeRate')} />
              </FormField>
              <FormField label={t('employees:compensation.gosiEmployerRate')} htmlFor="gosiEmployerRate" hint={t('employees:compensation.gosiHint')}>
                <TextInput id="gosiEmployerRate" type="number" step="0.001" min="0" {...register('gosiEmployerRate')} />
              </FormField>
            </div>

            <div className="mt-3 border-t border-border pt-3">
              <p className="mb-1 text-sm font-medium text-ink">{t('employees:residency.title')}</p>
              <p className="mb-2 text-xs text-ink-muted">{t('employees:residency.hint')}</p>
              <div className="grid grid-cols-3 gap-3">
                <FormField label={t('employees:residency.nationality')} htmlFor="nationality">
                  <TextInput id="nationality" {...register('nationality')} />
                </FormField>
                <FormField label={t('employees:residency.iqamaNumber')} htmlFor="iqamaNumber">
                  <TextInput id="iqamaNumber" {...register('iqamaNumber')} />
                </FormField>
                <FormField label={t('employees:residency.iqamaExpiryDate')} htmlFor="iqamaExpiryDate">
                  <TextInput id="iqamaExpiryDate" type="date" {...register('iqamaExpiryDate')} />
                </FormField>
              </div>
            </div>
          </div>
        )}

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
