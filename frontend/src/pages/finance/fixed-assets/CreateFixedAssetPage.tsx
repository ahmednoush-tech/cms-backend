import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAccounts } from '../../../api/queries/useFinance';
import { useCreateFixedAsset } from '../../../api/queries/useFixedAssets';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { ApiError } from '../../../api/client';

const createFixedAssetSchema = z.object({
  name: z.string().min(1, 'validation.required'),
  category: z.string().optional(),
  description: z.string().optional(),
  purchaseDate: z.string().min(1, 'validation.required'),
  purchaseCost: z.string().min(1, 'validation.required'),
  salvageValue: z.string().optional(),
  usefulLifeMonths: z.string().min(1, 'validation.required'),
  fixedAssetAccountId: z.string().optional(),
  accumulatedDepreciationAccountId: z.string().optional(),
  depreciationExpenseAccountId: z.string().optional(),
});

type CreateFixedAssetFormValues = z.infer<typeof createFixedAssetSchema>;

export function CreateFixedAssetPage() {
  const { t } = useTranslation(['fixedAssets', 'common']);
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { data: accountsData } = useAccounts({ page: 1, pageSize: 300 });
  const createMutation = useCreateFixedAsset();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateFixedAssetFormValues>({ resolver: zodResolver(createFixedAssetSchema) });

  const accounts = accountsData?.items ?? [];

  const onSubmit = (values: CreateFixedAssetFormValues) => {
    setSubmitError(null);
    createMutation.mutate(
      {
        name: values.name,
        category: values.category || undefined,
        description: values.description || undefined,
        purchaseDate: values.purchaseDate,
        purchaseCost: Number(values.purchaseCost),
        salvageValue: values.salvageValue ? Number(values.salvageValue) : undefined,
        usefulLifeMonths: Number(values.usefulLifeMonths),
        fixedAssetAccountId: values.fixedAssetAccountId || undefined,
        accumulatedDepreciationAccountId: values.accumulatedDepreciationAccountId || undefined,
        depreciationExpenseAccountId: values.depreciationExpenseAccountId || undefined,
      },
      {
        onSuccess: (asset) => navigate(`/finance/fixed-assets/${asset.id}`),
        onError: (err) => setSubmitError(err instanceof ApiError ? err.message : t('common:error.generic')),
      },
    );
  };

  return (
    <div>
      <PageHeader title={t('fixedAssets:form.createTitle')} breadcrumb={t('fixedAssets:title')} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="max-w-2xl rounded-lg border border-border bg-surface p-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('fixedAssets:fields.name')} htmlFor="name" required error={errors.name && t(`common:${errors.name.message}`)}>
            <TextInput id="name" {...register('name')} />
          </FormField>
          <FormField label={t('fixedAssets:fields.category')} htmlFor="category">
            <TextInput id="category" {...register('category')} placeholder={t('fixedAssets:fields.categoryPlaceholder')} />
          </FormField>
        </div>

        <FormField label={t('fixedAssets:fields.description')} htmlFor="description">
          <textarea id="description" {...register('description')} rows={2} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </FormField>

        <div className="grid grid-cols-3 gap-3">
          <FormField label={t('fixedAssets:fields.purchaseDate')} htmlFor="purchaseDate" required error={errors.purchaseDate && t(`common:${errors.purchaseDate.message}`)}>
            <TextInput id="purchaseDate" type="date" {...register('purchaseDate')} />
          </FormField>
          <FormField label={t('fixedAssets:fields.purchaseCost')} htmlFor="purchaseCost" required error={errors.purchaseCost && t(`common:${errors.purchaseCost.message}`)}>
            <TextInput id="purchaseCost" type="number" step="0.01" min="0.01" {...register('purchaseCost')} />
          </FormField>
          <FormField label={t('fixedAssets:fields.salvageValue')} htmlFor="salvageValue">
            <TextInput id="salvageValue" type="number" step="0.01" min="0" {...register('salvageValue')} />
          </FormField>
        </div>

        <FormField label={t('fixedAssets:fields.usefulLifeMonths')} htmlFor="usefulLifeMonths" required error={errors.usefulLifeMonths && t(`common:${errors.usefulLifeMonths.message}`)}>
          <TextInput id="usefulLifeMonths" type="number" min="1" step="1" {...register('usefulLifeMonths')} />
        </FormField>

        <div className="mt-2 border-t border-border pt-3">
          <p className="mb-2 text-sm font-medium text-ink">{t('fixedAssets:form.accountsSection')}</p>
          <p className="mb-3 text-xs text-ink-muted">{t('fixedAssets:form.accountsHint')}</p>
          <div className="grid grid-cols-3 gap-3">
            <FormField label={t('fixedAssets:fields.fixedAssetAccount')} htmlFor="fixedAssetAccountId">
              <select id="fixedAssetAccountId" {...register('fixedAssetAccountId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
                <option value="">—</option>
                {accounts.map((acc) => (<option key={acc.id} value={acc.id}>{acc.code} — {acc.name}</option>))}
              </select>
            </FormField>
            <FormField label={t('fixedAssets:fields.accumulatedDepreciationAccount')} htmlFor="accumulatedDepreciationAccountId">
              <select id="accumulatedDepreciationAccountId" {...register('accumulatedDepreciationAccountId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
                <option value="">—</option>
                {accounts.map((acc) => (<option key={acc.id} value={acc.id}>{acc.code} — {acc.name}</option>))}
              </select>
            </FormField>
            <FormField label={t('fixedAssets:fields.depreciationExpenseAccount')} htmlFor="depreciationExpenseAccountId">
              <select id="depreciationExpenseAccountId" {...register('depreciationExpenseAccountId')} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
                <option value="">—</option>
                {accounts.map((acc) => (<option key={acc.id} value={acc.id}>{acc.code} — {acc.name}</option>))}
              </select>
            </FormField>
          </div>
        </div>

        {submitError && <p className="mt-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{submitError}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => navigate('/finance/fixed-assets')} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('common:action.cancel')}
          </button>
          <button type="submit" disabled={createMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
            {createMutation.isPending ? t('common:action.processing') : t('common:action.create')}
          </button>
        </div>
      </form>
    </div>
  );
}
