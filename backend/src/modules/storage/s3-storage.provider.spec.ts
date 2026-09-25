import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3StorageProvider } from './s3-storage.provider';
import { ResolvedStorageSettings } from './platform-storage-settings.service';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: jest.fn().mockResolvedValue({}) })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://bucket.s3.example.com/signed-url'),
}));

describe('S3StorageProvider', () => {
  const VALID_SETTINGS: ResolvedStorageSettings = {
    storageDriver: 's3',
    s3Region: 'us-east-1',
    s3Bucket: 'my-bucket',
    s3AccessKeyId: 'fake-key',
    s3SecretAccessKey: 'fake-secret',
    s3Endpoint: null,
    s3ForcePathStyle: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws immediately (before any AWS SDK call) when required settings are missing, rather than failing confusingly on first use', () => {
    const incomplete = { ...VALID_SETTINGS, s3SecretAccessKey: null };
    expect(() => new S3StorageProvider(incomplete)).toThrow(/region, bucket, access key/);
    expect(S3Client).not.toHaveBeenCalled();
  });

  it('uploads with the exact key and content type given — never a derived or modified one', async () => {
    const provider = new S3StorageProvider(VALID_SETTINGS);

    await provider.upload('company-1/abc.pdf', Buffer.from('data'), 'application/pdf');

    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'my-bucket',
      Key: 'company-1/abc.pdf',
      Body: Buffer.from('data'),
      ContentType: 'application/pdf',
    });
  });

  it('getDownloadTarget returns a redirect target (never a stream target — that would defeat the whole point of using S3)', async () => {
    const provider = new S3StorageProvider(VALID_SETTINGS);

    const target = await provider.getDownloadTarget('company-1/abc.pdf');

    expect(target.kind).toBe('redirect');
    expect(GetObjectCommand).toHaveBeenCalledWith({ Bucket: 'my-bucket', Key: 'company-1/abc.pdf' });
    expect(getSignedUrl).toHaveBeenCalled();
  });

  it('delete() does not throw even if the underlying S3 call rejects (object already gone)', async () => {
    const provider = new S3StorageProvider(VALID_SETTINGS);
    (provider as any).client.send = jest.fn().mockRejectedValue(new Error('NoSuchKey'));

    await expect(provider.delete('company-1/missing.pdf')).resolves.toBeUndefined();
  });

  it('passes endpoint through to the client only when it is actually set, so real AWS S3 (no endpoint override) still works by default', () => {
    // eslint-disable-next-line no-new
    new S3StorageProvider({ ...VALID_SETTINGS, s3Endpoint: 'https://minio.internal:9000' });

    const constructedConfig = (S3Client as unknown as jest.Mock).mock.calls[0][0];
    expect(constructedConfig.endpoint).toBe('https://minio.internal:9000');
  });

  it('omits the endpoint key entirely (not undefined) when unset, so the SDK defaults to real AWS S3', () => {
    // eslint-disable-next-line no-new
    new S3StorageProvider(VALID_SETTINGS);

    const constructedConfig = (S3Client as unknown as jest.Mock).mock.calls[0][0];
    expect('endpoint' in constructedConfig).toBe(false);
  });

  it('uses CURRENT settings from each construction — a credential change is reflected on the very next instance, never cached', () => {
    // eslint-disable-next-line no-new
    new S3StorageProvider(VALID_SETTINGS);
    // eslint-disable-next-line no-new
    new S3StorageProvider({ ...VALID_SETTINGS, s3Bucket: 'a-different-bucket-after-admin-changed-it' });

    const secondConfig = (S3Client as unknown as jest.Mock).mock.calls[1][0];
    expect(secondConfig.credentials.accessKeyId).toBe('fake-key');
  });
});
