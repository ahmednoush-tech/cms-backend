import { Injectable } from '@nestjs/common';
import { StorageProvider, DownloadTarget } from './storage-provider.interface';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';
import { S3StorageProvider } from './s3-storage.provider';
import { PlatformStorageSettingsService } from './platform-storage-settings.service';

/**
 * The ONLY class actually registered as STORAGE_PROVIDER with
 * NestJS DI — every other provider file (LocalDiskStorageProvider,
 * S3StorageProvider) is a plain, DI-agnostic implementation this
 * class delegates to. Re-reads settings from the database on
 * EVERY call rather than caching them at construction time: a
 * platform admin switching storageDriver through the settings UI
 * takes effect on the very next upload/download/delete, with no
 * server restart. The local-disk delegate has no dynamic config,
 * so it's safely reused across calls; the S3 delegate needs
 * current (possibly just-changed) credentials, so a fresh instance
 * is built per call.
 */
@Injectable()
export class DynamicStorageProvider implements StorageProvider {
  private readonly localProvider = new LocalDiskStorageProvider();

  constructor(private settingsService: PlatformStorageSettingsService) {}

  private async resolveDelegate(): Promise<StorageProvider> {
    const settings = await this.settingsService.getDecryptedForInternalUse();
    if (settings.storageDriver === 's3') {
      return new S3StorageProvider(settings);
    }
    return this.localProvider;
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    const delegate = await this.resolveDelegate();
    return delegate.upload(key, buffer, mimeType);
  }

  async getDownloadTarget(key: string): Promise<DownloadTarget> {
    const delegate = await this.resolveDelegate();
    return delegate.getDownloadTarget(key);
  }

  async delete(key: string): Promise<void> {
    const delegate = await this.resolveDelegate();
    return delegate.delete(key);
  }
}
