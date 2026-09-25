import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccounts } from '../../api/queries/useFinance';
import { usePayrollSettings, useUpdatePayrollSettings } from '../../api/queries/usePayroll';
import { PageHeader } from '../../components/PageHeader/PageHeader';
import { LoadingState } from '../../components/LoadingState/LoadingState';
import { FormField } from '../../components/Form/FormField';
import { ApiError } from '../../api/client';

/**
 * Without these accounts configured, PayrollRunsService.process()
 * rejects outright with a clear message. GOSI Employer Expense and
 * GOSI Payable are only required if the run actually has a GOSI
 * amount — a company with zero GOSI-applicable employees can skip
 * them.
 */
export function PayrollSettingsPage() {
  const { t } = useTranslation(['payroll', 'common']);
  const { data: settings, isLoading } = usePayrollSettings();
  const { data: accountsData } = useAccounts({ page: 1, pageSize: 300 });
  const updateMutation = useUpdatePayrollSettings();

  const [form, setForm] = useState({
    salaryExpenseAccountId: '',
    gosiEmployerExpenseAccountId: '',
    gosiPayableAccountId: '',
    netPayPayableAccountId: '',
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setForm({
        salaryExpenseAccountId: settings.salaryExpenseAccountId ?? '',
        gosiEmployerExpenseAccountId: settings.gosiEmployerExpenseAccountId ?? '',
        gosiPayableAccountId: settings.gosiPayableAccountId ?? '',
        netPayPayableAccountId: settings.netPayPayableAccountId ?? '',
      });
    }
  }, [settings]);

  const accounts = accountsData?.items ?? [];

  const handleSave = () => {
    setSaved(false);
    setError(null);
    updateMutation.mutate(
      {
        salaryExpenseAccountId: form.salaryExpenseAccountId || undefined,
        gosiEmployerExpenseAccountId: form.gosiEmployerExpenseAccountId || undefined,
        gosiPayableAccountId: form.gosiPayableAccountId || undefined,
        netPayPayableAccountId: form.netPayPayableAccountId || undefined,
      },
      {
        onSuccess: () => setSaved(true),
        onError: (err) => setError(err instanceof ApiError ? err.message : t('common:error.generic')),
      },
    );
  };

  if (isLoading) return <LoadingState variant="card" />;

  return (
    <div>
      <PageHeader title={t('payroll:settings.title')} />

      <div className="max-w-lg space-y-4 rounded-lg border border-border bg-surface p-4">
        <FormField label={t('payroll:settings.salaryExpenseAccount')} htmlFor="salaryExpenseAccountId" required>
          <select id="salaryExpenseAccountId" value={form.salaryExpenseAccountId} onChange={(e) => setForm({ ...form, salaryExpenseAccountId: e.target.value })} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">—</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </FormField>
        <FormField label={t('payroll:settings.netPayPayableAccount')} htmlFor="netPayPayableAccountId" required>
          <select id="netPayPayableAccountId" value={form.netPayPayableAccountId} onChange={(e) => setForm({ ...form, netPayPayableAccountId: e.target.value })} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">—</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </FormField>
        <FormField label={t('payroll:settings.gosiPayableAccount')} htmlFor="gosiPayableAccountId" hint={t('payroll:settings.gosiPayableHint')}>
          <select id="gosiPayableAccountId" value={form.gosiPayableAccountId} onChange={(e) => setForm({ ...form, gosiPayableAccountId: e.target.value })} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">{t('common:action.none')}</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </FormField>
        <FormField label={t('payroll:settings.gosiEmployerExpenseAccount')} htmlFor="gosiEmployerExpenseAccountId" hint={t('payroll:settings.gosiEmployerExpenseHint')}>
          <select id="gosiEmployerExpenseAccountId" value={form.gosiEmployerExpenseAccountId} onChange={(e) => setForm({ ...form, gosiEmployerExpenseAccountId: e.target.value })} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
            <option value="">{t('common:action.none')}</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
          </select>
        </FormField>

        <p className="text-xs text-ink-muted">{t('payroll:settings.cashAccountHint')}</p>

        {error && <p className="rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
        {saved && <p className="text-sm text-success">{t('payroll:settings.saved')}</p>}

        <button type="button" onClick={handleSave} disabled={updateMutation.isPending} className="rounded bg-primary px-3 py-2 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
          {updateMutation.isPending ? t('common:action.processing') : t('common:action.save')}
        </button>
      </div>
    </div>
  );
}
