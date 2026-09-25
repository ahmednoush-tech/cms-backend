import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompanyInfo } from '../../../api/queries/useCompanySettings';
import { useAccounts } from '../../../api/queries/useFinance';
import { useAccountLedger } from '../../../api/queries/useFinance';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { ApiError } from '../../../api/client';
import { generateAccountLedgerPdf } from '../../../lib/generateFinancialReportPdf';

function startOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}

export function AccountLedgerPage() {
  const { t } = useTranslation(['finance', 'common']);
  const { data: company } = useCompanyInfo();

  const [accountId, setAccountId] = useState('');
  const [fromDate, setFromDate] = useState(startOfYear());
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [run, setRun] = useState<{ accountId: string; from: string; to: string } | null>(null);

  const { data: accountsData } = useAccounts({ page: 1, pageSize: 300 });
  const { data, isLoading, error } = useAccountLedger(run?.accountId ?? null, run?.from ?? null, run?.to ?? null);

  return (
    <div>
      <PageHeader
        title={t('finance:reports.ledger.title')}
        breadcrumb={t('finance:reports.title')}
        action={
          data && (
            <button type="button" onClick={() => generateAccountLedgerPdf(data, company?.name ?? '')} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('finance:reports.exportPdf')}
            </button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="accountId">{t('finance:journalEntries.fields.account')}</label>
          <select id="accountId" value={accountId} onChange={(e) => setAccountId(e.target.value)} className="rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">—</option>
            {(accountsData?.items ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="fromDate">{t('finance:reports.fromDate')}</label>
          <input id="fromDate" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="toDate">{t('finance:reports.toDate')}</label>
          <input id="toDate" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </div>
        <button
          type="button"
          disabled={!accountId}
          onClick={() => setRun({ accountId, from: fromDate, to: toDate })}
          className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50"
        >
          {t('finance:reports.run')}
        </button>
      </div>

      {isLoading && <LoadingState variant="card" />}
      {error && (() => {
        const apiError = error instanceof ApiError ? error : null;
        return <ErrorState variant="generic" message={apiError?.message} />;
      })()}

      {data && (
        <div>
          <p className="mb-3 text-sm font-medium text-ink">{data.accountCode} — {data.accountName}</p>

          <table className="w-full text-start text-sm">
            <thead className="border-b border-border text-xs uppercase text-ink-muted">
              <tr>
                <th className="pb-2 text-start">{t('finance:reports.statement.date')}</th>
                <th className="pb-2 text-start">{t('finance:journalEntries.columns.entryNumber')}</th>
                <th className="pb-2 text-start">{t('finance:journalEntries.fields.reference')}</th>
                <th className="pb-2 text-start">{t('finance:journalEntries.fields.description')}</th>
                <th className="pb-2 text-end">{t('finance:journalEntries.fields.debit')}</th>
                <th className="pb-2 text-end">{t('finance:journalEntries.fields.credit')}</th>
                <th className="pb-2 text-end">{t('finance:reports.statement.balance')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td colSpan={6} className="py-2 font-medium text-ink">{t('finance:reports.statement.openingBalance')}</td>
                <td className="py-2 text-end font-medium"><FinancialValue value={data.openingBalance} /></td>
              </tr>
              {data.lines.map((line, i) => (
                <tr key={i}>
                  <td className="py-2">{line.date}</td>
                  <td className="py-2">{line.entryNumber}</td>
                  <td className="py-2 text-ink-muted">{line.reference ?? '—'}</td>
                  <td className="py-2 text-ink-muted">{line.description ?? '—'}</td>
                  <td className="py-2 text-end">{Number(line.debit) > 0 ? <FinancialValue value={line.debit} /> : '—'}</td>
                  <td className="py-2 text-end">{Number(line.credit) > 0 ? <FinancialValue value={line.credit} /> : '—'}</td>
                  <td className="py-2 text-end"><FinancialValue value={line.runningBalance} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold text-ink">
                <td colSpan={6} className="py-2">{t('finance:reports.statement.closingBalance')}</td>
                <td className="py-2 text-end"><FinancialValue value={data.closingBalance} /></td>
              </tr>
            </tfoot>
          </table>

          {data.lines.length === 0 && <p className="mt-3 text-sm text-ink-muted">{t('finance:reports.noData')}</p>}
        </div>
      )}
    </div>
  );
}
