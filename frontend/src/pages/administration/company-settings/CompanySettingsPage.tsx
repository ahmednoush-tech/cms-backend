import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompanyInfo, useUpdateCompanySettings, useUploadCompanyLogo, useMicrosoftIntegrationSettings, useUpdateMicrosoftIntegrationSettings } from '../../../api/queries/useCompanySettings';
import { resolveAssetUrl } from '../../../lib/resolveAssetUrl';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { FormField, TextInput } from '../../../components/Form/FormField';
import { ApiError } from '../../../api/client';
import type { UpdateCompanySettingsInput } from '../../../types/entities/companySettings';

const EMPTY_FORM: UpdateCompanySettingsInput = {
  name: '', legalName: '', email: '', phone: '', website: '', address: '', city: '', country: '', taxNumber: '',
};

export function CompanySettingsPage() {
  const { t } = useTranslation(['companySettings', 'common']);
  const { data: company, isLoading, error } = useCompanyInfo();
  const updateMutation = useUpdateCompanySettings();
  const uploadLogoMutation = useUploadCompanyLogo();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<UpdateCompanySettingsInput>(EMPTY_FORM);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name ?? '',
        legalName: company.legalName ?? '',
        email: company.email ?? '',
        phone: company.phone ?? '',
        website: company.website ?? '',
        address: company.address ?? '',
        city: company.city ?? '',
        country: company.country ?? '',
        taxNumber: company.taxNumber ?? '',
      });
    }
  }, [company]);

  if (isLoading) return <LoadingState variant="page" />;
  if (error) {
    const apiError = error instanceof ApiError ? error : null;
    return <ErrorState variant="generic" message={apiError?.message} />;
  }

  const handleField = (field: keyof UpdateCompanySettingsInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);
    updateMutation.mutate(form, {
      onSuccess: () => setSaveSuccess(true),
      onError: (err) => setSaveError(err instanceof ApiError ? err.message : t('common:error.generic')),
    });
  };

  const handleLogoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);
    uploadLogoMutation.mutate(file, {
      onError: (err) => setLogoError(err instanceof ApiError ? err.message : t('common:error.generic')),
    });
    e.target.value = '';
  };

  const logoUrl = resolveAssetUrl(company?.logo);

  return (
    <div>
      <PageHeader title={t('companySettings:title')} />

      <div className="mb-4 rounded-lg border border-border bg-surface p-4">
        <p className="mb-3 text-sm font-medium text-ink">{t('companySettings:logo.title')}</p>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded border border-border bg-surface-muted">
            {logoUrl ? <img src={logoUrl} alt={t('companySettings:logo.alt')} className="h-full w-full object-contain" /> : <span className="text-xs text-ink-muted">{t('companySettings:logo.none')}</span>}
          </div>
          <div>
            <button type="button" onClick={() => logoInputRef.current?.click()} disabled={uploadLogoMutation.isPending} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted disabled:opacity-50">
              {uploadLogoMutation.isPending ? t('common:action.processing') : t('companySettings:logo.upload')}
            </button>
            <input ref={logoInputRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/svg+xml" onChange={handleLogoSelected} />
            <p className="mt-1 text-xs text-ink-muted">{t('companySettings:logo.hint')}</p>
          </div>
        </div>
        {logoError && <p className="mt-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{logoError}</p>}
      </div>

      <form onSubmit={handleSave} noValidate className="max-w-2xl rounded-lg border border-border bg-surface p-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('companySettings:fields.name')} htmlFor="name" required>
            <TextInput id="name" value={form.name} onChange={handleField('name')} />
          </FormField>
          <FormField label={t('companySettings:fields.legalName')} htmlFor="legalName">
            <TextInput id="legalName" value={form.legalName} onChange={handleField('legalName')} />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label={t('companySettings:fields.email')} htmlFor="email">
            <TextInput id="email" type="email" value={form.email} onChange={handleField('email')} />
          </FormField>
          <FormField label={t('companySettings:fields.phone')} htmlFor="phone">
            <TextInput id="phone" value={form.phone} onChange={handleField('phone')} />
          </FormField>
        </div>

        <FormField label={t('companySettings:fields.website')} htmlFor="website">
          <TextInput id="website" value={form.website} onChange={handleField('website')} />
        </FormField>

        <FormField label={t('companySettings:fields.address')} htmlFor="address">
          <TextInput id="address" value={form.address} onChange={handleField('address')} />
        </FormField>

        <div className="grid grid-cols-3 gap-3">
          <FormField label={t('companySettings:fields.city')} htmlFor="city">
            <TextInput id="city" value={form.city} onChange={handleField('city')} />
          </FormField>
          <FormField label={t('companySettings:fields.country')} htmlFor="country">
            <TextInput id="country" value={form.country} onChange={handleField('country')} />
          </FormField>
          <FormField label={t('companySettings:fields.taxNumber')} htmlFor="taxNumber">
            <TextInput id="taxNumber" value={form.taxNumber} onChange={handleField('taxNumber')} />
          </FormField>
        </div>

        {saveError && <p className="mt-2 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{saveError}</p>}
        {saveSuccess && <p className="mt-2 rounded bg-success/10 px-3 py-2 text-sm text-success">{t('companySettings:saveSuccess')}</p>}

        <div className="mt-4 flex justify-end">
          <button type="submit" disabled={updateMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
            {updateMutation.isPending ? t('common:action.processing') : t('common:action.save')}
          </button>
        </div>
      </form>

      <MicrosoftIntegrationSection />
    </div>
  );
}

/**
 * Self-contained — its own data fetch, form state, and save
 * action, separate from the main company-details form above since
 * it's an independent concern with an independent save button.
 */
function MicrosoftIntegrationSection() {
  const { t } = useTranslation(['companySettings', 'common']);
  const { data: settings, isLoading } = useMicrosoftIntegrationSettings();
  const updateMutation = useUpdateMicrosoftIntegrationSettings();

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (settings) setClientId(settings.clientId ?? '');
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);
    updateMutation.mutate(
      { clientId, clientSecret: clientSecret || undefined },
      {
        onSuccess: () => {
          setSaveSuccess(true);
          setClientSecret(''); // never keep the plaintext secret sitting in form state after a successful save
        },
        onError: (err) => setSaveError(err instanceof ApiError ? err.message : t('common:error.generic')),
      },
    );
  };

  if (isLoading) return null;

  return (
    <div className="mt-6 max-w-2xl rounded-lg border border-border bg-surface p-4">
      <p className="mb-1 text-sm font-medium text-ink">{t('companySettings:microsoft.title')}</p>
      <p className="mb-4 text-xs text-ink-muted">{t('companySettings:microsoft.description')}</p>

      <form onSubmit={handleSubmit} noValidate>
        <FormField label={t('companySettings:microsoft.clientId')} htmlFor="microsoftClientId" required>
          <TextInput id="microsoftClientId" value={clientId} onChange={(e) => setClientId(e.target.value)} required />
        </FormField>

        <FormField
          label={t('companySettings:microsoft.clientSecret')}
          htmlFor="microsoftClientSecret"
          hint={settings?.secretConfigured ? t('companySettings:microsoft.secretConfiguredHint') : t('companySettings:microsoft.secretNotConfiguredHint')}
        >
          <TextInput
            id="microsoftClientSecret"
            type="password"
            placeholder={settings?.secretConfigured ? '••••••••••••••••' : ''}
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            autoComplete="new-password"
          />
        </FormField>

        {saveError && <p className="mt-2 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{saveError}</p>}
        {saveSuccess && <p className="mt-2 rounded bg-success/10 px-3 py-2 text-sm text-success">{t('companySettings:saveSuccess')}</p>}

        <div className="mt-4 flex justify-end">
          <button type="submit" disabled={updateMutation.isPending} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50">
            {updateMutation.isPending ? t('common:action.processing') : t('common:action.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
