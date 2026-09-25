import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import {
  useBankReconciliation,
  useUnmatchedLedgerLines,
  useAddStatementLine,
  useRemoveStatementLine,
  useMatchLine,
  useUnmatchLine,
  useAutoMatch,
  useCompleteReconciliation,
} from '../../../api/queries/useBankReconciliations';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';

export function BankReconciliationDetailPage() {
  const { t } = useTranslation(['bankReconciliation', 'common']);
  const { id } = useParams<{ id: string }>();

  const { data: recon, isLoading, error } = useBankReconciliation(id);
  const { data: unmatchedLedgerLines } = useUnmatchedLedgerLines(id);

  const addLineMutation = useAddStatementLine(id ?? '');
  const removeLineMutation = useRemoveStatementLine(id ?? '');
  const matchMutation = useMatchLine(id ?? '');
  const unmatchMutation = useUnmatchLine(id ?? '');
  const autoMatchMutation = useAutoMatch(id ?? '');
  const completeMutation = useCompleteReconciliation(id ?? '');

  const [lineForm, setLineForm] = useState({ transactionDate: '', description: '', amount: '' });
  const [matchingStatementLineId, setMatchingStatementLineId] = useState<string | null>(null);
  const [confirmCompleteOpen, setConfirmCompleteOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [autoMatchNotice, setAutoMatchNotice] = useState<string | null>(null);

  if (isLoading) return <LoadingState variant="page" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant={apiError?.status === 404 ? 'not-found' : 'generic'} message={apiError?.message} />;
  }
  if (!recon) return null;

  const isInProgress = recon.status === 'in_progress';
  const handleError = (err: unknown) => setActionError(err instanceof ApiError ? err.message : t('common:error.generic'));

  const handleAddLine = () => {
    setActionError(null);
    addLineMutation.mutate(
      { transactionDate: lineForm.transactionDate, description: lineForm.description, amount: Number(lineForm.amount) },
      { onSuccess: () => setLineForm({ transactionDate: '', description: '', amount: '' }), onError: handleError },
    );
  };

  const handleAutoMatch = () => {
    setActionError(null);
    setAutoMatchNotice(null);
    autoMatchMutation.mutate(undefined, {
      onSuccess: (result) => setAutoMatchNotice(t('bankReconciliation:autoMatch.result', { matched: result.matchedCount, remaining: result.remainingUnmatched })),
      onError: handleError,
    });
  };

  const handleManualMatch = (journalEntryLineId: string) => {
    if (!matchingStatementLineId) return;
    setActionError(null);
    matchMutation.mutate(
      { lineId: matchingStatementLineId, journalEntryLineId },
      { onSuccess: () => setMatchingStatementLineId(null), onError: handleError },
    );
  };

  const handleComplete = () => {
    setActionError(null);
    completeMutation.mutate(undefined, {
      onSuccess: () => setConfirmCompleteOpen(false),
      onError: (err) => {
        handleError(err);
        setConfirmCompleteOpen(false);
      },
    });
  };

  const unmatchedStatementCount = (recon.statementLines ?? []).filter((l) => !l.matchedJournalEntryLineId).length;

  return (
    <div>
      <PageHeader
        title={`${recon.bankAccount?.code} — ${recon.bankAccount?.name}`}
        breadcrumb={t('bankReconciliation:title')}
        action={
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${recon.status === 'completed' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
            {t(`bankReconciliation:status.${recon.status}`)}
          </span>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 rounded-lg border border-border bg-surface p-4 text-sm md:grid-cols-4">
        <div>
          <p className="text-xs text-ink-muted">{t('bankReconciliation:fields.statementDate')}</p>
          <p className="font-medium text-ink">{recon.statementDate.slice(0, 10)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">{t('bankReconciliation:fields.statementEndingBalance')}</p>
          <p className="font-medium text-ink"><FinancialValue value={recon.statementEndingBalance} /></p>
        </div>
        {recon.bookBalance !== null && (
          <div>
            <p className="text-xs text-ink-muted">{t('bankReconciliation:fields.bookBalance')}</p>
            <p className="font-medium text-ink"><FinancialValue value={recon.bookBalance} /></p>
          </div>
        )}
        <div>
          <p className="text-xs text-ink-muted">{t('bankReconciliation:unmatchedCount')}</p>
          <p className="font-medium text-ink">{unmatchedStatementCount}</p>
        </div>
      </div>

      {actionError && <p className="mb-4 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{actionError}</p>}
      {autoMatchNotice && <p className="mb-4 rounded bg-info/10 px-3 py-2 text-sm text-info">{autoMatchNotice}</p>}

      <div className="mb-4 rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-ink">{t('bankReconciliation:statementLines.title')}</p>
          {isInProgress && (
            <PermissionGate requires={PERMISSIONS.Finance.bankReconciliation.create}>
              <button type="button" onClick={handleAutoMatch} disabled={autoMatchMutation.isPending} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-50">
                {autoMatchMutation.isPending ? t('common:action.processing') : t('bankReconciliation:actions.autoMatch')}
              </button>
            </PermissionGate>
          )}
        </div>

        <table className="w-full text-start text-sm">
          <thead className="border-b border-border text-xs uppercase text-ink-muted">
            <tr>
              <th className="pb-2 text-start">{t('bankReconciliation:statementLines.date')}</th>
              <th className="pb-2 text-start">{t('bankReconciliation:statementLines.description')}</th>
              <th className="pb-2 text-start">{t('bankReconciliation:statementLines.amount')}</th>
              <th className="pb-2 text-start">{t('bankReconciliation:statementLines.matchStatus')}</th>
              {isInProgress && <th className="pb-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(recon.statementLines ?? []).map((line) => (
              <tr key={line.id}>
                <td className="py-2">{line.transactionDate.slice(0, 10)}</td>
                <td className="py-2">{line.description}</td>
                <td className="py-2"><FinancialValue value={line.amount} /></td>
                <td className="py-2">
                  {line.matchedJournalEntryLineId ? (
                    <span className="text-xs font-medium text-success">{t('bankReconciliation:statementLines.matched')}</span>
                  ) : (
                    <span className="text-xs font-medium text-warning">{t('bankReconciliation:statementLines.unmatched')}</span>
                  )}
                </td>
                {isInProgress && (
                  <td className="py-2">
                    <div className="flex gap-2">
                      {line.matchedJournalEntryLineId ? (
                        <button type="button" onClick={() => unmatchMutation.mutate(line.id, { onError: handleError })} className="text-xs font-medium text-ink hover:underline">
                          {t('bankReconciliation:actions.unmatch')}
                        </button>
                      ) : (
                        <button type="button" onClick={() => setMatchingStatementLineId(line.id)} className="text-xs font-medium text-primary hover:underline">
                          {t('bankReconciliation:actions.match')}
                        </button>
                      )}
                      <button type="button" onClick={() => removeLineMutation.mutate(line.id, { onError: handleError })} className="text-xs font-medium text-danger hover:underline">
                        {t('common:action.delete')}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {isInProgress && (
          <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
            <input type="date" value={lineForm.transactionDate} onChange={(e) => setLineForm({ ...lineForm, transactionDate: e.target.value })} className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink" />
            <input placeholder={t('bankReconciliation:statementLines.description')} value={lineForm.description} onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })} className="flex-1 rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink" />
            <input type="number" step="0.01" placeholder={t('bankReconciliation:statementLines.amount')} value={lineForm.amount} onChange={(e) => setLineForm({ ...lineForm, amount: e.target.value })} className="w-32 rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink" />
            <button type="button" onClick={handleAddLine} disabled={!lineForm.transactionDate || !lineForm.description || !lineForm.amount || addLineMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
              {t('bankReconciliation:statementLines.add')}
            </button>
          </div>
        )}
      </div>

      {matchingStatementLineId && (
        <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="mb-3 text-sm font-medium text-ink">{t('bankReconciliation:unmatchedLedgerLines.selectPrompt')}</p>
          <table className="w-full text-start text-sm">
            <thead className="border-b border-border text-xs uppercase text-ink-muted">
              <tr>
                <th className="pb-2 text-start">{t('bankReconciliation:statementLines.date')}</th>
                <th className="pb-2 text-start">{t('bankReconciliation:unmatchedLedgerLines.entryNumber')}</th>
                <th className="pb-2 text-start">{t('bankReconciliation:unmatchedLedgerLines.description')}</th>
                <th className="pb-2 text-start">{t('bankReconciliation:statementLines.amount')}</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(unmatchedLedgerLines ?? []).map((led) => (
                <tr key={led.id}>
                  <td className="py-2">{led.journalEntry.entryDate.slice(0, 10)}</td>
                  <td className="py-2">{led.journalEntry.entryNumber}</td>
                  <td className="py-2">{led.description ?? led.journalEntry.description ?? '—'}</td>
                  <td className="py-2"><FinancialValue value={(Number(led.debit) - Number(led.credit)).toFixed(2)} /></td>
                  <td className="py-2">
                    <button type="button" onClick={() => handleManualMatch(led.id)} className="text-xs font-medium text-primary hover:underline">
                      {t('bankReconciliation:actions.select')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={() => setMatchingStatementLineId(null)} className="mt-3 text-xs font-medium text-ink-muted hover:underline">
            {t('common:action.cancel')}
          </button>
        </div>
      )}

      {isInProgress && (
        <PermissionGate requires={PERMISSIONS.Finance.bankReconciliation.complete}>
          <button type="button" onClick={() => setConfirmCompleteOpen(true)} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
            {t('bankReconciliation:actions.complete')}
          </button>
        </PermissionGate>
      )}

      <ConfirmDialog
        open={confirmCompleteOpen}
        onOpenChange={setConfirmCompleteOpen}
        title={t('bankReconciliation:confirm.completeTitle')}
        message={t('bankReconciliation:confirm.completeMessage')}
        onConfirm={handleComplete}
        isLoading={completeMutation.isPending}
      />
    </div>
  );
}
