import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { encryptCredential, decryptCredential } from '../../common/utils/credentials-encryption.util';
import { UpdatePlatformStorageSettingsDto } from './dto/update-platform-storage-settings.dto';

const SINGLETON_ID = '00000000-0000-0000-0000-00000000005f';

export interface ResolvedStorageSettings {
  storageDriver: 'local' | 's3';
  s3Region: string | null;
  s3Bucket: string | null;
  s3AccessKeyId: string | null;
  s3SecretAccessKey: string | null;
  s3Endpoint: string | null;
  s3ForcePathStyle: boolean;
}

@Injectable()
export class PlatformStorageSettingsService {
  constructor(private prisma: PrismaService) {}

  private async getRow() {
    return this.prisma.platformStorageSettings.findUniqueOrThrow({ where: { id: SINGLETON_ID } });
  }

  /** Never returns the secret in any form — only whether one is currently stored. */
  async get() {
    const row = await this.getRow();
    return {
      storageDriver: row.storageDriver,
      s3Region: row.s3Region,
      s3Bucket: row.s3Bucket,
      s3AccessKeyId: row.s3AccessKeyId,
      s3SecretAccessKeySet: !!row.s3SecretAccessKeyEncrypted,
      s3Endpoint: row.s3Endpoint,
      s3ForcePathStyle: row.s3ForcePathStyle,
    };
  }

  async update(dto: UpdatePlatformStorageSettingsDto) {
    const existing = await this.getRow();

    if (dto.storageDriver === 's3') {
      const willHaveRegion = dto.s3Region ?? existing.s3Region;
      const willHaveBucket = dto.s3Bucket ?? existing.s3Bucket;
      const willHaveAccessKeyId = dto.s3AccessKeyId ?? existing.s3AccessKeyId;
      const willHaveSecret = dto.s3SecretAccessKey ? true : !!existing.s3SecretAccessKeyEncrypted;

      if (!willHaveRegion || !willHaveBucket || !willHaveAccessKeyId || !willHaveSecret) {
        throw new UnprocessableEntityException(
          'Switching to S3 requires a region, bucket, access key ID, and secret access key — either provided now or already saved.',
        );
      }
    }

    await this.prisma.platformStorageSettings.update({
      where: { id: SINGLETON_ID },
      data: {
        storageDriver: dto.storageDriver,
        s3Region: dto.s3Region,
        s3Bucket: dto.s3Bucket,
        s3AccessKeyId: dto.s3AccessKeyId,
        ...(dto.s3SecretAccessKey ? { s3SecretAccessKeyEncrypted: encryptCredential(dto.s3SecretAccessKey) } : {}),
        s3Endpoint: dto.s3Endpoint,
        s3ForcePathStyle: dto.s3ForcePathStyle,
      },
    });

    return this.get();
  }

  /**
   * INTERNAL ONLY — the sole path that ever decrypts the secret.
   * Never called from a controller; only from the storage
   * provider resolution logic that actually needs to authenticate
   * to S3.
   */
  async getDecryptedForInternalUse(): Promise<ResolvedStorageSettings> {
    const row = await this.getRow();
    return {
      storageDriver: row.storageDriver as 'local' | 's3',
      s3Region: row.s3Region,
      s3Bucket: row.s3Bucket,
      s3AccessKeyId: row.s3AccessKeyId,
      s3SecretAccessKey: row.s3SecretAccessKeyEncrypted ? decryptCredential(row.s3SecretAccessKeyEncrypted) : null,
      s3Endpoint: row.s3Endpoint,
      s3ForcePathStyle: row.s3ForcePathStyle,
    };
  }
}
