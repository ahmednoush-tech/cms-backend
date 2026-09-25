import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';
import type { AdminUser } from '../../../types/entities/administration';
import { PASSWORD_MIN_LENGTH, PASSWORD_STRENGTH_REGEX } from '../../../lib/passwordPolicy';

const createUserSchema = z.object({
  name: z.string().min(1, 'validation.required'),
  email: z.string().email('validation.email'),
  password: z.string().min(PASSWORD_MIN_LENGTH, 'validation.minLength').regex(PASSWORD_STRENGTH_REGEX, 'validation.passwordStrength'),
  phone: z.string().optional(),
});

/**
 * No password field here — UpdateUserDto genuinely has none
 * (confirmed this session). Editing a user cannot change their
 * password through this API at all; not offered here since it
 * would silently do nothing.
 */
const editUserSchema = z.object({
  name: z.string().min(1, 'validation.required'),
  phone: z.string().optional(),
  status: z.enum(['active', 'inactive', 'locked']).optional(),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;
export type EditUserFormValues = z.infer<typeof editUserSchema>;

interface UserFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  submitError?: string | null;
  mode: 'create' | 'edit';
  initialValues?: Partial<AdminUser>;
  onSubmitCreate?: (values: CreateUserFormValues) => void;
  onSubmitEdit?: (values: EditUserFormValues) => void;
}

export function UserFormModal({ open, onOpenChange, isSubmitting, submitError, mode, initialValues, onSubmitCreate, onSubmitEdit }: UserFormModalProps) {
  const { t } = useTranslation(['users', 'common']);

  if (mode === 'create') {
    return (
      <CreateUserForm open={open} onOpenChange={onOpenChange} isSubmitting={isSubmitting} submitError={submitError} onSubmit={onSubmitCreate!} t={t} />
    );
  }
  return (
    <EditUserForm open={open} onOpenChange={onOpenChange} isSubmitting={isSubmitting} submitError={submitError} initialValues={initialValues} onSubmit={onSubmitEdit!} t={t} />
  );
}

function CreateUserForm({ open, onOpenChange, isSubmitting, submitError, onSubmit, t }: any) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateUserFormValues>({ resolver: zodResolver(createUserSchema) });

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('users:form.createTitle')}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label={t('users:fields.name')} htmlFor="name" required error={errors.name && t(`common:${errors.name.message}`)}>
          <TextInput id="name" hasError={!!errors.name} {...register('name')} />
        </FormField>
        <FormField label={t('users:fields.email')} htmlFor="email" required error={errors.email && t(`common:${errors.email.message}`)}>
          <TextInput id="email" type="email" hasError={!!errors.email} {...register('email')} />
        </FormField>
        <FormField label={t('users:fields.password')} htmlFor="password" required error={errors.password && t(`common:${errors.password.message}`)}>
          <TextInput id="password" type="password" hasError={!!errors.password} {...register('password')} />
        </FormField>
        <FormField label={t('users:fields.phone')} htmlFor="phone">
          <TextInput id="phone" {...register('phone')} />
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

function EditUserForm({ open, onOpenChange, isSubmitting, submitError, initialValues, onSubmit, t }: any) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditUserFormValues>({ resolver: zodResolver(editUserSchema) });

  useEffect(() => {
    if (open) {
      reset({
        name: initialValues?.name ?? '',
        phone: initialValues?.phone ?? '',
        status: initialValues?.status,
      });
    }
  }, [open, initialValues, reset]);

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('users:form.editTitle')}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label={t('users:fields.name')} htmlFor="name" required error={errors.name && t(`common:${errors.name.message}`)}>
          <TextInput id="name" hasError={!!errors.name} {...register('name')} />
        </FormField>
        <FormField label={t('users:fields.phone')} htmlFor="phone">
          <TextInput id="phone" {...register('phone')} />
        </FormField>
        <FormField label={t('users:fields.status')} htmlFor="status">
          <select id="status" {...register('status')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            {['active', 'inactive', 'locked'].map((s: string) => (
              <option key={s} value={s}>
                {t(`users:status.${s}`)}
              </option>
            ))}
          </select>
        </FormField>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('common:action.cancel')}
          </button>
          <button type="submit" disabled={isSubmitting} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
            {isSubmitting ? t('common:action.processing') : t('common:action.save')}
          </button>
        </div>
        {submitError && <p className="mt-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{submitError}</p>}
      </form>
    </Modal>
  );
}
