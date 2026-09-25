import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAccounts } from '../../../api/queries/useFinance';
import { useCreateBankReconciliation } from '../../../api/queries/useBankReconciliations';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { ApiError } from '../../../api/client';

export function CreateBankReconciliationPage() {
  const { t } = useTranslation(['bankReconciliation', 'common']);
  const navigate = useNavigate();
  const { data: accountsData } = useAccounts({ page: 1, pageSize: 300 });
  const createMutation = useCreateBankReconciliation();

  const [bankAccountId, setBankAccountId] = useState('');
  const [statementDate, setStatementDate] = useState('');
  const [statementEndingBalance, setStatementEndingBalance] = useState('');
  const [error, setError] = useState<string | null>(null);

  const accounts = accountsData?.items ?? [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    createMutation.mutate(
      { bankAccountId, statementDate, statementEndingBalance: Number(statementEndingBalance) },
      {
        onSuccess: (recon) => navigate(`/finance/bank-reconciliation/${recon.id}`),
        onError: (err) => setError(err instanceof ApiError ? err.message : t('common:error.generic')),
      },
    );
  };

  return (
    <div>
      <PageHeader title={t('bankReconciliation:form.createTitle')} breadcrumb={t('bankReconciliation:title')} />

      <form onSubmit={handleSubmit} noValidate className="max-w-md rounded-lg border border-border bg-surface p-4">
        <FormField label={t('bankReconciliation:fields.bankAccount')} htmlFor="bankAccountId" required>
          <select id="bankAccountId" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} required className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">—</option>
            {accounts.map((acc) => (<option key={acc.id} value={acc.id}>{acc.code} — {acc.name}</option>))}
          </select>
        </FormField>

        <FormField label={t('bankReconciliation:fields.statementDate')} htmlFor="statementDate" required>
          <TextInput id="statementDate" type="date" value={statementDate} onChange={(e) => setStatementDate(e.target.value)} required />
        </FormField>

        <FormField label={t('bankReconciliation:fields.statementEndingBalance')} htmlFor="statementEndingBalance" required>
          <TextInput id="statementEndingBalance" type="number" step="0.01" value={statementEndingBalance} onChange={(e) => setStatementEndingBalance(e.target.value)} required />
        </FormField>

        {error && <p className="mt-2 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => navigate('/finance/bank-reconciliation')} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
            {t('common:action.cancel')}
          </button>
          <button type="submit" disabled={createMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
            {createMutation.isPending ? t('common:action.processing') : t('common:action.create')}
          </button>
        </div>
      </form>
    </div>
  );
}
