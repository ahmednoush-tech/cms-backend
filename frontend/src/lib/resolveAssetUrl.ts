const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? '';

/**
 * `company.logo` from the API is always a backend-relative path
 * — a public serving endpoint like
 * `/api/v1/public/company-info/<id>/logo`, not a directly-servable
 * static file path (see backend's logo-url.util.ts: the actual
 * file may live on local disk or S3, resolved fresh on every
 * request) — never a full URL, since the backend doesn't know its
 * own public origin at write time. This is the ONE place that
 * turns it into something an <img src> (or html2canvas, for the
 * PDF generators) can actually load, respecting whichever topology
 * VITE_API_ORIGIN describes.
 */
export function resolveAssetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${API_ORIGIN}${path}`;
}
