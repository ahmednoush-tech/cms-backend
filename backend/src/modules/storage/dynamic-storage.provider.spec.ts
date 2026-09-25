import { Test } from '@nestjs/testing';
import { DynamicStorageProvider } from './dynamic-storage.provider';
import { PlatformStorageSettingsService } from './platform-storage-settings.service';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn().mockResolvedValue({}) })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://bucket.s3.example.com/signed-url'),
}));

describe('DynamicStorageProvider', () => {
  let provider: DynamicStorageProvider;
  let settingsService: any;

  beforeEach(async () => {
    settingsService = { getDecryptedForInternalUse: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [DynamicStorageProvider, { provide: PlatformStorageSettingsService, useValue: settingsService }],
    }).compile();
    provider = moduleRef.get(DynamicStorageProvider);
  });

  it('delegates to local disk behavior when the current driver is "local"', async () => {
    settingsService.getDecryptedForInternalUse.mockResolvedValue({ storageDriver: 'local' });

    const target = await provider.getDownloadTarget('company-1/abc.pdf');

    expect(target.kind).toBe('stream');
  });

  it('delegates to S3 (a redirect target) when the current driver is "s3"', async () => {
    settingsService.getDecryptedForInternalUse.mockResolvedValue({
      storageDriver: 's3',
      s3Region: 'us-east-1',
      s3Bucket: 'bucket',
      s3AccessKeyId: 'key',
      s3SecretAccessKey: 'secret',
      s3Endpoint: null,
      s3ForcePathStyle: false,
    });

    const target = await provider.getDownloadTarget('company-1/abc.pdf');

    expect(target.kind).toBe('redirect');
  });

  it('re-checks settings on EVERY call — a driver switch between two calls is honored on the very next call, not cached from the first', async () => {
    settingsService.getDecryptedForInternalUse.mockResolvedValueOnce({ storageDriver: 'local' }).mockResolvedValueOnce({
      storageDriver: 's3',
      s3Region: 'us-east-1',
      s3Bucket: 'bucket',
      s3AccessKeyId: 'key',
      s3SecretAccessKey: 'secret',
      s3Endpoint: null,
      s3ForcePathStyle: false,
    });

    const firstTarget = await provider.getDownloadTarget('company-1/abc.pdf');
    const secondTarget = await provider.getDownloadTarget('company-1/abc.pdf');

    expect(firstTarget.kind).toBe('stream');
    expect(secondTarget.kind).toBe('redirect');
    expect(settingsService.getDecryptedForInternalUse).toHaveBeenCalledTimes(2);
  });
});
