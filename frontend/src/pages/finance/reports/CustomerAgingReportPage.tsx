import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompanyInfo } from '../../../api/queries/useCompanySettings';
import { useNavigate } from 'react-router-dom';
import { useCustomerAging } from '../../../api/queries/useFinance';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { ApiError } from '../../../api/client';
import { generateCustomerAgingPdf } from '../../../lib/generateFinancialReportPdf';
import type { AgingBucketAmounts } from '../../../types/entities/finance';

const BUCKETS: Array<{ key: keyof AgingBucketAmounts; labelKey: string }> = [
  { key: 'current', labelKey: 'finance:reports.aging.current' },
  { key: 'days1to30', labelKey: 'finance:reports.aging.days1to30' },
  { key: 'days31to60', labelKey: 'finance:reports.aging.days31to60' },
  { key: 'days61to90', labelKey: 'finance:reports.aging.days61to90' },
  { key: 'over90', labelKey: 'finance:reports.aging.over90' },
  { key: 'noDueDate', labelKey: 'finance:reports.aging.noDueDate' },
];

export function CustomerAgingReportPage() {
  const { t } = useTranslation(['finance', 'common']);
  const { data: company } = useCompanyInfo();
  const navigate = useNavigate();
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [runDate, setRunDate] = useState<string | null>(asOfDate);
  const { data, isLoading, error } = useCustomerAging(runDate);

  return (
    <div>
      <PageHeader
        title={t('finance:reports.aging.title')}
        breadcrumb={t('finance:reports.title')}
        action={
          data && (
            <button type="button" onClick={() => generateCustomerAgingPdf(data, company?.name ?? '')} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
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
      {error && (() => {
        const apiError = error instanceof ApiError ? error : null;
        return <ErrorState variant="generic" message={apiError?.message} />;
      })()}

      {data && data.rows.length === 0 && <p className="text-sm text-ink-muted">{t('finance:reports.noData')}</p>}

      {data && data.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-border text-xs uppercase text-ink-muted">
              <tr>
                <th className="pb-2 pe-4 text-start">{t('finance:invoices.fields.customer')}</th>
                {BUCKETS.map((b) => (
                  <th key={b.key} className="pb-2 pe-4 text-end">{t(b.labelKey)}</th>
                ))}
                <th className="pb-2 text-end">{t('finance:invoices.fields.total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.rows.map((row) => (
                <tr key={row.customerId} className="cursor-pointer hover:bg-surface-muted" onClick={() => navigate(`/finance/customer-statement?customerId=${row.customerId}`)}>
                  <td className="py-2 pe-4 font-medium text-ink">{row.customerName}</td>
                  {BUCKETS.map((b) => (
                    <td key={b.key} className="py-2 pe-4 text-end">
                      {Number(row[b.key]) > 0 ? <FinancialValue value={row[b.key]} /> : <span className="text-ink-muted">—</span>}
                    </td>
                  ))}
                  <td className="py-2 text-end font-medium"><FinancialValue value={row.total} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold text-ink">
                <td className="py-2 pe-4">{t('finance:reports.aging.grandTotal')}</td>
                {BUCKETS.map((b) => (
                  <td key={b.key} className="py-2 pe-4 text-end"><FinancialValue value={data.grandTotal[b.key]} /></td>
                ))}
                <td className="py-2 text-end"><FinancialValue value={data.grandTotal.total} /></td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-3 text-xs text-ink-muted">{t('finance:reports.aging.clickHint')}</p>
        </div>
      )}
    </div>
  );
}
