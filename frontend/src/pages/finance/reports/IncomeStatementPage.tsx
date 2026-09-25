import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompanyInfo } from '../../../api/queries/useCompanySettings';
import { useIncomeStatement } from '../../../api/queries/useFinance';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { generateIncomeStatementPdf } from '../../../lib/generateFinancialReportPdf';

function startOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}

export function IncomeStatementPage() {
  const { t } = useTranslation(['finance', 'common']);
  const { data: company } = useCompanyInfo();
  const [fromDate, setFromDate] = useState(startOfYear());
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [run, setRun] = useState<{ from: string; to: string } | null>({ from: fromDate, to: toDate });
  const { data, isLoading } = useIncomeStatement(run?.from ?? null, run?.to ?? null);

  return (
    <div>
      <PageHeader
        title={t('finance:reports.incomeStatement.title')}
        breadcrumb={t('finance:reports.title')}
        action={
          data && (
            <button type="button" onClick={() => generateIncomeStatementPdf(data, company?.name ?? '')} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('finance:reports.exportPdf')}
            </button>
          )
        }
      />

      <div className="mb-4 flex items-end gap-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="fromDate">{t('finance:reports.fromDate')}</label>
          <input id="fromDate" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="toDate">{t('finance:reports.toDate')}</label>
          <input id="toDate" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </div>
        <button type="button" onClick={() => setRun({ from: fromDate, to: toDate })} className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-fg hover:opacity-90">
          {t('finance:reports.run')}
        </button>
      </div>

      {isLoading && <LoadingState variant="card" />}

      {data && (
        <div className="max-w-lg space-y-6">
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">{t('finance:reports.incomeStatement.revenue')}</p>
            {data.revenueLines.length === 0 ? (
              <p className="text-sm text-ink-muted">{t('finance:reports.noData')}</p>
            ) : (
              <table className="w-full text-start text-sm">
                <tbody className="divide-y divide-border">
                  {data.revenueLines.map((line) => (
                    <tr key={line.accountId}>
                      <td className="py-1.5">{line.code} — {line.name}</td>
                      <td className="py-1.5 text-end"><FinancialValue value={line.amount} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-1 flex justify-between border-t border-border pt-1 text-sm font-medium text-ink">
              <span>{t('finance:reports.incomeStatement.totalRevenue')}</span>
              <FinancialValue value={data.totalRevenue} />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-ink">{t('finance:reports.incomeStatement.expenses')}</p>
            {data.expenseLines.length === 0 ? (
              <p className="text-sm text-ink-muted">{t('finance:reports.noData')}</p>
            ) : (
              <table className="w-full text-start text-sm">
                <tbody className="divide-y divide-border">
                  {data.expenseLines.map((line) => (
                    <tr key={line.accountId}>
                      <td className="py-1.5">{line.code} — {line.name}</td>
                      <td className="py-1.5 text-end"><FinancialValue value={line.amount} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-1 flex justify-between border-t border-border pt-1 text-sm font-medium text-ink">
              <span>{t('finance:reports.incomeStatement.totalExpense')}</span>
              <FinancialValue value={data.totalExpense} />
            </div>
          </div>

          <div className="flex justify-between rounded-lg border border-border bg-surface p-4 text-base font-semibold text-ink">
            <span>{t('finance:reports.incomeStatement.netIncome')}</span>
            <FinancialValue value={data.netIncome} />
          </div>
        </div>
      )}
    </div>
  );
}
