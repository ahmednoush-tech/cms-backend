/**
 * A download target is one of two shapes: a local file path to
 * stream directly (local disk), or a URL to redirect the client
 * to (S3 — a short-lived presigned URL, so the app server never
 * proxies the file's bytes itself). The controller branches on
 * `kind` and handles each accordingly.
 */
export type DownloadTarget = { kind: 'stream'; filePath: string } | { kind: 'redirect'; url: string };

export interface StorageProvider {
  /** key is the FULL relative path this provider should store the file under, e.g. `${companyId}/${storedFileName}` — callers never construct absolute paths or bucket URLs themselves. */
  upload(key: string, buffer: Buffer, mimeType: string): Promise<void>;

  getDownloadTarget(key: string): Promise<DownloadTarget>;

  /** Must not throw if the underlying object is already missing — deleting the DB row must never be blocked by a storage-side inconsistency. */
  delete(key: string): Promise<void>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
