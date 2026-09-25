import { Test } from '@nestjs/testing';
import { UnprocessableEntityException } from '@nestjs/common';
import { PlatformStorageSettingsService } from './platform-storage-settings.service';
import { PrismaService } from '../../prisma/prisma.service';

jest.mock('../../common/utils/credentials-encryption.util', () => ({
  encryptCredential: jest.fn((plaintext: string) => `ENCRYPTED(${plaintext})`),
  decryptCredential: jest.fn((stored: string) => stored.replace('ENCRYPTED(', '').replace(')', '')),
}));

describe('PlatformStorageSettingsService', () => {
  let service: PlatformStorageSettingsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { platformStorageSettings: { findUniqueOrThrow: jest.fn(), update: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [PlatformStorageSettingsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(PlatformStorageSettingsService);
  });

  describe('get', () => {
    it('never returns the secret in any form — only whether one is set', async () => {
      prisma.platformStorageSettings.findUniqueOrThrow.mockResolvedValue({
        storageDriver: 's3',
        s3Region: 'us-east-1',
        s3Bucket: 'bucket',
        s3AccessKeyId: 'key',
        s3SecretAccessKeyEncrypted: 'ENCRYPTED(super-secret-value)',
        s3Endpoint: null,
        s3ForcePathStyle: false,
      });

      const result = await service.get();

      expect(JSON.stringify(result)).not.toContain('super-secret-value');
      expect(result.s3SecretAccessKeySet).toBe(true);
      expect((result as any).s3SecretAccessKeyEncrypted).toBeUndefined();
      expect((result as any).s3SecretAccessKey).toBeUndefined();
    });

    it('reports s3SecretAccessKeySet as false when nothing has ever been saved', async () => {
      prisma.platformStorageSettings.findUniqueOrThrow.mockResolvedValue({
        storageDriver: 'local',
        s3Region: null,
        s3Bucket: null,
        s3AccessKeyId: null,
        s3SecretAccessKeyEncrypted: null,
        s3Endpoint: null,
        s3ForcePathStyle: false,
      });

      const result = await service.get();

      expect(result.s3SecretAccessKeySet).toBe(false);
    });
  });

  describe('update', () => {
    const existingS3Row = {
      storageDriver: 's3',
      s3Region: 'us-east-1',
      s3Bucket: 'existing-bucket',
      s3AccessKeyId: 'existing-key',
      s3SecretAccessKeyEncrypted: 'ENCRYPTED(existing-secret)',
      s3Endpoint: null,
      s3ForcePathStyle: false,
    };

    it('rejects switching to S3 when no secret has ever been saved and none is provided now', async () => {
      prisma.platformStorageSettings.findUniqueOrThrow.mockResolvedValue({
        storageDriver: 'local',
        s3Region: null,
        s3Bucket: null,
        s3AccessKeyId: null,
        s3SecretAccessKeyEncrypted: null,
        s3Endpoint: null,
        s3ForcePathStyle: false,
      });

      await expect(
        service.update({ storageDriver: 's3', s3Region: 'us-east-1', s3Bucket: 'b', s3AccessKeyId: 'k' }),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.platformStorageSettings.update).not.toHaveBeenCalled();
    });

    it('allows switching to S3 using an ALREADY-saved secret when the update omits a new one', async () => {
      prisma.platformStorageSettings.findUniqueOrThrow.mockResolvedValue(existingS3Row);
      prisma.platformStorageSettings.update.mockResolvedValue(existingS3Row);

      await service.update({ storageDriver: 's3', s3Region: 'us-east-1', s3Bucket: 'existing-bucket', s3AccessKeyId: 'existing-key' });

      const call = prisma.platformStorageSettings.update.mock.calls[0][0];
      expect('s3SecretAccessKeyEncrypted' in call.data).toBe(false);
    });

    it('encrypts and stores a NEW secret when one is explicitly provided', async () => {
      prisma.platformStorageSettings.findUniqueOrThrow.mockResolvedValue(existingS3Row);
      prisma.platformStorageSettings.update.mockResolvedValue(existingS3Row);

      await service.update({
        storageDriver: 's3',
        s3Region: 'us-east-1',
        s3Bucket: 'existing-bucket',
        s3AccessKeyId: 'existing-key',
        s3SecretAccessKey: 'brand-new-secret',
      });

      const call = prisma.platformStorageSettings.update.mock.calls[0][0];
      expect(call.data.s3SecretAccessKeyEncrypted).toBe('ENCRYPTED(brand-new-secret)');
    });

    it('allows switching to "local" with no S3 fields at all', async () => {
      prisma.platformStorageSettings.findUniqueOrThrow.mockResolvedValue(existingS3Row);
      prisma.platformStorageSettings.update.mockResolvedValue({ ...existingS3Row, storageDriver: 'local' });

      await expect(service.update({ storageDriver: 'local' })).resolves.toBeDefined();
      expect(prisma.platformStorageSettings.update).toHaveBeenCalled();
    });
  });

  describe('getDecryptedForInternalUse', () => {
    it('is the only method that returns the actual plaintext secret', async () => {
      prisma.platformStorageSettings.findUniqueOrThrow.mockResolvedValue({
        storageDriver: 's3',
        s3Region: 'us-east-1',
        s3Bucket: 'bucket',
        s3AccessKeyId: 'key',
        s3SecretAccessKeyEncrypted: 'ENCRYPTED(my-real-secret)',
        s3Endpoint: null,
        s3ForcePathStyle: false,
      });

      const result = await service.getDecryptedForInternalUse();

      expect(result.s3SecretAccessKey).toBe('my-real-secret');
    });

    it('returns null (not an error) when no secret has ever been saved', async () => {
      prisma.platformStorageSettings.findUniqueOrThrow.mockResolvedValue({
        storageDriver: 'local',
        s3Region: null,
        s3Bucket: null,
        s3AccessKeyId: null,
        s3SecretAccessKeyEncrypted: null,
        s3Endpoint: null,
        s3ForcePathStyle: false,
      });

      const result = await service.getDecryptedForInternalUse();

      expect(result.s3SecretAccessKey).toBeNull();
    });
  });
});
