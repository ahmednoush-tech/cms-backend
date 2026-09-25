import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePortalStatement } from '../../api/queries/usePortal';
import { LoadingState } from '../../components/LoadingState/LoadingState';
import { ErrorState } from '../../components/ErrorState/ErrorState';
import { FinancialValue } from '../../components/dashboard/FinancialValue';
import { ApiError } from '../../api/client';

function startOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}

const TYPE_LABEL_KEYS: Record<string, string> = {
  invoice: 'portal:statement.type.invoice',
  payment: 'portal:statement.type.payment',
  credit_note: 'portal:statement.type.creditNote',
  debit_note: 'portal:statement.type.debitNote',
};

export function PortalStatementPage() {
  const { t } = useTranslation(['portal', 'common']);
  const [fromDate, setFromDate] = useState(startOfYear());
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0, 10));
  const [run, setRun] = useState<{ from: string; to: string } | null>({ from: fromDate, to: toDate });
  const { data, isLoading, error } = usePortalStatement(run?.from ?? null, run?.to ?? null);

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold text-ink">{t('portal:statement.title')}</h1>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted" htmlFor="fromDate">{t('portal:statement.fromDate')}</label>
          <input id="fromDate" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted" htmlFor="toDate">{t('portal:statement.toDate')}</label>
          <input id="toDate" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink" />
        </div>
        <button type="button" onClick={() => setRun({ from: fromDate, to: toDate })} className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-fg hover:opacity-90">
          {t('portal:statement.run')}
        </button>
      </div>

      {isLoading && <LoadingState variant="card" />}
      {error && (() => {
        const apiError = error instanceof ApiError ? error : null;
        return <ErrorState variant="generic" message={apiError?.message} />;
      })()}

      {data && (
        <div className="rounded-lg border border-border bg-surface p-4">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-border text-xs uppercase text-ink-muted">
              <tr>
                <th className="pb-2 text-start">{t('portal:columns.date')}</th>
                <th className="pb-2 text-start">{t('portal:statement.type.label')}</th>
                <th className="pb-2 text-start">{t('portal:statement.reference')}</th>
                <th className="pb-2 text-end">{t('portal:statement.balance')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td colSpan={3} className="py-2 font-medium text-ink">{t('portal:statement.openingBalance')}</td>
                <td className="py-2 text-end font-medium"><FinancialValue value={data.openingBalance} /></td>
              </tr>
              {data.lines.map((line, i) => (
                <tr key={i}>
                  <td className="py-2">{line.date}</td>
                  <td className="py-2">{t(TYPE_LABEL_KEYS[line.type] ?? line.type)}</td>
                  <td className="py-2 text-ink-muted">{line.reference}</td>
                  <td className="py-2 text-end"><FinancialValue value={line.runningBalance} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border font-semibold text-ink">
                <td colSpan={3} className="py-2">{t('portal:statement.closingBalance')}</td>
                <td className="py-2 text-end"><FinancialValue value={data.closingBalance} /></td>
              </tr>
            </tfoot>
          </table>
          {data.lines.length === 0 && <p className="mt-3 text-sm text-ink-muted">{t('portal:statement.empty')}</p>}
        </div>
      )}
    </div>
  );
}
