import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AttachmentsService } from './attachments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { STORAGE_PROVIDER } from '../storage/storage-provider.interface';

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let prisma: any;
  let storage: any;

  const validFile = { originalname: 'contract.pdf', mimetype: 'application/pdf', size: 1024, buffer: Buffer.from('x') };

  beforeEach(async () => {
    prisma = {
      customer: { findFirst: jest.fn() },
      lead: { findFirst: jest.fn() },
      opportunity: { findFirst: jest.fn() },
      quotation: { findFirst: jest.fn() },
      project: { findFirst: jest.fn() },
      workOrder: { findFirst: jest.fn() },
      task: { findFirst: jest.fn() },
      invoice: { findFirst: jest.fn() },
      bill: { findFirst: jest.fn() },
      purchaseOrder: { findFirst: jest.fn() },
      fixedAsset: { findFirst: jest.fn() },
      vendor: { findFirst: jest.fn() },
      employee: { findFirst: jest.fn() },
      interaction: { findFirst: jest.fn() },
      attachment: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        aggregate: jest.fn(),
      },
    };
    prisma.$transaction = jest.fn((fn) => fn(prisma));

    // A fake StorageProvider — this is exactly the point of the abstraction: AttachmentsService's own logic (ownership checks, MIME/size validation, key construction) is tested here completely independent of which real storage backend (local disk or S3) is behind it. The storage providers themselves have their own tests.
    storage = {
      upload: jest.fn().mockResolvedValue(undefined),
      getDownloadTarget: jest.fn().mockResolvedValue({ kind: 'stream', filePath: '/fake/path' }),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: STORAGE_PROVIDER, useValue: storage },
      ],
    }).compile();

    service = moduleRef.get(AttachmentsService);
  });

  describe('upload', () => {
    it('rejects a disallowed MIME type (defense-in-depth, even though Multer should already block it)', async () => {
      const badFile = { ...validFile, mimetype: 'application/x-msdownload' };

      await expect(
        service.upload('company-1', 'user-1', { entityType: 'customer', entityId: 'cust-1' } as any, badFile),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(prisma.attachment.create).not.toHaveBeenCalled();
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('rejects a file exceeding the maximum size (defense-in-depth)', async () => {
      const bigFile = { ...validFile, size: 999 * 1024 * 1024 };

      await expect(
        service.upload('company-1', 'user-1', { entityType: 'customer', entityId: 'cust-1' } as any, bigFile),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('404s when the target customer does not belong to the caller company', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.upload('company-1', 'user-1', { entityType: 'customer', entityId: 'other-company-customer' } as any, validFile),
      ).rejects.toThrow(NotFoundException);
      expect(storage.upload).not.toHaveBeenCalled();
    });

    it('404s when the target fixed asset does not belong to the caller company', async () => {
      prisma.fixedAsset.findFirst.mockResolvedValue(null);

      await expect(
        service.upload('company-1', 'user-1', { entityType: 'fixed_asset', entityId: 'other-company-asset' } as any, validFile),
      ).rejects.toThrow(NotFoundException);
    });

    it('succeeds and stores the ORIGINAL filename as metadata, never as the stored (disk/object) filename', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.attachment.create.mockResolvedValue({ id: 'att-1' });
      prisma.attachment.update.mockResolvedValue({ id: 'att-1' });

      await service.upload('company-1', 'user-1', { entityType: 'customer', entityId: 'cust-1' } as any, validFile);

      const call = prisma.attachment.create.mock.calls[0][0];
      expect(call.data.fileName).toBe('contract.pdf');
      expect(call.data.storedFileName).not.toBe('contract.pdf');
      expect(call.data.storedFileName).toMatch(/\.pdf$/);
    });

    it('uploads under a key scoped to the CALLER company, never a client-supplied one', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.attachment.create.mockResolvedValue({ id: 'att-1' });
      prisma.attachment.update.mockResolvedValue({ id: 'att-1' });

      await service.upload('company-1', 'user-1', { entityType: 'customer', entityId: 'cust-1' } as any, validFile);

      const key = storage.upload.mock.calls[0][0];
      expect(key).toMatch(/^company-1\//);
    });

    it('stamps uploadedBy with the acting user', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.attachment.create.mockResolvedValue({ id: 'att-1' });
      prisma.attachment.update.mockResolvedValue({ id: 'att-1' });

      await service.upload('company-1', 'user-42', { entityType: 'customer', entityId: 'cust-1' } as any, validFile);

      expect(prisma.attachment.create.mock.calls[0][0].data.uploadedBy).toBe('user-42');
    });

    it("a first-ever upload's documentGroupId is corrected to point at its OWN id, via the two-step create-then-update — this is the self-reference every version chain starts from", async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.attachment.create.mockResolvedValue({ id: 'att-1' });
      prisma.attachment.update.mockResolvedValue({ id: 'att-1', documentGroupId: 'att-1' });

      await service.upload('company-1', 'user-1', { entityType: 'customer', entityId: 'cust-1' } as any, validFile);

      const updateCall = prisma.attachment.update.mock.calls[0][0];
      expect(updateCall.where.id).toBe('att-1');
      expect(updateCall.data.documentGroupId).toBe('att-1');
    });
  });

  describe('findAllForEntity', () => {
    it('404s if the parent entity does not exist in the caller company', async () => {
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.findAllForEntity('company-1', 'project', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('orders results most-recent-first', async () => {
      prisma.project.findFirst.mockResolvedValue({ id: 'proj-1' });
      prisma.attachment.findMany.mockResolvedValue([]);

      await service.findAllForEntity('company-1', 'project', 'proj-1');

      expect(prisma.attachment.findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'desc' });
    });
  });

  describe('getDownloadInfo', () => {
    it('404s when the attachment does not belong to the caller company', async () => {
      prisma.attachment.findFirst.mockResolvedValue(null);

      await expect(service.getDownloadInfo('company-1', 'missing')).rejects.toThrow(NotFoundException);
      expect(storage.getDownloadTarget).not.toHaveBeenCalled();
    });

    it('asks the storage provider for a target using a key scoped under the CALLER company', async () => {
      prisma.attachment.findFirst.mockResolvedValue({ id: 'att-1', storedFileName: 'abc.pdf', fileName: 'contract.pdf', mimeType: 'application/pdf' });

      const result = await service.getDownloadInfo('company-1', 'att-1');

      const key = storage.getDownloadTarget.mock.calls[0][0];
      expect(key).toBe('company-1/abc.pdf');
      expect(result.fileName).toBe('contract.pdf');
      expect(result.target).toEqual({ kind: 'stream', filePath: '/fake/path' });
    });

    it('passes through whatever target shape the storage provider returns (e.g. an S3 redirect), without inspecting or altering it', async () => {
      prisma.attachment.findFirst.mockResolvedValue({ id: 'att-1', storedFileName: 'abc.pdf', fileName: 'contract.pdf', mimeType: 'application/pdf' });
      storage.getDownloadTarget.mockResolvedValue({ kind: 'redirect', url: 'https://bucket.s3.example.com/signed' });

      const result = await service.getDownloadInfo('company-1', 'att-1');

      expect(result.target).toEqual({ kind: 'redirect', url: 'https://bucket.s3.example.com/signed' });
    });
  });

  describe('remove', () => {
    it('404s when the attachment does not exist in the caller company', async () => {
      prisma.attachment.findFirst.mockResolvedValue(null);

      await expect(service.remove('company-1', 'missing')).rejects.toThrow(NotFoundException);
      expect(storage.delete).not.toHaveBeenCalled();
    });

    it('deletes the database row (hard delete, not a soft-delete flag)', async () => {
      prisma.attachment.findFirst.mockResolvedValue({ id: 'att-1', storedFileName: 'abc.pdf' });

      await service.remove('company-1', 'att-1');

      expect(prisma.attachment.delete).toHaveBeenCalledWith({ where: { id: 'att-1' } });
    });

    it('deletes from storage using a key scoped under the CALLER company', async () => {
      prisma.attachment.findFirst.mockResolvedValue({ id: 'att-1', storedFileName: 'abc.pdf' });

      await service.remove('company-1', 'att-1');

      expect(storage.delete).toHaveBeenCalledWith('company-1/abc.pdf');
    });

    it('promotes the next-most-recent version to current when the CURRENT version is deleted', async () => {
      prisma.attachment.findFirst
        .mockResolvedValueOnce({ id: 'att-2', storedFileName: 'v2.pdf', documentGroupId: 'group-1', isCurrentVersion: true })
        .mockResolvedValueOnce({ id: 'att-1', versionNumber: 1 }); // the "next current" lookup

      await service.remove('company-1', 'att-2');

      expect(prisma.attachment.update).toHaveBeenCalledWith({ where: { id: 'att-1' }, data: { isCurrentVersion: true } });
    });

    it('does NOT touch any other version when deleting a version that was already NOT current', async () => {
      prisma.attachment.findFirst.mockResolvedValueOnce({ id: 'att-1', storedFileName: 'v1.pdf', documentGroupId: 'group-1', isCurrentVersion: false });

      await service.remove('company-1', 'att-1');

      expect(prisma.attachment.update).not.toHaveBeenCalled();
    });

    it('does not crash when deleting the ONLY version of a document (no other version to promote)', async () => {
      prisma.attachment.findFirst
        .mockResolvedValueOnce({ id: 'att-1', storedFileName: 'v1.pdf', documentGroupId: 'group-1', isCurrentVersion: true })
        .mockResolvedValueOnce(null); // no remaining version found

      await expect(service.remove('company-1', 'att-1')).resolves.toBeUndefined();
      expect(prisma.attachment.update).not.toHaveBeenCalled();
    });
  });

  describe('uploadNewVersion', () => {
    const versionFile = { originalname: 'contract-v2.pdf', mimetype: 'application/pdf', size: 2048, buffer: Buffer.from('y') };

    it('404s when the previous attachment does not belong to the caller company', async () => {
      prisma.attachment.findFirst.mockResolvedValue(null);

      await expect(service.uploadNewVersion('company-1', 'user-1', 'missing', versionFile)).rejects.toThrow(NotFoundException);
    });

    it('rejects a disallowed MIME type for the new version (same defense-in-depth as a first upload)', async () => {
      prisma.attachment.findFirst.mockResolvedValue({ id: 'att-1', documentGroupId: 'group-1', versionNumber: 1 });
      const badFile = { ...versionFile, mimetype: 'application/x-msdownload' };

      await expect(service.uploadNewVersion('company-1', 'user-1', 'att-1', badFile)).rejects.toThrow(UnprocessableEntityException);
    });

    it('marks EVERY existing version in the group as no longer current, then creates the new one as current', async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        id: 'att-1', documentGroupId: 'group-1', versionNumber: 1, entityType: 'customer', entityId: 'cust-1',
      });
      prisma.attachment.aggregate.mockResolvedValue({ _max: { versionNumber: 1 } });
      prisma.attachment.create.mockResolvedValue({ id: 'att-2', versionNumber: 2 });

      await service.uploadNewVersion('company-1', 'user-1', 'att-1', versionFile);

      expect(prisma.attachment.updateMany).toHaveBeenCalledWith({ where: { documentGroupId: 'group-1' }, data: { isCurrentVersion: false } });
      const createCall = prisma.attachment.create.mock.calls[0][0];
      expect(createCall.data.isCurrentVersion).toBe(true);
      expect(createCall.data.documentGroupId).toBe('group-1');
    });

    it('computes the new versionNumber from the CURRENT MAX in the group, not from the specific attachment id passed in', async () => {
      // Caller passed an OLD version's id, but 3 versions already exist — the new one must still become version 4, not 2.
      prisma.attachment.findFirst.mockResolvedValue({
        id: 'att-1', documentGroupId: 'group-1', versionNumber: 1, entityType: 'customer', entityId: 'cust-1',
      });
      prisma.attachment.aggregate.mockResolvedValue({ _max: { versionNumber: 3 } });
      prisma.attachment.create.mockResolvedValue({ id: 'att-4', versionNumber: 4 });

      await service.uploadNewVersion('company-1', 'user-1', 'att-1', versionFile);

      const createCall = prisma.attachment.create.mock.calls[0][0];
      expect(createCall.data.versionNumber).toBe(4);
    });

    it('carries the entityType/entityId over from the previous version — a new version is not re-attached elsewhere', async () => {
      prisma.attachment.findFirst.mockResolvedValue({
        id: 'att-1', documentGroupId: 'group-1', versionNumber: 1, entityType: 'invoice', entityId: 'inv-1',
      });
      prisma.attachment.aggregate.mockResolvedValue({ _max: { versionNumber: 1 } });
      prisma.attachment.create.mockResolvedValue({ id: 'att-2' });

      await service.uploadNewVersion('company-1', 'user-1', 'att-1', versionFile);

      const createCall = prisma.attachment.create.mock.calls[0][0];
      expect(createCall.data.entityType).toBe('invoice');
      expect(createCall.data.entityId).toBe('inv-1');
    });
  });

  describe('listVersions', () => {
    it('404s when the attachment does not belong to the caller company', async () => {
      prisma.attachment.findFirst.mockResolvedValue(null);

      await expect(service.listVersions('company-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('resolves the shared documentGroupId from WHICHEVER version id was passed in, then lists the whole group', async () => {
      prisma.attachment.findFirst.mockResolvedValue({ id: 'att-1', documentGroupId: 'group-1' });
      prisma.attachment.findMany.mockResolvedValue([]);

      await service.listVersions('company-1', 'att-1');

      const call = prisma.attachment.findMany.mock.calls[0][0];
      expect(call.where.documentGroupId).toBe('group-1');
      expect(call.orderBy).toEqual({ versionNumber: 'desc' });
    });
  });
});
