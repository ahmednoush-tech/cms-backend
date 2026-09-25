import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  usePlatformSettingsPublic,
  useUpdatePlatformSettings,
  useUploadPlatformLogo,
  usePlatformStorageSettings,
  useUpdatePlatformStorageSettings,
} from '../../api/queries/usePlatformSettings';
import { ApiError } from '../../api/client';
import type { StorageDriver } from '../../types/entities/platformSettings';

export function PlatformAdminSettingsPage() {
  const navigate = useNavigate();
  const { data: settings, isLoading } = usePlatformSettingsPublic();
  const updateMutation = useUpdatePlatformSettings();
  const uploadLogoMutation = useUploadPlatformLogo();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [productName, setProductName] = useState('');
  const [productTagline, setProductTagline] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { data: storageSettings, isLoading: storageLoading } = usePlatformStorageSettings();
  const updateStorageMutation = useUpdatePlatformStorageSettings();
  const [storageDriver, setStorageDriver] = useState<StorageDriver>('local');
  const [s3Region, setS3Region] = useState('');
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3AccessKeyId, setS3AccessKeyId] = useState('');
  const [s3SecretAccessKey, setS3SecretAccessKey] = useState('');
  const [s3Endpoint, setS3Endpoint] = useState('');
  const [s3ForcePathStyle, setS3ForcePathStyle] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [storageSuccess, setStorageSuccess] = useState(false);

  useEffect(() => {
    if (settings) {
      setProductName(settings.productName);
      setProductTagline(settings.productTagline ?? '');
    }
  }, [settings]);

  useEffect(() => {
    if (storageSettings) {
      setStorageDriver(storageSettings.storageDriver);
      setS3Region(storageSettings.s3Region ?? '');
      setS3Bucket(storageSettings.s3Bucket ?? '');
      setS3AccessKeyId(storageSettings.s3AccessKeyId ?? '');
      setS3Endpoint(storageSettings.s3Endpoint ?? '');
      setS3ForcePathStyle(storageSettings.s3ForcePathStyle);
      // s3SecretAccessKey is deliberately NEVER pre-filled — the API never returns the actual secret (see PlatformStorageSettingsService.get()), only whether one is set.
    }
  }, [storageSettings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    updateMutation.mutate(
      { productName, productTagline: productTagline || undefined },
      {
        onSuccess: () => setSuccess(true),
        onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong.'),
      },
    );
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    uploadLogoMutation.mutate(file, {
      onError: (err) => setError(err instanceof ApiError ? err.message : 'Logo upload failed.'),
    });
  };

  const handleStorageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStorageError(null);
    setStorageSuccess(false);
    updateStorageMutation.mutate(
      {
        storageDriver,
        s3Region: s3Region || undefined,
        s3Bucket: s3Bucket || undefined,
        s3AccessKeyId: s3AccessKeyId || undefined,
        s3SecretAccessKey: s3SecretAccessKey || undefined,
        s3Endpoint: s3Endpoint || undefined,
        s3ForcePathStyle,
      },
      {
        onSuccess: () => {
          setStorageSuccess(true);
          setS3SecretAccessKey(''); // clear the input — never keep a plaintext secret sitting in form state after a successful save
        },
        onError: (err) => setStorageError(err instanceof ApiError ? err.message : 'Something went wrong.'),
      },
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <div className="border-b border-slate-700 px-6 py-4">
        <button type="button" onClick={() => navigate('/platform-admin/companies')} className="text-sm text-slate-400 hover:text-slate-200">
          ← Back to companies
        </button>
      </div>

      <div className="mx-auto max-w-lg p-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Internal Only</p>
        <h1 className="mt-1 text-lg font-semibold">Mizan Product Settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Changes here appear on every screen in the app — every company's login page, sidebar header bar, and more.
        </p>

        {isLoading ? (
          <p className="mt-6 text-sm text-slate-400">Loading…</p>
        ) : (
          <>
            <div className="mt-6 rounded-lg border border-slate-700 bg-slate-800 p-6">
              <p className="mb-3 text-sm font-medium text-slate-300">Logo</p>
              <div className="flex items-center gap-4">
                {settings?.logoUrl ? (
                  <img src={settings.logoUrl} alt="Current logo" className="h-12 w-12 rounded border border-slate-600 bg-slate-900 object-contain p-1" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded border border-dashed border-slate-600 text-xs text-slate-500">
                    None
                  </div>
                )}
                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadLogoMutation.isPending}
                    className="rounded border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                  >
                    {uploadLogoMutation.isPending ? 'Uploading…' : 'Upload new logo'}
                  </button>
                  <p className="mt-1 text-xs text-slate-500">JPEG, PNG, WebP, or SVG — up to 2 MB.</p>
                </div>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" onChange={handleLogoChange} className="hidden" />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 rounded-lg border border-slate-700 bg-slate-800 p-6" noValidate>
              <div className="mb-4">
                <label className="mb-1 block text-xs font-medium text-slate-400">Product name</label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
              </div>
              <div className="mb-4">
                <label className="mb-1 block text-xs font-medium text-slate-400">Tagline</label>
                <input
                  type="text"
                  value={productTagline}
                  onChange={(e) => setProductTagline(e.target.value)}
                  className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
              </div>

              {error && <p className="mb-4 rounded bg-red-900/40 px-3 py-2 text-sm text-red-300" role="alert">{error}</p>}
              {success && <p className="mb-4 rounded bg-emerald-900/40 px-3 py-2 text-sm text-emerald-300">Saved.</p>}

              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="rounded bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          </>
        )}

        <div className="mt-8 border-t border-slate-700 pt-8">
          <h2 className="text-lg font-semibold">File Storage</h2>
          <p className="mt-1 text-sm text-slate-400">
            Shared by every company on the platform — switching to S3 takes effect immediately for new uploads, with no server restart.
          </p>

          {storageLoading ? (
            <p className="mt-6 text-sm text-slate-400">Loading…</p>
          ) : (
            <form onSubmit={handleStorageSubmit} className="mt-6 rounded-lg border border-slate-700 bg-slate-800 p-6" noValidate>
              <div className="mb-4">
                <label className="mb-1 block text-xs font-medium text-slate-400">Storage driver</label>
                <div className="flex gap-2">
                  {(['local', 's3'] as StorageDriver[]).map((driver) => (
                    <button
                      key={driver}
                      type="button"
                      onClick={() => setStorageDriver(driver)}
                      className={`rounded border px-3 py-1.5 text-sm font-medium ${
                        storageDriver === driver ? 'border-slate-100 bg-slate-100 text-slate-900' : 'border-slate-600 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {driver === 'local' ? 'Local disk' : 'S3-compatible'}
                    </button>
                  ))}
                </div>
                {storageDriver === 'local' && (
                  <p className="mt-2 text-xs text-slate-500">
                    Files live on this server's own disk. Fine for a single-instance deployment; does not work correctly behind a load balancer with more than one app instance.
                  </p>
                )}
              </div>

              {storageDriver === 's3' && (
                <>
                  <div className="mb-4 grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-400">Region</label>
                      <input
                        type="text"
                        value={s3Region}
                        onChange={(e) => setS3Region(e.target.value)}
                        placeholder="us-east-1"
                        className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-400">Bucket</label>
                      <input
                        type="text"
                        value={s3Bucket}
                        onChange={(e) => setS3Bucket(e.target.value)}
                        className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                      />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="mb-1 block text-xs font-medium text-slate-400">Access key ID</label>
                    <input
                      type="text"
                      value={s3AccessKeyId}
                      onChange={(e) => setS3AccessKeyId(e.target.value)}
                      className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="mb-1 block text-xs font-medium text-slate-400">Secret access key</label>
                    <input
                      type="password"
                      value={s3SecretAccessKey}
                      onChange={(e) => setS3SecretAccessKey(e.target.value)}
                      placeholder={storageSettings?.s3SecretAccessKeySet ? '••••••••  (already saved — leave blank to keep it)' : ''}
                      className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="mb-1 block text-xs font-medium text-slate-400">Endpoint (optional — for MinIO, DigitalOcean Spaces, Cloudflare R2, etc.)</label>
                    <input
                      type="text"
                      value={s3Endpoint}
                      onChange={(e) => setS3Endpoint(e.target.value)}
                      placeholder="https://s3.us-east-1.amazonaws.com (leave blank for real AWS S3)"
                      className="w-full rounded border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                    />
                  </div>
                  <label className="mb-4 flex items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" checked={s3ForcePathStyle} onChange={(e) => setS3ForcePathStyle(e.target.checked)} />
                    Use path-style addressing (required by some providers, e.g. MinIO)
                  </label>
                </>
              )}

              {storageError && <p className="mb-4 rounded bg-red-900/40 px-3 py-2 text-sm text-red-300" role="alert">{storageError}</p>}
              {storageSuccess && <p className="mb-4 rounded bg-emerald-900/40 px-3 py-2 text-sm text-emerald-300">Saved.</p>}

              <button
                type="submit"
                disabled={updateStorageMutation.isPending}
                className="rounded bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white disabled:opacity-50"
              >
                {updateStorageMutation.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
