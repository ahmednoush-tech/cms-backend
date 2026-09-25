import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { useAccounts } from '../../../api/queries/useFinance';
import type { InventoryItem } from '../../../types/entities/finance';

const createInventoryItemSchema = z.object({
  sku: z.string().min(1, 'validation.required').max(50),
  name: z.string().min(1, 'validation.required').max(200),
  unitOfMeasure: z.string().min(1, 'validation.required'),
  description: z.string().optional(),
  openingQuantity: z.string().optional(),
  openingUnitCost: z.string().optional(),
  inventoryAccountId: z.string().uuid('validation.uuid').optional().or(z.literal('')),
  cogsAccountId: z.string().uuid('validation.uuid').optional().or(z.literal('')),
});

const editInventoryItemSchema = z.object({
  name: z.string().min(1, 'validation.required').max(200),
  unitOfMeasure: z.string().min(1, 'validation.required'),
  description: z.string().optional(),
  inventoryAccountId: z.string().uuid('validation.uuid').optional().or(z.literal('')),
  cogsAccountId: z.string().uuid('validation.uuid').optional().or(z.literal('')),
  isActive: z.boolean().optional(),
});

export type CreateInventoryItemFormValues = z.infer<typeof createInventoryItemSchema>;
export type EditInventoryItemFormValues = z.infer<typeof editInventoryItemSchema>;

interface InventoryItemFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  submitError?: string | null;
  mode: 'create' | 'edit';
  initialValues?: Partial<InventoryItem>;
  onSubmitCreate?: (values: CreateInventoryItemFormValues) => void;
  onSubmitEdit?: (values: EditInventoryItemFormValues) => void;
}

/**
 * sku/openingQuantity/openingUnitCost are only present in the
 * CREATE form — the backend's UpdateInventoryItemDto genuinely
 * doesn't accept them: the SKU is an identity field, and stock/
 * cost must only ever change through a recorded movement
 * (adjustStock, or a sale/purchase), never by direct edit.
 */
export function InventoryItemFormModal({ open, onOpenChange, isSubmitting, submitError, mode, initialValues, onSubmitCreate, onSubmitEdit }: InventoryItemFormModalProps) {
  const { t } = useTranslation(['finance', 'common']);

  if (mode === 'create') {
    return <CreateInventoryItemForm open={open} onOpenChange={onOpenChange} isSubmitting={isSubmitting} submitError={submitError} onSubmit={onSubmitCreate!} t={t} />;
  }
  return <EditInventoryItemForm open={open} onOpenChange={onOpenChange} isSubmitting={isSubmitting} submitError={submitError} initialValues={initialValues} onSubmit={onSubmitEdit!} t={t} />;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CreateInventoryItemForm({ open, onOpenChange, isSubmitting, submitError, onSubmit, t }: any) {
  const { data: accountsData } = useAccounts({ page: 1, pageSize: 300 });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateInventoryItemFormValues>({ resolver: zodResolver(createInventoryItemSchema), defaultValues: { unitOfMeasure: 'unit' } });
  const accounts = accountsData?.items ?? [];

  return (
    <Modal open={open} onOpenChange={(next: boolean) => { if (!next) reset(); onOpenChange(next); }} title={t('finance:inventory.form.createTitle')}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('finance:inventory.fields.sku')} htmlFor="sku" required error={errors.sku && t(`common:${errors.sku.message}`)}>
            <TextInput id="sku" hasError={!!errors.sku} {...register('sku')} />
          </FormField>
          <FormField label={t('finance:inventory.fields.unitOfMeasure')} htmlFor="unitOfMeasure" required>
            <TextInput id="unitOfMeasure" {...register('unitOfMeasure')} />
          </FormField>
        </div>
        <FormField label={t('finance:inventory.fields.name')} htmlFor="name" required error={errors.name && t(`common:${errors.name.message}`)}>
          <TextInput id="name" hasError={!!errors.name} {...register('name')} />
        </FormField>
        <FormField label={t('finance:inventory.fields.description')} htmlFor="description">
          <textarea id="description" {...register('description')} rows={2} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </FormField>

        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-2 text-xs font-medium text-ink-muted">{t('finance:inventory.form.openingStockSection')}</p>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('finance:inventory.fields.openingQuantity')} htmlFor="openingQuantity">
              <TextInput id="openingQuantity" type="number" step="0.001" min="0" {...register('openingQuantity')} />
            </FormField>
            <FormField label={t('finance:inventory.fields.openingUnitCost')} htmlFor="openingUnitCost">
              <TextInput id="openingUnitCost" type="number" step="0.0001" min="0" {...register('openingUnitCost')} />
            </FormField>
          </div>
        </div>

        <div className="mt-3 border-t border-border pt-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('finance:inventory.fields.inventoryAccount')} htmlFor="inventoryAccountId" hint={t('finance:inventory.form.inventoryAccountHint')}>
              <select id="inventoryAccountId" {...register('inventoryAccountId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
                <option value="">{t('common:action.none')}</option>
                {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </FormField>
            <FormField label={t('finance:inventory.fields.cogsAccount')} htmlFor="cogsAccountId" hint={t('finance:inventory.form.cogsAccountHint')}>
              <select id="cogsAccountId" {...register('cogsAccountId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
                <option value="">{t('common:action.none')}</option>
                {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
              </select>
            </FormField>
          </div>
        </div>

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
function EditInventoryItemForm({ open, onOpenChange, isSubmitting, submitError, initialValues, onSubmit, t }: any) {
  const { data: accountsData } = useAccounts({ page: 1, pageSize: 300 });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditInventoryItemFormValues>({ resolver: zodResolver(editInventoryItemSchema) });
  const accounts = accountsData?.items ?? [];

  useEffect(() => {
    if (open) {
      reset({
        name: initialValues?.name ?? '',
        unitOfMeasure: initialValues?.unitOfMeasure ?? 'unit',
        description: initialValues?.description ?? '',
        inventoryAccountId: initialValues?.inventoryAccountId ?? '',
        cogsAccountId: initialValues?.cogsAccountId ?? '',
        isActive: initialValues?.isActive ?? true,
      });
    }
  }, [open, initialValues, reset]);

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('finance:inventory.form.editTitle')}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('finance:inventory.fields.name')} htmlFor="editName" required error={errors.name && t(`common:${errors.name.message}`)}>
            <TextInput id="editName" hasError={!!errors.name} {...register('name')} />
          </FormField>
          <FormField label={t('finance:inventory.fields.unitOfMeasure')} htmlFor="editUnitOfMeasure" required>
            <TextInput id="editUnitOfMeasure" {...register('unitOfMeasure')} />
          </FormField>
        </div>
        <FormField label={t('finance:inventory.fields.description')} htmlFor="editDescription">
          <textarea id="editDescription" {...register('description')} rows={2} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('finance:inventory.fields.inventoryAccount')} htmlFor="editInventoryAccountId" hint={t('finance:inventory.form.inventoryAccountHint')}>
            <select id="editInventoryAccountId" {...register('inventoryAccountId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
              <option value="">{t('common:action.none')}</option>
              {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </FormField>
          <FormField label={t('finance:inventory.fields.cogsAccount')} htmlFor="editCogsAccountId" hint={t('finance:inventory.form.cogsAccountHint')}>
            <select id="editCogsAccountId" {...register('cogsAccountId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
              <option value="">{t('common:action.none')}</option>
              {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </FormField>
        </div>
        <label className="mb-4 flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" {...register('isActive')} />
          {t('finance:inventory.fields.isActive')}
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
