import { Injectable } from '@nestjs/common';
import { join, dirname } from 'path';
import { promises as fs } from 'fs';
import { StorageProvider, DownloadTarget } from './storage-provider.interface';

const UPLOAD_ROOT = join(process.cwd(), 'uploads');

/**
 * The default/dev provider — unchanged behavior from before this
 * refactor. Chosen when STORAGE_DRIVER is unset or 'local'.
 * Carries the SAME known limitation disclosed earlier: files live
 * on this one server's disk, so this does not work correctly
 * behind a load balancer with more than one app instance, and has
 * no built-in redundancy. Use the S3 provider for anything beyond
 * local development or a genuinely single-instance deployment.
 */
@Injectable()
export class LocalDiskStorageProvider implements StorageProvider {
  async upload(key: string, buffer: Buffer): Promise<void> {
    const fullPath = join(UPLOAD_ROOT, key);
    await fs.mkdir(dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
  }

  async getDownloadTarget(key: string): Promise<DownloadTarget> {
    return { kind: 'stream', filePath: join(UPLOAD_ROOT, key) };
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(join(UPLOAD_ROOT, key));
    } catch {
      // Already missing on disk — never block a DB-row delete on a storage-side inconsistency.
    }
  }
}
