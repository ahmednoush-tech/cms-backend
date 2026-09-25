import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompanyInfo } from '../../../api/queries/useCompanySettings';
import { useZakatBaseEstimate } from '../../../api/queries/useFinance';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { ApiError } from '../../../api/client';
import { generateZakatBaseEstimatePdf } from '../../../lib/generateFinancialReportPdf';
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

export function ZakatBaseEstimatePage() {
  const { t } = useTranslation(['finance', 'common']);
  const { data: company } = useCompanyInfo();
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [runDate, setRunDate] = useState<string | null>(asOfDate);
  const { data, isLoading, error } = useZakatBaseEstimate(runDate);

  return (
    <div>
      <PageHeader
        title={t('finance:reports.zakat.title')}
        breadcrumb={t('finance:reports.title')}
        action={
          data && (
            <button type="button" onClick={() => generateZakatBaseEstimatePdf(data, company?.name ?? '')} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('finance:reports.exportPdf')}
            </button>
          )
        }
      />

      <div className="mb-6 rounded-lg border-2 border-danger/50 bg-danger/10 p-4">
        <p className="mb-1 text-sm font-bold text-danger">{t('finance:reports.zakat.disclaimerTitle')}</p>
        <p className="text-sm text-ink">{t('finance:reports.zakat.disclaimerBody')}</p>
      </div>

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
      {error && (() => {
        const apiError = error instanceof ApiError ? error : null;
        return <ErrorState variant="generic" message={apiError?.message} />;
      })()}

      {data && (
        <div className="max-w-lg space-y-6">
          <div className="flex justify-between rounded-lg border border-border bg-surface p-3 text-sm">
            <span className="text-ink-muted">{t('finance:reports.zakat.totalEquity')}</span>
            <FinancialValue value={data.totalEquity} />
          </div>

          <Section title={t('finance:reports.zakat.longTermLiabilities')} section={data.longTermLiabilities} />
          <Section title={t('finance:reports.zakat.fixedAssets')} section={data.fixedAssets} />
          <Section title={t('finance:reports.zakat.longTermInvestments')} section={data.longTermInvestments} />

          <div className="flex justify-between rounded-lg border border-border bg-surface p-4 text-base font-semibold text-ink">
            <span>{t('finance:reports.zakat.zakatBaseEstimate')}</span>
            <FinancialValue value={data.zakatBaseEstimate} />
          </div>

          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="mb-3 text-xs text-ink-muted">{t('finance:reports.zakat.rateHint')}</p>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-ink-muted">{t('finance:reports.zakat.hijriRate')}</span>
              <FinancialValue value={data.estimatedZakatDueHijriRate} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-muted">{t('finance:reports.zakat.gregorianRate')}</span>
              <FinancialValue value={data.estimatedZakatDueGregorianRate} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
