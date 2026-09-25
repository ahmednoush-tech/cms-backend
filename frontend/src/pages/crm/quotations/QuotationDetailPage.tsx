import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompanyInfo } from '../../../api/queries/useCompanySettings';
import { useParams } from 'react-router-dom';
import {
  useQuotation,
  useSendQuotation,
  useAcceptQuotation,
  useRejectQuotation,
  useExpireQuotation,
  useAddQuotationItem,
  useDeleteQuotationItem,
} from '../../../api/queries/useQuotations';
import { useStockItems } from '../../../api/queries/useStockInventory';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { StatusBadge } from '../../../components/StatusBadge/StatusBadge';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { AttachmentsSection } from '../../../components/AttachmentsSection/AttachmentsSection';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { QUOTATION_TRANSITIONS } from '../../../lib/workflowTransitions';
import { generateQuotationPdf } from '../../../lib/generateQuotationPdf';
import { generateQuotationPdfArabic } from '../../../lib/generateQuotationPdfArabic';
import { ShareQuotationModal } from './ShareQuotationModal';
import { ApiError } from '../../../api/client';

/**
 * Line items are mutable only while status === 'draft' (backend
 * rule, confirmed this session — 422 otherwise). The Add-item
 * form and every item's delete button are only rendered when
 * draft, matching the transition map's single 'draft' -> 'sent'
 * edge — the same "hide, don't disable" philosophy as everywhere
 * else in this app.
 */
