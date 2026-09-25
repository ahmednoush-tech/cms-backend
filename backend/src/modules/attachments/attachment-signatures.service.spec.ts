import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AttachmentSignaturesService } from './attachment-signatures.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AttachmentSignaturesService', () => {
  let service: AttachmentSignaturesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      attachment: { findFirst: jest.fn() },
      attachmentSignature: { create: jest.fn(), findMany: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [AttachmentSignaturesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(AttachmentSignaturesService);
  });

  describe('sign', () => {
    it('404s when the attachment does not belong to the caller company', async () => {
      prisma.attachment.findFirst.mockResolvedValue(null);

      await expect(
        service.sign('company-1', 'user-1', 'missing', { signatureType: 'typed', signatureData: 'Jane Doe' }, '1.2.3.4'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.attachmentSignature.create).not.toHaveBeenCalled();
    });

    it('signs the SPECIFIC attachment version passed in — never the document group as a whole', async () => {
      prisma.attachment.findFirst.mockResolvedValue({ id: 'att-1', documentGroupId: 'group-1' });
      prisma.attachmentSignature.create.mockResolvedValue({ id: 'sig-1' });

      await service.sign('company-1', 'user-1', 'att-1', { signatureType: 'typed', signatureData: 'Jane Doe' }, '1.2.3.4');

      const call = prisma.attachmentSignature.create.mock.calls[0][0];
      expect(call.data.attachmentId).toBe('att-1');
      expect(call.data).not.toHaveProperty('documentGroupId');
    });

    it('records the signing user, the raw signature data, and the IP address for the audit trail', async () => {
      prisma.attachment.findFirst.mockResolvedValue({ id: 'att-1' });
      prisma.attachmentSignature.create.mockResolvedValue({ id: 'sig-1' });

      await service.sign('company-1', 'user-42', 'att-1', { signatureType: 'drawn', signatureData: 'data:image/png;base64,abc' }, '9.9.9.9');

      const call = prisma.attachmentSignature.create.mock.calls[0][0];
      expect(call.data.signedBy).toBe('user-42');
      expect(call.data.signatureType).toBe('drawn');
      expect(call.data.signatureData).toBe('data:image/png;base64,abc');
      expect(call.data.ipAddress).toBe('9.9.9.9');
    });
  });

  describe('listForAttachment', () => {
    it('404s when the attachment does not belong to the caller company', async () => {
      prisma.attachment.findFirst.mockResolvedValue(null);

      await expect(service.listForAttachment('company-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('orders signatures most-recent-first', async () => {
      prisma.attachment.findFirst.mockResolvedValue({ id: 'att-1' });
      prisma.attachmentSignature.findMany.mockResolvedValue([]);

      await service.listForAttachment('company-1', 'att-1');

      expect(prisma.attachmentSignature.findMany.mock.calls[0][0].orderBy).toEqual({ signedAt: 'desc' });
    });
  });
});
