import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompanyInfo } from '../../../api/queries/useCompanySettings';
import { useTrialBalance } from '../../../api/queries/useFinance';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { generateTrialBalancePdf } from '../../../lib/generateFinancialReportPdf';

export function TrialBalancePage() {
  const { t } = useTranslation(['finance', 'common']);
  const { data: company } = useCompanyInfo();
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [runDate, setRunDate] = useState<string | null>(asOfDate);
  const { data, isLoading } = useTrialBalance(runDate);

  return (
    <div>
      <PageHeader
        title={t('finance:reports.trialBalance.title')}
        breadcrumb={t('finance:reports.title')}
        action={
          data && (
            <button type="button" onClick={() => generateTrialBalancePdf(data, company?.name ?? '')} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('finance:reports.exportPdf')}
            </button>
          )
        }
      />

      <div className="mb-4 flex items-end gap-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="asOfDate">{t('finance:reports.asOfDate')}</label>
          <input
            id="asOfDate"
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="rounded border border-border bg-surface px-3 py-2 text-sm text-ink"
          />
        </div>
        <button type="button" onClick={() => setRunDate(asOfDate)} className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-fg hover:opacity-90">
          {t('finance:reports.run')}
        </button>
      </div>

      {isLoading && <LoadingState variant="card" />}

      {data && (
        <>
          <table className="w-full text-start text-sm">
            <thead className="border-b border-border text-xs uppercase text-ink-muted">
              <tr>
                <th className="pb-2 text-start">{t('finance:accounts.fields.code')}</th>
                <th className="pb-2 text-start">{t('finance:accounts.fields.name')}</th>
                <th className="pb-2 text-start">{t('finance:journalEntries.fields.debit')}</th>
                <th className="pb-2 text-start">{t('finance:journalEntries.fields.credit')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.lines.map((line) => (
                <tr key={line.accountId}>
                  <td className="py-2">{line.code}</td>
                  <td className="py-2">{line.name}</td>
                  <td className="py-2">{Number(line.debit) > 0 ? <FinancialValue value={line.debit} /> : '—'}</td>
                  <td className="py-2">{Number(line.credit) > 0 ? <FinancialValue value={line.credit} /> : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-medium text-ink">
                <td className="py-2" colSpan={2}>{t('finance:journalEntries.total')}</td>
                <td className="py-2"><FinancialValue value={data.totalDebit} /></td>
                <td className="py-2"><FinancialValue value={data.totalCredit} /></td>
              </tr>
            </tfoot>
          </table>

          <div className={`mt-4 rounded border px-3 py-2 text-sm ${data.isBalanced ? 'border-success/40 bg-success/10 text-success' : 'border-danger/40 bg-danger/10 text-danger'}`}>
            {data.isBalanced ? t('finance:reports.trialBalance.balanced') : t('finance:reports.trialBalance.notBalanced')}
          </div>

          {data.lines.length === 0 && <p className="mt-4 text-sm text-ink-muted">{t('finance:reports.noData')}</p>}
        </>
      )}
    </div>
  );
}
