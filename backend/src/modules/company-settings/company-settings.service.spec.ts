import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CompanySettingsService } from './company-settings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE_PROVIDER } from '../storage/storage-provider.interface';

/**
 * Partially rewritten this session when the tenant-company logo
 * moved off local disk (fs.writeFile) onto the shared
 * StorageProvider abstraction — a real, disclosed problem: a file
 * written to one app instance's disk was invisible to requests
 * landing on a different instance behind a load balancer. company.logo
 * now stores a storage KEY, never a directly-servable path, so the
 * old fs-mocking uploadLogo tests no longer apply; every other
 * describe block below is unchanged from before that fix.
 */
describe('CompanySettingsService', () => {
  let service: CompanySettingsService;
  let prisma: any;
  let storage: { upload: jest.Mock; getDownloadTarget: jest.Mock; delete: jest.Mock };

  const validLogoFile = { originalname: 'logo.png', mimetype: 'image/png', size: 1024, buffer: Buffer.from('x') };

  beforeEach(async () => {
    prisma = {
      company: { findFirst: jest.fn(), update: jest.fn() },
    };
    storage = { upload: jest.fn(), getDownloadTarget: jest.fn(), delete: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CompanySettingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: STORAGE_PROVIDER, useValue: storage },
      ],
    }).compile();

    service = moduleRef.get(CompanySettingsService);
  });

  describe('get', () => {
    it('404s when the company does not exist (or is a different company)', async () => {
      prisma.company.findFirst.mockResolvedValue(null);
      await expect(service.get('company-1')).rejects.toThrow(NotFoundException);
    });

    it("only ever looks up the CALLER'S OWN companyId", async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-1', name: 'Arkan', logo: null });
      await service.get('company-1');
      expect(prisma.company.findFirst.mock.calls[0][0].where.id).toBe('company-1');
    });

    it('never selects microsoftClientId or microsoftClientSecretEncrypted — those are only readable through the dedicated Microsoft integration endpoint', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-1', name: 'Arkan', logo: null });
      await service.get('company-1');
      const selectClause = prisma.company.findFirst.mock.calls[0][0].select;
      expect(selectClause.microsoftClientId).toBeUndefined();
      expect(selectClause.microsoftClientSecretEncrypted).toBeUndefined();
    });

    it('rewrites a stored logo key to the stable public serving path, never the raw key', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-1', name: 'Arkan', logo: 'logos/company-1-abc.png' });
      const result = await service.get('company-1');
      expect(result.logo).toBe('/api/v1/public/company-info/company-1/logo');
    });

    it('returns null logo when no logo has ever been uploaded', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-1', name: 'Arkan', logo: null });
      const result = await service.get('company-1');
      expect(result.logo).toBeNull();
    });
  });

  describe('update', () => {
    it('404s when updating a company that does not exist', async () => {
      prisma.company.findFirst.mockResolvedValue(null);
      await expect(service.update('company-1', { name: 'New Name' })).rejects.toThrow(NotFoundException);
    });

    it('updates only the fields provided, and still never selects the Microsoft credential fields back', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-1', logo: null });
      prisma.company.update.mockResolvedValue({ id: 'company-1', name: 'New Name', logo: null });

      await service.update('company-1', { name: 'New Name' });

      const call = prisma.company.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'company-1' });
      expect(call.data).toEqual({ name: 'New Name' });
      expect(call.select.microsoftClientSecretEncrypted).toBeUndefined();
    });
  });

  describe('getMicrosoftIntegrationSettings', () => {
    it('404s when the company does not exist', async () => {
      prisma.company.findFirst.mockResolvedValue(null);
      await expect(service.getMicrosoftIntegrationSettings('company-1')).rejects.toThrow(NotFoundException);
    });

    it('returns secretConfigured: false and clientId: null when nothing has been saved yet', async () => {
      prisma.company.findFirst.mockResolvedValue({ microsoftClientId: null, microsoftClientSecretEncrypted: null });
      const result = await service.getMicrosoftIntegrationSettings('company-1');
      expect(result).toEqual({ clientId: null, secretConfigured: false });
    });

    it('returns secretConfigured: true but NEVER the encrypted value itself, once a secret is saved', async () => {
      prisma.company.findFirst.mockResolvedValue({ microsoftClientId: 'abc-123', microsoftClientSecretEncrypted: 'iv:tag:ciphertext' });
      const result = await service.getMicrosoftIntegrationSettings('company-1');
      expect(result).toEqual({ clientId: 'abc-123', secretConfigured: true });
      expect(result).not.toHaveProperty('clientSecret');
      expect(result).not.toHaveProperty('microsoftClientSecretEncrypted');
    });
  });

  describe('updateMicrosoftIntegrationSettings', () => {
    beforeEach(() => {
      process.env.CREDENTIALS_ENCRYPTION_KEY = 'test-master-key-for-specs';
    });

    it('404s when the company does not exist', async () => {
      prisma.company.findFirst.mockResolvedValue(null);
      await expect(service.updateMicrosoftIntegrationSettings('company-1', { clientId: 'abc' })).rejects.toThrow(NotFoundException);
    });

    it('encrypts the secret before storing it — the plaintext never reaches the update() call', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-1' });
      prisma.company.update.mockResolvedValue({ microsoftClientId: 'abc', microsoftClientSecretEncrypted: 'encrypted-value' });

      await service.updateMicrosoftIntegrationSettings('company-1', { clientId: 'abc', clientSecret: 'my-plaintext-secret' });

      const updateCall = prisma.company.update.mock.calls[0][0];
      expect(updateCall.data.microsoftClientSecretEncrypted).not.toBe('my-plaintext-secret');
      expect(updateCall.data.microsoftClientSecretEncrypted).toContain(':'); // iv:authTag:ciphertext shape
    });

    it('leaves the previously stored secret untouched when clientSecret is omitted (updating only the Client ID)', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-1' });
      prisma.company.update.mockResolvedValue({ microsoftClientId: 'new-id', microsoftClientSecretEncrypted: 'previously-stored' });

      await service.updateMicrosoftIntegrationSettings('company-1', { clientId: 'new-id' });

      const updateCall = prisma.company.update.mock.calls[0][0];
      expect('microsoftClientSecretEncrypted' in updateCall.data).toBe(false);
    });

    it('never returns the encrypted secret in its own response, only secretConfigured', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-1' });
      prisma.company.update.mockResolvedValue({ microsoftClientId: 'abc', microsoftClientSecretEncrypted: 'iv:tag:ciphertext' });

      const result = await service.updateMicrosoftIntegrationSettings('company-1', { clientId: 'abc', clientSecret: 'secret' });

      expect(result).toEqual({ clientId: 'abc', secretConfigured: true });
    });
  });

  describe('uploadLogo', () => {
    it('rejects a disallowed file type (e.g. a PDF, not an image)', async () => {
      const badFile = { ...validLogoFile, mimetype: 'application/pdf' };
      await expect(service.uploadLogo('company-1', badFile)).rejects.toThrow(UnprocessableEntityException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('rejects a logo exceeding the 2MB limit', async () => {
      const bigFile = { ...validLogoFile, size: 5 * 1024 * 1024 };
      await expect(service.uploadLogo('company-1', bigFile)).rejects.toThrow(UnprocessableEntityException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('deletes the OLD logo via the storage provider before saving the new one, when a previous logo existed', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-1', logo: 'logos/company-1-old.png' });
      prisma.company.update.mockResolvedValue({ id: 'company-1', logo: 'logos/company-1-new.png' });

      await service.uploadLogo('company-1', validLogoFile);

      expect(storage.delete).toHaveBeenCalledWith('logos/company-1-old.png');
    });

    it('does not attempt to delete anything when there was no previous logo', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-1', logo: null });
      prisma.company.update.mockResolvedValue({ id: 'company-1', logo: 'logos/company-1-new.png' });

      await service.uploadLogo('company-1', validLogoFile);

      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('uploads through the storage provider under a logos/ key, stores that key, and returns the stable public path', async () => {
      prisma.company.findFirst.mockResolvedValue({ id: 'company-1', logo: null });
      prisma.company.update.mockResolvedValue({ id: 'company-1', logo: 'logos/company-1-abc.png' });

      const result = await service.uploadLogo('company-1', validLogoFile);

      const uploadedKey = storage.upload.mock.calls[0][0];
      expect(uploadedKey).toMatch(/^logos\/company-1-/);
      const updateCall = prisma.company.update.mock.calls[0][0];
      expect(updateCall.data.logo).toMatch(/^logos\/company-1-/);
      // The client-facing result is the stable public path, never the raw key.
      expect(result.logo).toBe('/api/v1/public/company-info/company-1/logo');
    });
  });

  describe('getLogoDownloadTarget', () => {
    it('resolves the stored key via the storage provider, fresh on every call', async () => {
      prisma.company.findFirst.mockResolvedValue({ logo: 'logos/company-1-abc.png' });
      storage.getDownloadTarget.mockResolvedValue({ kind: 'stream', filePath: '/tmp/whatever' });

      const { target, mimeType } = await service.getLogoDownloadTarget('company-1');

      expect(storage.getDownloadTarget).toHaveBeenCalledWith('logos/company-1-abc.png');
      expect(target).toEqual({ kind: 'stream', filePath: '/tmp/whatever' });
      expect(mimeType).toBe('image/png');
    });

    it('404s when this company has no logo set', async () => {
      prisma.company.findFirst.mockResolvedValue({ logo: null });
      await expect(service.getLogoDownloadTarget('company-1')).rejects.toThrow(NotFoundException);
    });

    it('404s when the company itself does not exist', async () => {
      prisma.company.findFirst.mockResolvedValue(null);
      await expect(service.getLogoDownloadTarget('company-1')).rejects.toThrow(NotFoundException);
    });
  });
});