export function QuotationDetailPage() {
  const { t } = useTranslation(['quotations', 'common']);
  const { data: company } = useCompanyInfo();
  const { id } = useParams<{ id: string }>();
  const [confirmAction, setConfirmAction] = useState<'send' | 'accept' | 'reject' | 'expire' | null>(null);
  const [itemForm, setItemForm] = useState({ description: '', quantity: '1', unitPrice: '0', discount: '0', tax: '0', stockItemId: '' });
  const [shareModalOpen, setShareModalOpen] = useState(false);

  const { data: quotation, isLoading, error } = useQuotation(id);
  const sendMutation = useSendQuotation(id!);
  const acceptMutation = useAcceptQuotation(id!);
  const rejectMutation = useRejectQuotation(id!);
  const expireMutation = useExpireQuotation(id!);
  const addItemMutation = useAddQuotationItem(id!);
  const deleteItemMutation = useDeleteQuotationItem(id!);
  const { data: stockItems } = useStockItems();
  const activeStockItems = (stockItems ?? []).filter((i) => i.isActive);

  if (isLoading) return <LoadingState variant="card" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant={apiError?.status === 404 ? 'not-found' : 'generic'} message={apiError?.message} />;
  }
  if (!quotation) return null;

  const isDraft = quotation.status === 'draft';
  const nextStates = QUOTATION_TRANSITIONS[quotation.status] ?? [];

  const actionMap: Record<string, { mutation: typeof sendMutation; permission: string; labelKey: string }> = {
    sent: { mutation: sendMutation, permission: 'CRM:quotations:send', labelKey: 'quotations:detail.send' },
    accepted: { mutation: acceptMutation, permission: 'CRM:quotations:accept', labelKey: 'quotations:detail.accept' },
    rejected: { mutation: rejectMutation, permission: 'CRM:quotations:reject', labelKey: 'quotations:detail.reject' },
    expired: { mutation: expireMutation, permission: 'CRM:quotations:edit', labelKey: 'quotations:detail.expire' },
  };

  function runAction(action: 'send' | 'accept' | 'reject' | 'expire') {
    const mutation = { send: sendMutation, accept: acceptMutation, reject: rejectMutation, expire: expireMutation }[action];
    mutation.mutate(undefined, { onSuccess: () => setConfirmAction(null) });
  }

  return (
    <div>
      <PageHeader
        title={quotation.quotationNumber}
        breadcrumb={t('quotations:title')}
        action={
          <div className="flex gap-2">
            {!isDraft && (
              <button
                type="button"
                onClick={() => setShareModalOpen(true)}
                className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
              >
                {t('quotations:detail.share')}
              </button>
            )}
            <button
              type="button"
              onClick={() => company && generateQuotationPdf(quotation, company)}
              disabled={!company}
              className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
            >
              {t('quotations:detail.exportPdf')}
            </button>
            <button
              type="button"
              onClick={() => company && generateQuotationPdfArabic(quotation, company)}
              disabled={!company}
              className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
            >
              {t('quotations:detail.exportPdfArabic')}
            </button>
          </div>
        }
      />

      <ShareQuotationModal open={shareModalOpen} onOpenChange={setShareModalOpen} publicToken={quotation.publicToken} />

      <div className="mb-4 flex items-center gap-3">
        <StatusBadge entity="quotation" value={quotation.status} />
        {quotation.validUntil && (
          <span className="text-xs text-ink-muted">{t('quotations:detail.validUntil', { date: quotation.validUntil.slice(0, 10) })}</span>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {nextStates.map((next) => {
          const action = actionMap[next];
          if (!action) return null;
          return (
            <PermissionGate key={next} requires={action.permission}>
              <button
                type="button"
                onClick={() => setConfirmAction(next as 'send' | 'accept' | 'reject' | 'expire')}
                className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
              >
                {t(action.labelKey)}
              </button>
            </PermissionGate>
          );
        })}
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-medium text-ink">{t('quotations:detail.items')}</p>

        {(!quotation.items || quotation.items.length === 0) ? (
          <EmptyState title={t('quotations:detail.noItems')} />
        ) : (
          <table className="mb-3 w-full text-start text-sm">
            <thead className="text-xs uppercase text-ink-muted">
              <tr>
                <th className="pb-2 text-start">{t('quotations:detail.description')}</th>
                <th className="pb-2 text-start">{t('quotations:detail.quantity')}</th>
                <th className="pb-2 text-start">{t('quotations:detail.unitPrice')}</th>
                <th className="pb-2 text-start">{t('quotations:detail.lineTotal')}</th>
                {isDraft && <th className="pb-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {quotation.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-1.5 text-ink">{item.description}</td>
                  <td className="py-1.5 text-ink-muted">{item.quantity}</td>
                  <td className="py-1.5 text-ink-muted">
                    <FinancialValue value={item.unitPrice} />
                  </td>
                  <td className="py-1.5 font-medium text-ink">
                    <FinancialValue value={item.total} />
                  </td>
                  {isDraft && (
                    <td className="py-1.5 text-end">
                      <PermissionGate requires="CRM:quotations:edit">
                        <button
                          type="button"
                          onClick={() => deleteItemMutation.mutate(item.id)}
                          className="text-xs font-medium text-danger hover:underline"
                        >
                          {t('common:action.delete')}
                        </button>
                      </PermissionGate>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {isDraft && (
          <PermissionGate requires="CRM:quotations:edit">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!itemForm.description.trim()) return;
                addItemMutation.mutate(
                  {
                    description: itemForm.description,
                    quantity: Number(itemForm.quantity),
                    unitPrice: Number(itemForm.unitPrice),
                    discount: Number(itemForm.discount),
                    tax: Number(itemForm.tax),
                    stockItemId: itemForm.stockItemId || undefined,
                  },
                  { onSuccess: () => setItemForm({ description: '', quantity: '1', unitPrice: '0', discount: '0', tax: '0', stockItemId: '' }) },
                );
              }}
              className="flex flex-wrap items-end gap-2 border-t border-border pt-3"
            >
              <input
                value={itemForm.description}
                onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t('quotations:detail.description')}
                className="min-w-[160px] flex-1 rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink"
              />
              <input
                value={itemForm.quantity}
                onChange={(e) => setItemForm((f) => ({ ...f, quantity: e.target.value }))}
                type="number"
                step="0.01"
                min="0.01"
                placeholder={t('quotations:detail.quantity')}
                className="w-20 rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink"
              />
              <input
                value={itemForm.unitPrice}
                onChange={(e) => setItemForm((f) => ({ ...f, unitPrice: e.target.value }))}
                type="number"
                step="0.01"
                min="0"
                placeholder={t('quotations:detail.unitPrice')}
                className="w-24 rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink"
              />
              <select
                value={itemForm.stockItemId}
                onChange={(e) => setItemForm((f) => ({ ...f, stockItemId: e.target.value }))}
                className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink"
              >
                <option value="">{t('quotations:detail.stockItem')}</option>
                {activeStockItems.map((si) => (
                  <option key={si.id} value={si.id}>{si.sku} — {si.name}</option>
                ))}
              </select>
              <button type="submit" disabled={addItemMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
                {t('quotations:detail.addItem')}
              </button>
            </form>
          </PermissionGate>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-4">
        {quotation.currencyCode !== 'SAR' && (
          <div className="col-span-2 rounded bg-info/10 px-3 py-2 text-xs text-info sm:col-span-4">
            {t('quotations:detail.foreignCurrencyNote', {
              currency: quotation.currencyCode,
              rate: quotation.exchangeRateToBase,
              sarEquivalent: (Number(quotation.total) * Number(quotation.exchangeRateToBase)).toFixed(2),
            })}
          </div>
        )}
        <TotalField label={t('quotations:detail.subtotal')} value={quotation.subtotal} />
        <TotalField label={t('quotations:detail.discount')} value={quotation.discount} />
        <TotalField label={t('quotations:detail.tax')} value={quotation.tax} />
        <TotalField label={t('quotations:detail.total')} value={quotation.total} emphasize />
      </div>

      <div className="mt-4">
        <AttachmentsSection entityType="quotation" entityId={quotation.id} />
      </div>

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={t('quotations:detail.actionConfirmTitle')}
        message={confirmAction ? t(`quotations:detail.actionConfirmMessage.${confirmAction}`) : ''}
        isLoading={
          sendMutation.isPending || acceptMutation.isPending || rejectMutation.isPending || expireMutation.isPending
        }
        onConfirm={() => confirmAction && runAction(confirmAction)}
      />
    </div>
  );
}

function TotalField({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={emphasize ? 'text-lg font-semibold text-ink' : 'text-sm text-ink'}>
        <FinancialValue value={value} />
      </p>
    </div>
  );
}
