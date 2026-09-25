import { Module } from '@nestjs/common';
import { STORAGE_PROVIDER } from './storage-provider.interface';
import { DynamicStorageProvider } from './dynamic-storage.provider';
import { PlatformStorageSettingsService } from './platform-storage-settings.service';
import { PlatformAdminStorageSettingsController } from './platform-admin-storage-settings.controller';

/**
 * STORAGE_PROVIDER now resolves to DynamicStorageProvider, which
 * checks PlatformStorageSettingsService (database-backed, admin-
 * editable) on every call — see DynamicStorageProvider's own
 * comment for why. A fresh install with no admin action still
 * defaults to local disk, matching this system's original
 * behavior (see migration 093's seed row).
 */
@Module({
  controllers: [PlatformAdminStorageSettingsController],
  providers: [PlatformStorageSettingsService, DynamicStorageProvider, { provide: STORAGE_PROVIDER, useExisting: DynamicStorageProvider }],
  exports: [STORAGE_PROVIDER, PlatformStorageSettingsService],
})
export class StorageModule {}
