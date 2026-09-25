import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompanyInfo } from '../../../api/queries/useCompanySettings';
import { useBalanceSheet } from '../../../api/queries/useFinance';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { generateBalanceSheetPdf } from '../../../lib/generateFinancialReportPdf';
import type { BalanceSheetSection } from '../../../types/entities/finance';

function Section({ title, section }: { title: string; section: BalanceSheetSection }) {
  const { t } = useTranslation(['finance']);
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-ink">{title}</p>
      {section.lines.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('finance:reports.noData')}</p>
      ) : (
        <table className="w-full text-start text-sm">
          <tbody className="divide-y divide-border">
            {section.lines.map((line) => (
              <tr key={line.accountId}>
                <td className="py-1.5">{line.code} — {line.name}</td>
                <td className="py-1.5 text-end"><FinancialValue value={line.balance} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-1 flex justify-between border-t border-border pt-1 text-sm font-medium text-ink">
        <span>{title}</span>
        <FinancialValue value={section.total} />
      </div>
    </div>
  );
}

export function BalanceSheetPage() {
  const { t } = useTranslation(['finance', 'common']);
  const { data: company } = useCompanyInfo();
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [runDate, setRunDate] = useState<string | null>(asOfDate);
  const { data, isLoading } = useBalanceSheet(runDate);

  return (
    <div>
      <PageHeader
        title={t('finance:reports.balanceSheet.title')}
        breadcrumb={t('finance:reports.title')}
        action={
          data && (
            <button type="button" onClick={() => generateBalanceSheetPdf(data, company?.name ?? '')} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('finance:reports.exportPdf')}
            </button>
          )
        }
      />

      <div className="mb-4 flex items-end gap-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="asOfDate">{t('finance:reports.asOfDate')}</label>
          <input id="asOfDate" type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="rounded border border-border bg-surface px-3 py-2 text-sm text-ink" />
        </div>
        <button type="button" onClick={() => setRunDate(asOfDate)} className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-fg hover:opacity-90">
          {t('finance:reports.run')}
        </button>
      </div>

      {isLoading && <LoadingState variant="card" />}

      {data && (
        <div className="max-w-lg space-y-6">
          <Section title={t('finance:reports.balanceSheet.assets')} section={data.assets} />
          <Section title={t('finance:reports.balanceSheet.liabilities')} section={data.liabilities} />
          <Section title={t('finance:reports.balanceSheet.equity')} section={data.equity} />

          <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-ink">
            <p className="mb-1 font-medium">{t('finance:reports.balanceSheet.unclosedNetIncomeTitle')}</p>
            <p className="mb-2 text-ink-muted">{t('finance:reports.balanceSheet.unclosedNetIncomeHint')}</p>
            <div className="flex justify-between font-medium">
              <span>{t('finance:reports.balanceSheet.unclosedNetIncome')}</span>
              <FinancialValue value={data.unclosedNetIncome} />
            </div>
          </div>

          <div className={`rounded border px-3 py-2 text-sm ${data.isBalanced ? 'border-success/40 bg-success/10 text-success' : 'border-danger/40 bg-danger/10 text-danger'}`}>
            {data.isBalanced ? t('finance:reports.balanceSheet.balanced') : t('finance:reports.balanceSheet.notBalanced')}
          </div>
        </div>
      )}
    </div>
  );
}
