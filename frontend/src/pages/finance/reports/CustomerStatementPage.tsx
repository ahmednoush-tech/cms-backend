import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompanyInfo } from '../../../api/queries/useCompanySettings';
import { useSearchParams } from 'react-router-dom';
import { useCustomers } from '../../../api/queries/useCustomers';
import { useCustomerStatement } from '../../../api/queries/useFinance';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { FinancialValue } from '../../../components/dashboard/FinancialValue';
import { ApiError } from '../../../api/client';
import { generateCustomerStatementPdf } from '../../../lib/generateFinancialReportPdf';

function startOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}

const TYPE_LABEL_KEYS: Record<string, string> = {
  invoice: 'finance:reports.statement.type.invoice',
  payment: 'finance:reports.statement.type.payment',
  credit_note: 'finance:reports.statement.type.creditNote',
  debit_note: 'finance:reports.statement.type.debitNote',
};

export function CustomerStatementPage() {
  const { t } = useTranslation(['finance', 'common']);
  const { data: company } = useCompanyInfo();
  const [searchParams] = useSearchParams();

  const [customerId, setCustomerId] = useState(searchParams.get('customerId') ?? '');
  const [fromDate, setFromDate] = useState(startOfYear());
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [run, setRun] = useState<{ customerId: string; from: string; to: string } | null>(
    customerId ? { customerId, from: fromDate, to: toDate } : null,
  );

  const { data: customersData } = useCustomers({ page: 1, pageSize: 200 });
  const { data, isLoading, error } = useCustomerStatement(run?.customerId ?? null, run?.from ?? null, run?.to ?? null);

  return (
    <div>
      <PageHeader
        title={t('finance:reports.statement.title')}
        breadcrumb={t('finance:reports.title')}
        action={
          data && (
            <button type="button" onClick={() => generateCustomerStatementPdf(data, company?.name ?? '')} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
              {t('finance:reports.exportPdf')}
            </button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="customerId">{t('finance:invoices.fields.customer')}</label>
          <select id="customerId" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">—</option>
            {(customersData?.items ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.companyName ?? c.customerCode}</option>
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
          disabled={!customerId}
          onClick={() => setRun({ customerId, from: fromDate, to: toDate })}
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
          <p className="mb-3 text-sm font-medium text-ink">{data.customerName}</p>

          <table className="w-full text-start text-sm">
            <thead className="border-b border-border text-xs uppercase text-ink-muted">
              <tr>
                <th className="pb-2 text-start">{t('finance:reports.statement.date')}</th>
                <th className="pb-2 text-start">{t('finance:reports.statement.type.label')}</th>
                <th className="pb-2 text-start">{t('finance:reports.statement.reference')}</th>
                <th className="pb-2 text-end">{t('finance:journalEntries.fields.debit')}</th>
                <th className="pb-2 text-end">{t('finance:journalEntries.fields.credit')}</th>
                <th className="pb-2 text-end">{t('finance:reports.statement.balance')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td colSpan={5} className="py-2 font-medium text-ink">{t('finance:reports.statement.openingBalance')}</td>
                <td className="py-2 text-end font-medium"><FinancialValue value={data.openingBalance} /></td>
              </tr>
              {data.lines.map((line, i) => (
                <tr key={i}>
                  <td className="py-2">{line.date}</td>
                  <td className="py-2">{t(TYPE_LABEL_KEYS[line.type])}</td>
                  <td className="py-2 text-ink-muted">{line.reference}</td>
                  <td className="py-2 text-end">{Number(line.debit) > 0 ? <FinancialValue value={line.debit} /> : '—'}</td>
                  <td className="py-2 text-end">{Number(line.credit) > 0 ? <FinancialValue value={line.credit} /> : '—'}</td>
                  <td className="py-2 text-end"><FinancialValue value={line.runningBalance} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold text-ink">
                <td colSpan={5} className="py-2">{t('finance:reports.statement.closingBalance')}</td>
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
