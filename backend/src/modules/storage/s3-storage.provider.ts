import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageProvider, DownloadTarget } from './storage-provider.interface';
import { ResolvedStorageSettings } from './platform-storage-settings.service';

/** How long a download link stays valid after being issued — long enough for a browser to start the download, short enough that a leaked/logged URL is useless soon after. */
const PRESIGNED_URL_EXPIRY_SECONDS = 300;

/**
 * Works with real AWS S3 AND any S3-compatible service (MinIO,
 * DigitalOcean Spaces, Cloudflare R2, etc.) via a configurable
 * endpoint — this is standard AWS SDK v3 behavior, not a
 * special-cased workaround.
 *
 * Constructed fresh, per use, by DynamicStorageProvider with the
 * CURRENT database-stored settings (see
 * PlatformStorageSettingsService) — not a NestJS-managed singleton
 * anymore. This is deliberate: settings can change at runtime via
 * the platform-admin UI, and a boot-time-only singleton would keep
 * using stale (or missing) credentials until the process restarts.
 * Constructing an S3Client per call has a real but small cost
 * (object creation, not a network round-trip) that's acceptable
 * for file upload/download frequency.
 *
 * OPERATIONAL REQUIREMENT — bucket CORS: the existing frontend
 * download flow (attachments.ts's download()) fetches this
 * endpoint via an authenticated XHR with responseType: 'blob', and
 * the browser follows the resulting redirect to this presigned URL
 * automatically — no frontend code change was needed for that part.
 * But the browser still enforces CORS on the FINAL (S3) response
 * before letting that XHR read the blob body, since it's a
 * cross-origin request. The bucket's CORS configuration must allow
 * GET from the frontend's origin(s), e.g.:
 *   AllowedMethods: ["GET"], AllowedOrigins: ["https://your-app-domain"]
 * Without this, downloads will fail with a CORS error even though
 * the presigned URL itself is valid. (The original Authorization
 * header is NOT resent to S3 on this cross-origin redirect — that
 * part needs no bucket-side accommodation.)
 */
export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(settings: ResolvedStorageSettings) {
    if (!settings.s3Region || !settings.s3Bucket || !settings.s3AccessKeyId || !settings.s3SecretAccessKey) {
      throw new Error('S3StorageProvider requires region, bucket, access key ID, and secret access key to be configured.');
    }

    this.bucket = settings.s3Bucket;
    this.client = new S3Client({
      region: settings.s3Region,
      credentials: { accessKeyId: settings.s3AccessKeyId, secretAccessKey: settings.s3SecretAccessKey },
      ...(settings.s3Endpoint ? { endpoint: settings.s3Endpoint } : {}),
      forcePathStyle: settings.s3ForcePathStyle,
    });
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: buffer, ContentType: mimeType }));
  }

  async getDownloadTarget(key: string): Promise<DownloadTarget> {
    const url = await getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
    });
    return { kind: 'redirect', url };
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      // Mirrors LocalDiskStorageProvider: a storage-side inconsistency must never block deleting the DB row.
    }
  }
}
