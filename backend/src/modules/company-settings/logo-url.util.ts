/**
 * company.logo now stores a STORAGE KEY (e.g. 'logos/<company
 * id>-<uuid>.png'), not a directly servable path — see
 * CompanySettingsService.uploadLogo's comment for why (the old
 * direct-path-to-local-disk design didn't work behind a load
 * balancer with more than one app instance, or with S3 storage at
 * all, since a stored key needs the storage provider to resolve
 * it and S3's presigned URLs expire).
 *
 * Every place that returns a company's logo to a client must
 * convert the stored key to this stable, publicly reachable path
 * INSTEAD of returning the raw key — the actual file is served by
 * PublicCompanyInfoController's logo endpoint, which resolves the
 * key against the storage provider fresh on every request (a
 * redirect to a newly-signed S3 URL, or a direct local-disk
 * stream). This function is the only place that builds that path,
 * so every caller stays in sync if the route ever moves.
 */
export function logoStorageKeyToPublicPath(companyId: string, logoKey: string | null): string | null {
  if (!logoKey) return null;
  return `/api/v1/public/company-info/${companyId}/logo`;
}

/**
 * Local-disk and S3 storage don't track a MIME type per object —
 * only the raw bytes and a key. Rather than add a schema column
 * for a value we already know at write time (ALLOWED_LOGO_MIME_TYPES
 * in company-settings.service.ts is a closed, small set), the
 * content type is inferred from the key's own extension at serve
 * time. Keep this in sync with ALLOWED_LOGO_MIME_TYPES.
 */
export function inferLogoMimeType(logoKey: string): string {
  const ext = logoKey.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    case 'jpg':
    case 'jpeg':
    default:
      return 'image/jpeg';
  }
}
