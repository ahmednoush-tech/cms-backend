import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompanyInfo } from '../../../api/queries/useCompanySettings';
import { useCashFlowStatement } from '../../../api/queries/useFinance';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { ApiError } from '../../../api/client';
import { generateCashFlowPdf } from '../../../lib/generateFinancialReportPdf';
import type { CashFlowSection } from '../../../types/entities/finance';

function startOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}

function Section({ title, section }: { title: string; section: CashFlowSection }) {
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
              <tr key={line.journalEntryId}>
                <td className="py-1.5 text-xs text-ink-muted">{line.entryDate}</td>
                <td className="py-1.5">{line.counterpartyAccountName ?? line.description ?? '—'}</td>
                <td className="py-1.5 text-end"><FinancialValue value={line.amount} /></td>
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

export function CashFlowStatementPage() {
  const { t } = useTranslation(['finance', 'common']);
  const { data: company } = useCompanyInfo();
  const [fromDate, setFromDate] = useState(startOfYear());
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [run, setRun] = useState<{ from: string; to: string } | null>({ from: fromDate, to: toDate });
  const { data, isLoading, error } = useCashFlowStatement(run?.from ?? null, run?.to ?? null);

  return (
    <div>
      <PageHeader
        title={t('finance:reports.cashFlow.title')}
        breadcrumb={t('finance:reports.title')}
        action={
          data && (
            <button type="button" onClick={() => generateCashFlowPdf(data, company?.name ?? '')} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
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
      {error && (() => {
        const apiError = error instanceof ApiError ? error : null;
        return <ErrorState variant="generic" message={apiError?.message} />;
      })()}

      {data && (
        <div className="max-w-lg space-y-6">
          <div className="flex justify-between rounded-lg border border-border bg-surface p-3 text-sm">
            <span className="text-ink-muted">{t('finance:reports.cashFlow.beginningBalance')}</span>
            <FinancialValue value={data.beginningBalance} />
          </div>

          <Section title={t('finance:reports.cashFlow.operating')} section={data.operating} />
          <Section title={t('finance:reports.cashFlow.investing')} section={data.investing} />
          <Section title={t('finance:reports.cashFlow.financing')} section={data.financing} />

          {data.uncategorized.lines.length > 0 && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
              <p className="mb-2 text-xs text-ink-muted">{t('finance:reports.cashFlow.uncategorizedHint')}</p>
              <Section title={t('finance:reports.cashFlow.uncategorized')} section={data.uncategorized} />
            </div>
          )}

          <div className="flex justify-between rounded-lg border border-border bg-surface p-3 text-sm font-medium">
            <span>{t('finance:reports.cashFlow.netChange')}</span>
            <FinancialValue value={data.netChange} />
          </div>
          <div className="flex justify-between rounded-lg border border-border bg-surface p-4 text-base font-semibold text-ink">
            <span>{t('finance:reports.cashFlow.endingBalance')}</span>
            <FinancialValue value={data.endingBalance} />
          </div>
        </div>
      )}
    </div>
  );
}
