import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccounts } from '../../../api/queries/useFinance';
import { useFinanceSettings, useUpdateFinanceSettings } from '../../../api/queries/useFinance';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { ApiError } from '../../../api/client';

/**
 * Without these four accounts configured, InvoicesService.issue()
 * and PaymentsService.create() both reject outright with a clear
 * message (confirmed against the backend this session) — this
 * page exists specifically so that rejection never has to happen
 * in practice; it's the one-time setup every company does before
 * issuing their first invoice.
 */
export function FinanceSettingsPage() {
  const { t } = useTranslation(['finance', 'common']);
  const { data: settings, isLoading } = useFinanceSettings();
  const { data: accountsData } = useAccounts({ page: 1, pageSize: 200 });
  const updateMutation = useUpdateFinanceSettings();

  const [form, setForm] = useState({
    defaultReceivableAccountId: '',
    defaultRevenueAccountId: '',
    defaultTaxPayableAccountId: '',
    defaultCashAccountId: '',
    defaultPayableAccountId: '',
    defaultExpenseAccountId: '',
    defaultTaxRecoverableAccountId: '',
    defaultAssetDisposalGainLossAccountId: '',
    sellerName: '',
    vatRegistrationNumber: '',
    sellerStreetName: '',
    sellerBuildingNumber: '',
    sellerDistrict: '',
    sellerCity: '',
    sellerPostalCode: '',
  });
  const [vatError, setVatError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setForm({
        defaultReceivableAccountId: settings.defaultReceivableAccountId ?? '',
        defaultRevenueAccountId: settings.defaultRevenueAccountId ?? '',
        defaultTaxPayableAccountId: settings.defaultTaxPayableAccountId ?? '',
        defaultCashAccountId: settings.defaultCashAccountId ?? '',
        defaultPayableAccountId: settings.defaultPayableAccountId ?? '',
        defaultExpenseAccountId: settings.defaultExpenseAccountId ?? '',
        defaultTaxRecoverableAccountId: settings.defaultTaxRecoverableAccountId ?? '',
        defaultAssetDisposalGainLossAccountId: settings.defaultAssetDisposalGainLossAccountId ?? '',
        sellerName: settings.sellerName ?? '',
        vatRegistrationNumber: settings.vatRegistrationNumber ?? '',
        sellerStreetName: settings.sellerStreetName ?? '',
        sellerBuildingNumber: settings.sellerBuildingNumber ?? '',
        sellerDistrict: settings.sellerDistrict ?? '',
        sellerCity: settings.sellerCity ?? '',
        sellerPostalCode: settings.sellerPostalCode ?? '',
      });
    }
  }, [settings]);

  if (isLoading) return <LoadingState variant="card" />;

  const accounts = accountsData?.items ?? [];
  const accountFields: Array<{ key: keyof typeof form; labelKey: string }> = [
    { key: 'defaultReceivableAccountId', labelKey: 'finance:settings.fields.receivable' },
    { key: 'defaultRevenueAccountId', labelKey: 'finance:settings.fields.revenue' },
    { key: 'defaultTaxPayableAccountId', labelKey: 'finance:settings.fields.taxPayable' },
    { key: 'defaultCashAccountId', labelKey: 'finance:settings.fields.cash' },
    { key: 'defaultPayableAccountId', labelKey: 'finance:settings.fields.payable' },
    { key: 'defaultExpenseAccountId', labelKey: 'finance:settings.fields.expense' },
    { key: 'defaultTaxRecoverableAccountId', labelKey: 'finance:settings.fields.taxRecoverable' },
    { key: 'defaultAssetDisposalGainLossAccountId', labelKey: 'finance:settings.fields.assetDisposalGainLoss' },
  ];

  return (
    <div>
      <PageHeader title={t('finance:settings.title')} />
      <p className="mb-4 text-sm text-ink-muted">{t('finance:settings.description')}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setVatError(null);
          setSaved(false);
          if (form.vatRegistrationNumber && !/^\d{15}$/.test(form.vatRegistrationNumber)) {
            setVatError(t('finance:settings.zatca.vatNumberInvalid'));
            return;
          }
          const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v)) as typeof form;
          updateMutation.mutate(payload, {
            onSuccess: () => setSaved(true),
            onError: (err) => setError(err instanceof ApiError ? err.message : t('common:error.generic')),
          });
        }}
        className="max-w-lg rounded-lg border border-border bg-surface p-4"
      >
        {accountFields.map(({ key, labelKey }) => (
          <div key={key} className="mb-4">
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor={key}>
              {t(labelKey)}
            </label>
            <select
              id={key}
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink"
            >
              <option value="">{t('common:action.none')}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>
        ))}

        <div className="mb-4 border-t border-border pt-4">
          <p className="mb-1 text-sm font-semibold text-ink">{t('finance:settings.zatca.title')}</p>
          <p className="mb-3 text-xs text-ink-muted">{t('finance:settings.zatca.description')}</p>

          <FormField label={t('finance:settings.zatca.sellerName')} htmlFor="sellerName">
            <TextInput
              id="sellerName"
              value={form.sellerName}
              onChange={(e) => setForm((f) => ({ ...f, sellerName: e.target.value }))}
            />
          </FormField>
          <FormField
            label={t('finance:settings.zatca.vatRegistrationNumber')}
            htmlFor="vatRegistrationNumber"
            hint={t('finance:settings.zatca.vatNumberHint')}
            error={vatError ?? undefined}
          >
            <TextInput
              id="vatRegistrationNumber"
              hasError={!!vatError}
              value={form.vatRegistrationNumber}
              onChange={(e) => setForm((f) => ({ ...f, vatRegistrationNumber: e.target.value }))}
              maxLength={15}
            />
          </FormField>

          <p className="mb-2 mt-4 text-xs font-medium text-ink-muted">{t('finance:settings.zatca.addressTitle')}</p>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('finance:settings.zatca.streetName')} htmlFor="sellerStreetName">
              <TextInput id="sellerStreetName" value={form.sellerStreetName} onChange={(e) => setForm((f) => ({ ...f, sellerStreetName: e.target.value }))} />
            </FormField>
            <FormField label={t('finance:settings.zatca.buildingNumber')} htmlFor="sellerBuildingNumber">
              <TextInput id="sellerBuildingNumber" value={form.sellerBuildingNumber} onChange={(e) => setForm((f) => ({ ...f, sellerBuildingNumber: e.target.value }))} maxLength={10} />
            </FormField>
            <FormField label={t('finance:settings.zatca.district')} htmlFor="sellerDistrict">
              <TextInput id="sellerDistrict" value={form.sellerDistrict} onChange={(e) => setForm((f) => ({ ...f, sellerDistrict: e.target.value }))} />
            </FormField>
            <FormField label={t('finance:settings.zatca.city')} htmlFor="sellerCity">
              <TextInput id="sellerCity" value={form.sellerCity} onChange={(e) => setForm((f) => ({ ...f, sellerCity: e.target.value }))} />
            </FormField>
            <FormField label={t('finance:settings.zatca.postalCode')} htmlFor="sellerPostalCode">
              <TextInput id="sellerPostalCode" value={form.sellerPostalCode} onChange={(e) => setForm((f) => ({ ...f, sellerPostalCode: e.target.value }))} maxLength={10} />
            </FormField>
          </div>
        </div>

        {error && <p className="mb-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
        {saved && <p className="mb-3 text-sm text-success">{t('finance:settings.saved')}</p>}

        <button type="submit" disabled={updateMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
          {updateMutation.isPending ? t('common:action.processing') : t('common:action.save')}
        </button>
      </form>
    </div>
  );
}
