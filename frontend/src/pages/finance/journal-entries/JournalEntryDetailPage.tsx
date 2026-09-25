import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useJournalEntry, usePostJournalEntry, useVoidJournalEntry } from '../../../api/queries/useFinance';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { StatusBadge } from '../../../components/StatusBadge/StatusBadge';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { ConfirmDialog } from '../../../components/ConfirmDialog/ConfirmDialog';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { JOURNAL_ENTRY_TRANSITIONS, getNextStates } from '../../../lib/workflowTransitions';
import { ApiError } from '../../../api/client';

export function JournalEntryDetailPage() {
  const { t } = useTranslation(['finance', 'common']);
  const { id } = useParams<{ id: string }>();
  const [confirmAction, setConfirmAction] = useState<'posted' | 'void' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: entry, isLoading, error } = useJournalEntry(id);
  const postMutation = usePostJournalEntry(id!);
  const voidMutation = useVoidJournalEntry(id!);

  if (isLoading) return <LoadingState variant="card" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant={apiError?.status === 404 ? 'not-found' : 'generic'} message={apiError?.message} />;
  }
  if (!entry) return null;

  const nextStates = getNextStates(JOURNAL_ENTRY_TRANSITIONS, entry.status);
  const totalDebit = (entry.lines ?? []).reduce((sum, l) => sum + Number(l.debit), 0);
  const totalCredit = (entry.lines ?? []).reduce((sum, l) => sum + Number(l.credit), 0);

  return (
    <div>
      <PageHeader title={entry.entryNumber} breadcrumb={t('finance:journalEntries.title')} />

      <div className="mb-4 flex items-center gap-3">
        <StatusBadge entity="journalEntry" value={entry.status} />
        <span className="text-xs text-ink-muted">{entry.entryDate.slice(0, 10)}</span>
        {entry.reference && <span className="text-xs text-ink-muted">— {entry.reference}</span>}
      </div>

      {entry.description && <p className="mb-4 text-sm text-ink-muted">{entry.description}</p>}

      <table className="w-full text-start text-sm">
        <thead className="border-b border-border text-xs uppercase text-ink-muted">
          <tr>
            <th className="pb-2 text-start">{t('finance:journalEntries.fields.account')}</th>
            <th className="pb-2 text-start">{t('finance:journalEntries.fields.lineDescription')}</th>
            <th className="pb-2 text-start">{t('finance:journalEntries.fields.debit')}</th>
            <th className="pb-2 text-start">{t('finance:journalEntries.fields.credit')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {(entry.lines ?? []).map((line) => (
            <tr key={line.id}>
              <td className="py-2">{line.account ? `${line.account.code} — ${line.account.name}` : line.accountId}</td>
              <td className="py-2 text-ink-muted">{line.description ?? '—'}</td>
              <td className="py-2">{Number(line.debit) > 0 ? <FinancialValue value={line.debit} /> : '—'}</td>
              <td className="py-2">{Number(line.credit) > 0 ? <FinancialValue value={line.credit} /> : '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border font-medium text-ink">
            <td className="py-2" colSpan={2}>{t('finance:journalEntries.total')}</td>
            <td className="py-2"><FinancialValue value={totalDebit.toFixed(2)} /></td>
            <td className="py-2"><FinancialValue value={totalCredit.toFixed(2)} /></td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-4 flex flex-wrap gap-2">
        <PermissionGate requires={PERMISSIONS.Finance.journalEntries.post}>
          {nextStates.map((next) => (
            <button
              key={next}
              type="button"
              onClick={() => { setActionError(null); setConfirmAction(next as 'posted' | 'void'); }}
              className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
            >
              {next === 'posted' ? t('finance:journalEntries.detail.post') : t('finance:journalEntries.detail.void')}
            </button>
          ))}
        </PermissionGate>
      </div>
      {actionError && <p className="mt-2 text-sm text-danger" role="alert">{actionError}</p>}

      <ConfirmDialog
        open={!!confirmAction}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction === 'posted' ? t('finance:journalEntries.detail.postConfirmTitle') : t('finance:journalEntries.detail.voidConfirmTitle')}
        message={confirmAction === 'posted' ? t('finance:journalEntries.detail.postConfirmMessage') : t('finance:journalEntries.detail.voidConfirmMessage')}
        variant={confirmAction === 'void' ? 'destructive' : undefined}
        isLoading={postMutation.isPending || voidMutation.isPending}
        onConfirm={() => {
          const mutation = confirmAction === 'posted' ? postMutation : voidMutation;
          mutation.mutate(undefined, {
            onSuccess: () => setConfirmAction(null),
            onError: (err) => {
              setConfirmAction(null);
              setActionError(err instanceof ApiError ? err.message : t('common:error.generic'));
            },
          });
        }}
      />
    </div>
  );
}
