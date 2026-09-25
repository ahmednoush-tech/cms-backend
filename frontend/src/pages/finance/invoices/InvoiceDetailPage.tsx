import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  useInvoice,
  useIssueInvoice,
  useCancelInvoice,
  useDeleteInvoice,
  useCreatePayment,
  useZatcaQrCode,
  useInvoiceNotesForInvoice,
  useIssueInvoiceNote,
  useCancelInvoiceNote,
} from '../../../api/queries/useFinance';
import { generateInvoicePdf } from '../../../lib/generateInvoicePdf';
import { generateInvoicePdfArabic } from '../../../lib/generateInvoicePdfArabic';
import { useCompanyInfo } from '../../../api/queries/useCompanySettings';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { StatusBadge } from '../../../components/StatusBadge/StatusBadge';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { AttachmentsSection } from '../../../components/AttachmentsSection/AttachmentsSection';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { RecordPaymentModal, type PaymentFormValues } from './RecordPaymentModal';
import { CreateInvoiceNoteModal } from './notes/CreateInvoiceNoteModal';
import { EditInvoiceModal } from './EditInvoiceModal';
import { ApiError } from '../../../api/client';

export function InvoiceDetailPage() {
  const { t } = useTranslation(['finance', 'common']);
  const { data: company } = useCompanyInfo();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [confirmIssue, setConfirmIssue] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteActionError, setNoteActionError] = useState<string | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const { data: invoice, isLoading, error } = useInvoice(id);
  const issueMutation = useIssueInvoice(id!);
  const cancelMutation = useCancelInvoice(id!);
  const deleteMutation = useDeleteInvoice();
  const paymentMutation = useCreatePayment();
  const isIssued = !!invoice && invoice.status !== 'draft';
  const { data: zatcaQr } = useZatcaQrCode(id, isIssued);
  const { data: notes } = useInvoiceNotesForInvoice(isIssued ? id : undefined);
  const issueNoteMutation = useIssueInvoiceNote(id!);
  const cancelNoteMutation = useCancelInvoiceNote(id!);

  useEffect(() => {
    if (zatcaQr && qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, zatcaQr, { margin: 1, width: 140 }).catch(() => {
        // A failed QR render here is a display-only concern — the
        // PDF export path (generateInvoicePdf) independently
        // re-renders the QR itself and surfaces its own error, so
        // this preview failing silently doesn't hide a compliance
        // problem, just a rendering one.
      });
    }
  }, [zatcaQr]);

  if (isLoading) return <LoadingState variant="card" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant={apiError?.status === 404 ? 'not-found' : 'generic'} message={apiError?.message} />;
  }
  if (!invoice) return null;

  const remaining = (Number(invoice.total) - Number(invoice.amountPaid)).toFixed(2);
  const canIssue = invoice.status === 'draft';
  const canCancel = invoice.status === 'draft';
  const canRecordPayment = ['sent', 'partially_paid', 'overdue'].includes(invoice.status);

  return (
    <div>
      <PageHeader
        title={invoice.invoiceNumber}
        breadcrumb={t('finance:invoices.title')}
        action={
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pdfGenerating || !company}
              onClick={async () => {
                if (!company) return;
                setPdfError(null);
                setPdfGenerating(true);
                try {
                  await generateInvoicePdf(invoice, zatcaQr ?? null, company);
                } catch (err) {
                  setPdfError(err instanceof Error ? err.message : t('common:error.generic'));
                } finally {
                  setPdfGenerating(false);
                }
              }}
              className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-50"
            >
              {pdfGenerating ? t('common:action.processing') : t('finance:invoices.detail.exportPdf')}
            </button>
            <button
              type="button"
              disabled={pdfGenerating || !company}
              onClick={async () => {
                if (!company) return;
                setPdfError(null);
                setPdfGenerating(true);
                try {
                  await generateInvoicePdfArabic(invoice, zatcaQr ?? null, company);
                } catch (err) {
                  setPdfError(err instanceof Error ? err.message : t('common:error.generic'));
                } finally {
                  setPdfGenerating(false);
                }
              }}
              className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-50"
            >
              {pdfGenerating ? t('common:action.processing') : t('finance:invoices.detail.exportPdfArabic')}
            </button>
          </div>
        }
      />
      {pdfError && <p className="mb-4 text-sm text-danger" role="alert">{pdfError}</p>}

      <div className="mb-4 flex items-center gap-3">
        <StatusBadge entity="invoice" value={invoice.status} />
        <span className="text-xs text-ink-muted">{invoice.issueDate.slice(0, 10)}</span>
        {invoice.dueDate && <span className="text-xs text-ink-muted">— {t('finance:invoices.fields.dueDate')}: {invoice.dueDate.slice(0, 10)}</span>}
      </div>

      <dl className="mb-4 grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t('finance:invoices.fields.customer')}</dt>
          <dd className="mt-0.5 text-sm text-ink">{invoice.customer?.companyName ?? invoice.customer?.customerCode ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t('finance:invoices.detail.amountPaid')}</dt>
          <dd className="mt-0.5 text-sm text-ink"><FinancialValue value={invoice.amountPaid} /></dd>
        </div>
      </dl>

      <table className="w-full text-start text-sm">
        <thead className="border-b border-border text-xs uppercase text-ink-muted">
          <tr>
            <th className="pb-2 text-start">{t('finance:invoices.fields.description')}</th>
            <th className="pb-2 text-start">{t('finance:invoices.fields.quantity')}</th>
            <th className="pb-2 text-start">{t('finance:invoices.fields.unitPrice')}</th>
            <th className="pb-2 text-start">{t('finance:invoices.fields.total')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {(invoice.items ?? []).map((item) => (
            <tr key={item.id}>
              <td className="py-2">{item.description}</td>
              <td className="py-2">{item.quantity}</td>
              <td className="py-2"><FinancialValue value={item.unitPrice} /></td>
              <td className="py-2"><FinancialValue value={item.total} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <div className="w-64 space-y-1 text-sm">
          {invoice.currencyCode !== 'SAR' && (
            <div className="mb-2 rounded bg-info/10 px-3 py-2 text-xs text-info">
              {t('finance:invoices.detail.foreignCurrencyNote', {
                currency: invoice.currencyCode,
                rate: invoice.exchangeRateToBase,
                sarEquivalent: (Number(invoice.total) * Number(invoice.exchangeRateToBase)).toFixed(2),
              })}
            </div>
          )}
          <div className="flex justify-between"><span className="text-ink-muted">{t('finance:invoices.fields.subtotal')}</span><FinancialValue value={invoice.subtotal} /></div>
          <div className="flex justify-between"><span className="text-ink-muted">{t('finance:invoices.fields.discount')}</span><FinancialValue value={invoice.discount} /></div>
          <div className="flex justify-between"><span className="text-ink-muted">{t('finance:invoices.fields.tax')}</span><FinancialValue value={invoice.tax} /></div>
          <div className="flex justify-between border-t border-border pt-1 font-medium text-ink"><span>{t('finance:invoices.fields.total')}</span><FinancialValue value={invoice.total} /></div>
        </div>
      </div>

      {isIssued && (
        <div className="mt-6 flex items-start gap-4 rounded-lg border border-border bg-surface p-4">
          <canvas ref={qrCanvasRef} />
          <div>
            <p className="mb-1 text-sm font-medium text-ink">{t('finance:invoices.detail.zatcaQrTitle')}</p>
            <p className="text-xs text-ink-muted">{t('finance:invoices.detail.zatcaQrHint')}</p>
          </div>
        </div>
      )}

      {isIssued && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-ink">{t('finance:invoiceNotes.title')}</p>
            <PermissionGate requires={PERMISSIONS.Finance.invoiceNotes.create}>
              <button type="button" onClick={() => { setNoteActionError(null); setNoteModalOpen(true); }} className="text-xs font-medium text-primary hover:underline">
                {t('finance:invoiceNotes.action.create')}
              </button>
            </PermissionGate>
          </div>

          {(notes ?? []).length === 0 ? (
            <p className="text-sm text-ink-muted">{t('finance:invoiceNotes.empty')}</p>
          ) : (
            <table className="w-full text-start text-sm">
              <thead className="border-b border-border text-xs uppercase text-ink-muted">
                <tr>
                  <th className="pb-2 text-start">{t('finance:invoiceNotes.columns.noteNumber')}</th>
                  <th className="pb-2 text-start">{t('finance:invoiceNotes.columns.type')}</th>
                  <th className="pb-2 text-start">{t('finance:invoiceNotes.columns.total')}</th>
                  <th className="pb-2 text-start">{t('finance:invoiceNotes.columns.status')}</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(notes ?? []).map((note) => (
                  <tr key={note.id}>
                    <td className="py-2">{note.noteNumber}</td>
                    <td className="py-2">{note.noteType === 'credit' ? t('finance:invoiceNotes.type.credit') : t('finance:invoiceNotes.type.debit')}</td>
                    <td className="py-2"><FinancialValue value={note.total} /></td>
                    <td className="py-2"><StatusBadge entity="invoiceNote" value={note.status} /></td>
                    <td className="py-2">
                      {note.status === 'draft' && (
                        <PermissionGate requires={PERMISSIONS.Finance.invoiceNotes.issue}>
                          <button
                            type="button"
                            onClick={() => issueNoteMutation.mutate(note.id, { onError: (err) => setNoteActionError(err instanceof ApiError ? err.message : t('common:error.generic')) })}
                            className="me-3 text-xs font-medium text-primary hover:underline"
                          >
                            {t('finance:invoiceNotes.action.issue')}
                          </button>
                          <button
                            type="button"
                            onClick={() => cancelNoteMutation.mutate(note.id, { onError: (err) => setNoteActionError(err instanceof ApiError ? err.message : t('common:error.generic')) })}
                            className="text-xs font-medium text-danger hover:underline"
                          >
                            {t('common:action.cancel')}
                          </button>
                        </PermissionGate>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {noteActionError && <p className="mt-2 text-sm text-danger" role="alert">{noteActionError}</p>}
        </div>
      )}

      {(invoice.payments ?? []).length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-ink">{t('finance:invoices.detail.paymentHistory')}</p>
          <table className="w-full text-start text-sm">
            <thead className="border-b border-border text-xs uppercase text-ink-muted">
              <tr>
                <th className="pb-2 text-start">{t('finance:invoices.fields.paymentDate')}</th>
                <th className="pb-2 text-start">{t('finance:invoices.fields.amount')}</th>
                <th className="pb-2 text-start">{t('finance:invoices.fields.method')}</th>
                <th className="pb-2 text-start">{t('finance:invoices.fields.reference')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoice.payments!.map((p) => (
                <tr key={p.id}>
                  <td className="py-2">{p.paymentDate.slice(0, 10)}</td>
                  <td className="py-2"><FinancialValue value={p.amount} /></td>
                  <td className="py-2">{t(`finance:invoices.paymentMethod.${p.method}`)}</td>
                  <td className="py-2 text-ink-muted">{p.reference ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {canIssue && (
          <PermissionGate requires={PERMISSIONS.Finance.invoices.issue}>
            <button type="button" onClick={() => { setActionError(null); setConfirmIssue(true); }} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('finance:invoices.detail.issue')}
            </button>
          </PermissionGate>
        )}
        {canCancel && (
          <PermissionGate requires={PERMISSIONS.Finance.invoices.edit}>
            <button type="button" onClick={() => { setActionError(null); setConfirmCancel(true); }} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('finance:invoices.detail.cancel')}
            </button>
          </PermissionGate>
        )}
        {invoice.status === 'draft' && (
          <PermissionGate requires={PERMISSIONS.Finance.invoices.edit}>
            <button type="button" onClick={() => { setActionError(null); setEditModalOpen(true); }} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('common:action.edit')}
            </button>
          </PermissionGate>
        )}
        {invoice.status === 'draft' && (
          <PermissionGate requires={PERMISSIONS.Finance.invoices.delete}>
            <button type="button" onClick={() => { setActionError(null); setConfirmDelete(true); }} className="rounded border border-danger/40 px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger/10">
              {t('common:action.delete')}
            </button>
          </PermissionGate>
        )}
        {canRecordPayment && (
          <PermissionGate requires={PERMISSIONS.Finance.payments.create}>
            <button type="button" onClick={() => { setPaymentError(null); setPaymentModalOpen(true); }} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
              {t('finance:invoices.detail.recordPayment')}
            </button>
          </PermissionGate>
        )}
      </div>
      {actionError && <p className="mt-2 text-sm text-danger" role="alert">{actionError}</p>}

      <div className="mt-4">
        <AttachmentsSection entityType="invoice" entityId={invoice.id} />
      </div>

      <ConfirmDialog
        open={confirmIssue}
        onOpenChange={setConfirmIssue}
        title={t('finance:invoices.detail.issueConfirmTitle')}
        message={t('finance:invoices.detail.issueConfirmMessage')}
        isLoading={issueMutation.isPending}
        onConfirm={() =>
          issueMutation.mutate(undefined, {
            onSuccess: () => setConfirmIssue(false),
            onError: (err) => { setConfirmIssue(false); setActionError(err instanceof ApiError ? err.message : t('common:error.generic')); },
          })
        }
      />
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t('finance:invoices.detail.cancelConfirmTitle')}
        message={t('finance:invoices.detail.cancelConfirmMessage')}
        variant="destructive"
        isLoading={cancelMutation.isPending}
        onConfirm={() =>
          cancelMutation.mutate(undefined, {
            onSuccess: () => setConfirmCancel(false),
            onError: (err) => { setConfirmCancel(false); setActionError(err instanceof ApiError ? err.message : t('common:error.generic')); },
          })
        }
      />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('finance:invoices.detail.deleteConfirmTitle')}
        message={t('finance:invoices.detail.deleteConfirmMessage')}
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate(invoice.id, {
            onSuccess: () => navigate('/finance/invoices'),
            onError: (err) => { setConfirmDelete(false); setActionError(err instanceof ApiError ? err.message : t('common:error.generic')); },
          })
        }
      />
      {invoice.status === 'draft' && (
        <EditInvoiceModal open={editModalOpen} onOpenChange={setEditModalOpen} invoice={invoice} />
      )}
      <RecordPaymentModal
        open={paymentModalOpen}
        onOpenChange={setPaymentModalOpen}
        isSubmitting={paymentMutation.isPending}
        submitError={paymentError}
        remainingBalance={remaining}
        invoiceCurrencyCode={invoice.currencyCode}
        onSubmit={(values: PaymentFormValues) => {
          setPaymentError(null);
          paymentMutation.mutate(
            {
              invoiceId: invoice.id,
              amount: Number(values.amount),
              paymentDate: values.paymentDate,
              method: values.method,
              reference: values.reference || undefined,
              exchangeRateToBase: invoice.currencyCode !== 'SAR' && values.exchangeRateToBase ? Number(values.exchangeRateToBase) : undefined,
            },
            {
              onSuccess: () => setPaymentModalOpen(false),
              onError: (err) => setPaymentError(err instanceof ApiError ? err.message : t('common:error.generic')),
            },
          );
        }}
      />
      <CreateInvoiceNoteModal open={noteModalOpen} onOpenChange={setNoteModalOpen} invoiceId={invoice.id} />
    </div>
  );
}
