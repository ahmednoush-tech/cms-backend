import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { useAccounts } from '../../../api/queries/useFinance';
import type { Account } from '../../../types/entities/finance';

const createAccountSchema = z.object({
  code: z.string().min(1, 'validation.required').max(20),
  name: z.string().min(1, 'validation.required').max(200),
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  normalBalance: z.enum(['debit', 'credit']),
  cashFlowCategory: z.enum(['operating', 'investing', 'financing', '']).optional(),
  zakatCategory: z.enum(['long_term_liability', 'fixed_asset', 'long_term_investment', '']).optional(),
  parentId: z.string().uuid('validation.uuid').optional().or(z.literal('')),
  description: z.string().optional(),
});

const editAccountSchema = z.object({
  name: z.string().min(1, 'validation.required').max(200),
  cashFlowCategory: z.enum(['operating', 'investing', 'financing', '']).optional(),
  zakatCategory: z.enum(['long_term_liability', 'fixed_asset', 'long_term_investment', '']).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type CreateAccountFormValues = z.infer<typeof createAccountSchema>;
export type EditAccountFormValues = z.infer<typeof editAccountSchema>;

interface AccountFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  submitError?: string | null;
  mode: 'create' | 'edit';
  initialValues?: Partial<Account>;
  onSubmitCreate?: (values: CreateAccountFormValues) => void;
  onSubmitEdit?: (values: EditAccountFormValues) => void;
}

/**
 * code/type/normalBalance/parentId are only present in the CREATE
 * form — the backend's UpdateAccountDto genuinely doesn't accept
 * them (confirmed against the actual DTO), by deliberate design:
 * changing an account's classification after journal entries have
 * posted against it would silently corrupt historical reports.
 */
export function AccountFormModal({ open, onOpenChange, isSubmitting, submitError, mode, initialValues, onSubmitCreate, onSubmitEdit }: AccountFormModalProps) {
  const { t } = useTranslation(['finance', 'common']);

  if (mode === 'create') {
    return <CreateAccountForm open={open} onOpenChange={onOpenChange} isSubmitting={isSubmitting} submitError={submitError} onSubmit={onSubmitCreate!} t={t} />;
  }
  return <EditAccountForm open={open} onOpenChange={onOpenChange} isSubmitting={isSubmitting} submitError={submitError} initialValues={initialValues} onSubmit={onSubmitEdit!} t={t} />;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CreateAccountForm({ open, onOpenChange, isSubmitting, submitError, onSubmit, t }: any) {
  const { data: accountsData } = useAccounts({ page: 1, pageSize: 500 });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateAccountFormValues>({ resolver: zodResolver(createAccountSchema) });

  return (
    <Modal open={open} onOpenChange={(next: boolean) => { if (!next) reset(); onOpenChange(next); }} title={t('finance:accounts.form.createTitle')}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('finance:accounts.fields.code')} htmlFor="code" required error={errors.code && t(`common:${errors.code.message}`)}>
            <TextInput id="code" hasError={!!errors.code} {...register('code')} />
          </FormField>
          <FormField label={t('finance:accounts.fields.name')} htmlFor="name" required error={errors.name && t(`common:${errors.name.message}`)}>
            <TextInput id="name" hasError={!!errors.name} {...register('name')} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('finance:accounts.fields.type')} htmlFor="type" required>
            <select id="type" {...register('type')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
              {['asset', 'liability', 'equity', 'revenue', 'expense'].map((tpe) => (
                <option key={tpe} value={tpe}>{t(`finance:accounts.type.${tpe}`)}</option>
              ))}
            </select>
          </FormField>
          <FormField label={t('finance:accounts.fields.normalBalance')} htmlFor="normalBalance" required>
            <select id="normalBalance" {...register('normalBalance')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
              <option value="debit">{t('finance:accounts.normalBalance.debit')}</option>
              <option value="credit">{t('finance:accounts.normalBalance.credit')}</option>
            </select>
          </FormField>
        </div>
        <FormField
          label={t('finance:accounts.fields.cashFlowCategory')}
          htmlFor="cashFlowCategory"
          hint={t('finance:accounts.form.cashFlowCategoryHint')}
        >
          <select id="cashFlowCategory" {...register('cashFlowCategory')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">{t('common:action.none')}</option>
            {['operating', 'investing', 'financing'].map((cat) => (
              <option key={cat} value={cat}>{t(`finance:accounts.cashFlowCategory.${cat}`)}</option>
            ))}
          </select>
        </FormField>
        <FormField
          label={t('finance:accounts.fields.zakatCategory')}
          htmlFor="zakatCategory"
          hint={t('finance:accounts.form.zakatCategoryHint')}
        >
          <select id="zakatCategory" {...register('zakatCategory')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">{t('common:action.none')}</option>
            {['long_term_liability', 'fixed_asset', 'long_term_investment'].map((cat) => (
              <option key={cat} value={cat}>{t(`finance:accounts.zakatCategory.${cat}`)}</option>
            ))}
          </select>
        </FormField>
        <FormField
          label={t('finance:accounts.fields.parentId')}
          htmlFor="parentId"
          hint={t('finance:accounts.form.parentIdHint')}
          error={errors.parentId && t(`common:${errors.parentId.message}`)}
        >
          <select id="parentId" {...register('parentId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">—</option>
            {(accountsData?.items ?? []).map((a: Account) => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </select>
        </FormField>
        <FormField label={t('finance:accounts.fields.description')} htmlFor="description">
          <textarea id="description" {...register('description')} rows={2} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EditAccountForm({ open, onOpenChange, isSubmitting, submitError, initialValues, onSubmit, t }: any) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditAccountFormValues>({ resolver: zodResolver(editAccountSchema) });

  useEffect(() => {
    if (open) {
      reset({
        name: initialValues?.name ?? '',
        cashFlowCategory: (initialValues?.cashFlowCategory as 'operating' | 'investing' | 'financing' | undefined) ?? '',
        zakatCategory: (initialValues?.zakatCategory as 'long_term_liability' | 'fixed_asset' | 'long_term_investment' | undefined) ?? '',
        description: initialValues?.description ?? '',
        isActive: initialValues?.isActive ?? true,
      });
    }
  }, [open, initialValues, reset]);

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('finance:accounts.form.editTitle')}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormField label={t('finance:accounts.fields.name')} htmlFor="name" required error={errors.name && t(`common:${errors.name.message}`)}>
          <TextInput id="name" hasError={!!errors.name} {...register('name')} />
        </FormField>
        <FormField
          label={t('finance:accounts.fields.cashFlowCategory')}
          htmlFor="cashFlowCategory"
          hint={t('finance:accounts.form.cashFlowCategoryHint')}
        >
          <select id="cashFlowCategory" {...register('cashFlowCategory')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">{t('common:action.none')}</option>
            {['operating', 'investing', 'financing'].map((cat) => (
              <option key={cat} value={cat}>{t(`finance:accounts.cashFlowCategory.${cat}`)}</option>
            ))}
          </select>
        </FormField>
        <FormField
          label={t('finance:accounts.fields.zakatCategory')}
          htmlFor="zakatCategory"
          hint={t('finance:accounts.form.zakatCategoryHint')}
        >
          <select id="zakatCategory" {...register('zakatCategory')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">{t('common:action.none')}</option>
            {['long_term_liability', 'fixed_asset', 'long_term_investment'].map((cat) => (
              <option key={cat} value={cat}>{t(`finance:accounts.zakatCategory.${cat}`)}</option>
            ))}
          </select>
        </FormField>
        <FormField label={t('finance:accounts.fields.description')} htmlFor="description">
          <textarea id="description" {...register('description')} rows={2} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </FormField>
        <label className="mb-4 flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" {...register('isActive')} />
          {t('finance:accounts.fields.isActive')}
        </label>

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
