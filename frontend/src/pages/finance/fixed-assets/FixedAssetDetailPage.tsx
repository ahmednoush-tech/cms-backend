import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useFixedAsset, useDisposeFixedAsset } from '../../../api/queries/useFixedAssets';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { StatusBadge } from '../../../components/StatusBadge/StatusBadge';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { Modal } from '../../../components/Modal/Modal';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { AttachmentsSection } from '../../../components/AttachmentsSection/AttachmentsSection';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';

export function FixedAssetDetailPage() {
  const { t } = useTranslation(['fixedAssets', 'common']);
  const { id } = useParams<{ id: string }>();
  const { data: asset, isLoading, error } = useFixedAsset(id);
  const disposeMutation = useDisposeFixedAsset(id ?? '');

  const [disposeOpen, setDisposeOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (isLoading) return <LoadingState variant="page" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant={apiError?.status === 404 ? 'not-found' : 'generic'} message={apiError?.message} />;
  }
  if (!asset) return null;

  const netBookValue = (Number(asset.purchaseCost) - Number(asset.accumulatedDepreciation)).toFixed(2);

  const handleDispose = (disposalDate: string, disposalProceeds: string) => {
    setActionError(null);
    disposeMutation.mutate(
      { disposalDate, disposalProceeds: disposalProceeds ? Number(disposalProceeds) : undefined },
      {
        onSuccess: () => setDisposeOpen(false),
        onError: (err) => {
          setActionError(err instanceof ApiError ? err.message : t('common:error.generic'));
          setDisposeOpen(false);
        },
      },
    );
  };

  return (
    <div>
      <PageHeader
        title={asset.name}
        breadcrumb={t('fixedAssets:title')}
        action={<StatusBadge entity="fixedAsset" value={asset.status} />}
      />

      <div className="mb-4 grid grid-cols-2 gap-4 rounded-lg border border-border bg-surface p-4 text-sm md:grid-cols-4">
        <div>
          <p className="text-xs text-ink-muted">{t('fixedAssets:fields.assetNumber')}</p>
          <p className="font-medium text-ink">{asset.assetNumber}</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">{t('fixedAssets:fields.category')}</p>
          <p className="font-medium text-ink">{asset.category ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">{t('fixedAssets:fields.purchaseDate')}</p>
          <p className="font-medium text-ink">{asset.purchaseDate.slice(0, 10)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">{t('fixedAssets:fields.usefulLifeMonths')}</p>
          <p className="font-medium text-ink">{asset.usefulLifeMonths}</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">{t('fixedAssets:fields.purchaseCost')}</p>
          <p className="font-medium text-ink"><FinancialValue value={asset.purchaseCost} /></p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">{t('fixedAssets:fields.salvageValue')}</p>
          <p className="font-medium text-ink"><FinancialValue value={asset.salvageValue} /></p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">{t('fixedAssets:fields.accumulatedDepreciation')}</p>
          <p className="font-medium text-ink"><FinancialValue value={asset.accumulatedDepreciation} /></p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">{t('fixedAssets:fields.netBookValue')}</p>
          <p className="font-semibold text-ink"><FinancialValue value={netBookValue} /></p>
        </div>
      </div>

      {(!asset.fixedAssetAccountId || !asset.accumulatedDepreciationAccountId || !asset.depreciationExpenseAccountId) && asset.status === 'active' && (
        <div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          {t('fixedAssets:detail.accountsIncompleteWarning')}
        </div>
      )}

      <div className="mb-4 rounded-lg border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-medium text-ink">{t('fixedAssets:detail.depreciationHistory')}</p>
        {(asset.depreciationEntries ?? []).length === 0 ? (
          <p className="text-sm text-ink-muted">{t('fixedAssets:detail.noDepreciationYet')}</p>
        ) : (
          <table className="w-full text-start text-sm">
            <thead className="border-b border-border text-xs uppercase text-ink-muted">
              <tr>
                <th className="pb-2 text-start">{t('fixedAssets:detail.date')}</th>
                <th className="pb-2 text-start">{t('fixedAssets:detail.depreciationAmount')}</th>
                <th className="pb-2 text-start">{t('fixedAssets:fields.accumulatedDepreciation')}</th>
                <th className="pb-2 text-start">{t('fixedAssets:fields.netBookValue')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(asset.depreciationEntries ?? []).map((entry) => (
                <tr key={entry.id}>
                  <td className="py-2">{entry.createdAt.slice(0, 10)}</td>
                  <td className="py-2"><FinancialValue value={entry.depreciationAmount} /></td>
                  <td className="py-2"><FinancialValue value={entry.accumulatedDepreciationAfter} /></td>
                  <td className="py-2"><FinancialValue value={entry.netBookValueAfter} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mb-4">
        <AttachmentsSection entityType="fixed_asset" entityId={asset.id} />
      </div>

      {actionError && <p className="mb-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{actionError}</p>}

      {asset.status !== 'disposed' && (
        <PermissionGate requires={PERMISSIONS.Finance.fixedAssets.dispose}>
          <button type="button" onClick={() => setDisposeOpen(true)} className="rounded border border-danger px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10">
            {t('fixedAssets:actions.dispose')}
          </button>
        </PermissionGate>
      )}

      <ModalDisposeForm
        open={disposeOpen}
        onOpenChange={setDisposeOpen}
        netBookValue={netBookValue}
        isSubmitting={disposeMutation.isPending}
        onSubmit={handleDispose}
      />
    </div>
  );
}

interface ModalDisposeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  netBookValue: string;
  isSubmitting: boolean;
  onSubmit: (disposalDate: string, disposalProceeds: string) => void;
}

/**
 * A real form, not a plain confirmation — disposal now posts an
 * actual accounting entry (see backend migration 070), and that
 * entry's gain/loss depends entirely on the date and proceeds
 * entered here.
 */
function ModalDisposeForm({ open, onOpenChange, netBookValue, isSubmitting, onSubmit }: ModalDisposeFormProps) {
  const { t } = useTranslation(['fixedAssets', 'common']);
  const [disposalDate, setDisposalDate] = useState(new Date().toISOString().slice(0, 10));
  const [disposalProceeds, setDisposalProceeds] = useState('0');

  const estimatedGainLoss = (Number(disposalProceeds || 0) - Number(netBookValue)).toFixed(2);
  const isGain = Number(estimatedGainLoss) > 0;
  const isLoss = Number(estimatedGainLoss) < 0;

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t('fixedAssets:confirm.disposeTitle')}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(disposalDate, disposalProceeds);
        }}
        noValidate
      >
        <p className="mb-4 text-sm text-ink-muted">{t('fixedAssets:confirm.disposeMessage')}</p>

        <FormField label={t('fixedAssets:fields.disposalDate')} htmlFor="disposalDate" required>
          <TextInput id="disposalDate" type="date" value={disposalDate} onChange={(e) => setDisposalDate(e.target.value)} required />
        </FormField>

        <FormField label={t('fixedAssets:fields.disposalProceeds')} htmlFor="disposalProceeds" hint={t('fixedAssets:form.disposalProceedsHint')}>
          <TextInput id="disposalProceeds" type="number" min="0" step="0.01" value={disposalProceeds} onChange={(e) => setDisposalProceeds(e.target.value)} />
        </FormField>

        <div className="mb-4 rounded bg-surface-muted px-3 py-2 text-sm">
          <p className="text-ink-muted">{t('fixedAssets:detail.netBookValue')}: <FinancialValue value={netBookValue} /></p>
          {(isGain || isLoss) && (
            <p className={isGain ? 'text-success' : 'text-danger'}>
              {t(isGain ? 'fixedAssets:confirm.estimatedGain' : 'fixedAssets:confirm.estimatedLoss')}: <FinancialValue value={Math.abs(Number(estimatedGainLoss)).toString()} />
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('common:action.cancel')}
          </button>
          <button type="submit" disabled={isSubmitting} className="rounded bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
            {isSubmitting ? t('common:action.processing') : t('fixedAssets:actions.dispose')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
