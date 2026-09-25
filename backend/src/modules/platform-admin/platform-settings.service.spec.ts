import { Test } from '@nestjs/testing';
import { UnprocessableEntityException, NotFoundException } from '@nestjs/common';
import { PlatformSettingsService } from './platform-settings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE_PROVIDER } from '../storage/storage-provider.interface';

/**
 * Rewritten this session when the platform logo moved off local
 * disk (fs.writeFile) onto the shared StorageProvider abstraction
 * — the same real, disclosed problem the tenant-company logo had:
 * a file written to one app instance's disk was invisible to
 * requests landing on a different instance behind a load balancer.
 * logoUrl now stores a storage KEY, never a directly-servable path,
 * and the old fs-mocking tests no longer apply.
 */
const SETTINGS_ID = '00000000-0000-0000-0000-00000000005e';
const PUBLIC_LOGO_PATH = '/api/v1/platform-settings/logo';

describe('PlatformSettingsService', () => {
  let service: PlatformSettingsService;
  let prisma: any;
  let storage: { upload: jest.Mock; getDownloadTarget: jest.Mock; delete: jest.Mock };

  const validLogoFile = { originalname: 'logo.svg', mimetype: 'image/svg+xml', size: 1024, buffer: Buffer.from('<svg/>') };

  beforeEach(async () => {
    prisma = { platformSettings: { findUnique: jest.fn(), update: jest.fn() } };
    storage = { upload: jest.fn(), getDownloadTarget: jest.fn(), delete: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformSettingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: STORAGE_PROVIDER, useValue: storage },
      ],
    }).compile();

    service = moduleRef.get(PlatformSettingsService);
  });

  describe('get', () => {
    it('always reads the fixed singleton id, never a caller-provided one', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue({ id: SETTINGS_ID, productName: 'Mizan', logoUrl: null });
      await service.get();
      expect(prisma.platformSettings.findUnique).toHaveBeenCalledWith({ where: { id: SETTINGS_ID } });
    });

    it('throws loudly if the singleton row is somehow missing', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue(null);
      await expect(service.get()).rejects.toThrow(/migration 081/);
    });

    it('rewrites a stored logo key to the stable public path, never the raw key', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue({ id: SETTINGS_ID, logoUrl: 'platform/platform-xyz.svg' });
      const result = await service.get();
      expect(result.logoUrl).toBe(PUBLIC_LOGO_PATH);
    });

    it('returns null logoUrl when no logo has ever been set', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue({ id: SETTINGS_ID, logoUrl: null });
      const result = await service.get();
      expect(result.logoUrl).toBeNull();
    });
  });

  describe('update', () => {
    it('always writes to the fixed singleton id', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue({ id: SETTINGS_ID, productName: 'Mizan', logoUrl: null });
      prisma.platformSettings.update.mockResolvedValue({ id: SETTINGS_ID, productName: 'New Name', logoUrl: null });

      await service.update({ productName: 'New Name' });

      expect(prisma.platformSettings.update).toHaveBeenCalledWith({ where: { id: SETTINGS_ID }, data: { productName: 'New Name' } });
    });
  });

  describe('uploadLogo', () => {
    it('rejects a disallowed file type', async () => {
      await expect(service.uploadLogo({ ...validLogoFile, mimetype: 'application/pdf' })).rejects.toThrow(UnprocessableEntityException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('rejects a file exceeding the max size', async () => {
      await expect(service.uploadLogo({ ...validLogoFile, size: 3 * 1024 * 1024 })).rejects.toThrow(UnprocessableEntityException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('uploads through the storage provider under a platform/ key, and stores that key (not a servable path)', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue({ id: SETTINGS_ID, logoUrl: null });
      prisma.platformSettings.update.mockResolvedValue({ id: SETTINGS_ID, logoUrl: 'platform/platform-xyz.svg' });

      const result = await service.uploadLogo(validLogoFile);

      const uploadedKey = storage.upload.mock.calls[0][0];
      expect(uploadedKey).toMatch(/^platform\/platform-/);
      const updateCall = prisma.platformSettings.update.mock.calls[0][0];
      expect(updateCall.data.logoUrl).toMatch(/^platform\/platform-/);
      // The client-facing result is still the stable public path, never the raw key.
      expect(result.logoUrl).toBe(PUBLIC_LOGO_PATH);
    });

    it('deletes the previous logo via the storage provider when replacing an existing one', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue({ id: SETTINGS_ID, logoUrl: 'platform/old-logo.svg' });
      prisma.platformSettings.update.mockResolvedValue({ id: SETTINGS_ID, logoUrl: 'platform/new-logo.svg' });

      await service.uploadLogo(validLogoFile);

      expect(storage.delete).toHaveBeenCalledWith('platform/old-logo.svg');
    });

    it('does not attempt to delete anything when there was no previous logo', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue({ id: SETTINGS_ID, logoUrl: null });
      prisma.platformSettings.update.mockResolvedValue({ id: SETTINGS_ID, logoUrl: 'platform/new-logo.svg' });

      await service.uploadLogo(validLogoFile);

      expect(storage.delete).not.toHaveBeenCalled();
    });
  });

  describe('getLogoDownloadTarget', () => {
    it('resolves the stored key via the storage provider, fresh on every call', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue({ id: SETTINGS_ID, logoUrl: 'platform/platform-xyz.png' });
      storage.getDownloadTarget.mockResolvedValue({ kind: 'stream', filePath: '/tmp/whatever' });

      const { target, mimeType } = await service.getLogoDownloadTarget();

      expect(storage.getDownloadTarget).toHaveBeenCalledWith('platform/platform-xyz.png');
      expect(target).toEqual({ kind: 'stream', filePath: '/tmp/whatever' });
      expect(mimeType).toBe('image/png');
    });

    it('404s when no logo has ever been set', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue({ id: SETTINGS_ID, logoUrl: null });
      await expect(service.getLogoDownloadTarget()).rejects.toThrow(NotFoundException);
    });
  });
});
