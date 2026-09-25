import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useZatcaCertificates,
  useGenerateZatcaCsr,
  useRequestZatcaComplianceCsid,
  useRequestZatcaProductionCsid,
} from '../../../api/queries/useZatca';
import { PageHeader } from '../../../components/PageHeader/PageHeader';
import { LoadingState } from '../../../components/LoadingState/LoadingState';
import { ErrorState } from '../../../components/ErrorState/ErrorState';
import { EmptyState } from '../../../components/EmptyState/EmptyState';
import { PermissionGate } from '../../../rbac/PermissionGate';
import { PERMISSIONS } from '../../../rbac/permissionConstants';
import { ApiError } from '../../../api/client';
import type { ZatcaCsidType } from '../../../types/entities/zatca';

export function ZatcaOnboardingPage() {
  const { t } = useTranslation(['zatca', 'common']);
  const { data: certificates, isLoading, error } = useZatcaCertificates();
  const generateCsrMutation = useGenerateZatcaCsr();
  const complianceCsidMutation = useRequestZatcaComplianceCsid();
  const productionCsidMutation = useRequestZatcaProductionCsid();

  const [csrModalOpen, setCsrModalOpen] = useState(false);
  const [csrType, setCsrType] = useState<ZatcaCsidType>('compliance');
  const [organizationUnitName, setOrganizationUnitName] = useState('');
  const [csrResultPem, setCsrResultPem] = useState<string | null>(null);
  const [csrError, setCsrError] = useState<string | null>(null);

  const [otpModalCertId, setOtpModalCertId] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  const [productionError, setProductionError] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title={t('zatca:title')}
        action={
          <PermissionGate requires={PERMISSIONS.Finance.zatca.manage}>
            <button
              type="button"
              onClick={() => { setCsrType('compliance'); setOrganizationUnitName(''); setCsrResultPem(null); setCsrError(null); setCsrModalOpen(true); }}
              className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90"
            >
              {t('zatca:action.generateCsr')}
            </button>
          </PermissionGate>
        }
      />

      <div className="mb-6 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-ink">
        <p className="font-medium">{t('zatca:disclosure.title')}</p>
        <p className="mt-1 text-ink-muted">{t('zatca:disclosure.body')}</p>
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error instanceof ApiError ? error.message : undefined} />}
      {certificates && certificates.length === 0 && <EmptyState title={t('zatca:empty')} />}

      {certificates && certificates.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-start text-sm">
            <thead className="bg-surface-muted text-xs uppercase text-ink-muted">
              <tr>
                <th className="p-3 text-start">{t('zatca:fields.csidType')}</th>
                <th className="p-3 text-start">{t('zatca:fields.status')}</th>
                <th className="p-3 text-start">{t('zatca:fields.issuedAt')}</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {certificates.map((cert) => (
                <tr key={cert.id}>
                  <td className="p-3 font-medium text-ink">{t(`zatca:csidType.${cert.csidType}`)}</td>
                  <td className="p-3">
                    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-ink-muted">
                      {t(`zatca:status.${cert.status}`)}
                    </span>
                  </td>
                  <td className="p-3 text-ink-muted">{cert.issuedAt ? new Date(cert.issuedAt).toLocaleDateString() : '—'}</td>
                  <td className="p-3 text-end">
                    <PermissionGate requires={PERMISSIONS.Finance.zatca.manage}>
                      {cert.csidType === 'compliance' && cert.status === 'pending_csr' && (
                        <button
                          type="button"
                          onClick={() => { setOtpModalCertId(cert.id); setOtp(''); setOtpError(null); }}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          {t('zatca:action.submitOtp')}
                        </button>
                      )}
                      {cert.csidType === 'compliance' && cert.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => {
                            setProductionError(null);
                            productionCsidMutation.mutate(cert.id, {
                              onError: (err) => setProductionError(err instanceof ApiError ? err.message : t('common:error.generic')),
                            });
                          }}
                          disabled={productionCsidMutation.isPending}
                          className="text-sm font-medium text-primary hover:underline disabled:opacity-50"
                        >
                          {t('zatca:action.requestProductionCsid')}
                        </button>
                      )}
                    </PermissionGate>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {productionError && <p className="mt-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{productionError}</p>}

      {csrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-surface p-4 shadow-lg">
            <h2 className="mb-3 text-sm font-medium text-ink">{t('zatca:action.generateCsr')}</h2>

            {!csrResultPem ? (
              <>
                <div className="mb-3">
                  <label className="mb-1 block text-xs font-medium text-ink-muted">{t('zatca:fields.csidType')}</label>
                  <select value={csrType} onChange={(e) => setCsrType(e.target.value as ZatcaCsidType)} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink">
                    <option value="compliance">{t('zatca:csidType.compliance')}</option>
                    <option value="production">{t('zatca:csidType.production')}</option>
                  </select>
                </div>
                <div className="mb-3">
                  <label className="mb-1 block text-xs font-medium text-ink-muted">{t('zatca:fields.organizationUnitName')}</label>
                  <input
                    type="text"
                    value={organizationUnitName}
                    onChange={(e) => setOrganizationUnitName(e.target.value)}
                    className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink"
                  />
                </div>
                {csrError && <p className="mb-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{csrError}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setCsrModalOpen(false)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
                    {t('common:action.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCsrError(null);
                      generateCsrMutation.mutate(
                        { csidType: csrType, organizationUnitName },
                        {
                          onSuccess: (result) => setCsrResultPem(result.csrPem),
                          onError: (err) => setCsrError(err instanceof ApiError ? err.message : t('common:error.generic')),
                        },
                      );
                    }}
                    disabled={generateCsrMutation.isPending || !organizationUnitName}
                    className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50"
                  >
                    {generateCsrMutation.isPending ? t('common:action.processing') : t('common:action.save')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-2 text-xs text-ink-muted">{t('zatca:csrResultHint')}</p>
                <textarea readOnly value={csrResultPem} rows={10} className="mb-3 w-full rounded border border-border bg-surface-muted p-2 font-mono text-xs text-ink" />
                <div className="flex justify-end">
                  <button type="button" onClick={() => setCsrModalOpen(false)} className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90">
                    {t('common:action.close')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {otpModalCertId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-surface p-4 shadow-lg">
            <h2 className="mb-3 text-sm font-medium text-ink">{t('zatca:action.submitOtp')}</h2>
            <p className="mb-3 text-xs text-ink-muted">{t('zatca:otpHint')}</p>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="mb-3 w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink"
            />
            {otpError && <p className="mb-3 rounded bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{otpError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOtpModalCertId(null)} className="rounded border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
                {t('common:action.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOtpError(null);
                  complianceCsidMutation.mutate(
                    { certificateId: otpModalCertId, otp },
                    {
                      onSuccess: () => setOtpModalCertId(null),
                      onError: (err) => setOtpError(err instanceof ApiError ? err.message : t('common:error.generic')),
                    },
                  );
                }}
                disabled={complianceCsidMutation.isPending || !otp}
                className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50"
              >
                {complianceCsidMutation.isPending ? t('common:action.processing') : t('common:action.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
