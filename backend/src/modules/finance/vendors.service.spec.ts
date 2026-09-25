import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('VendorsService', () => {
  let service: VendorsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      vendor: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      bill: { count: jest.fn() },
    };
    prisma.$transaction = jest.fn((arg) => Promise.all(arg));

    const moduleRef = await Test.createTestingModule({
      providers: [VendorsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(VendorsService);
  });

  describe('create', () => {
    it('rejects a duplicate vendor code within the same company', async () => {
      prisma.vendor.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create('company-1', { vendorCode: 'V001', name: 'Acme Supplies' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('creates the vendor when the code is unique', async () => {
      prisma.vendor.findUnique.mockResolvedValue(null);
      prisma.vendor.create.mockResolvedValue({ id: 'vendor-1', vendorCode: 'V001' });

      const result = await service.create('company-1', { vendorCode: 'V001', name: 'Acme Supplies' } as any);
      expect(result.vendorCode).toBe('V001');
    });
  });

  describe('findOne', () => {
    it('404s when the vendor does not exist in the caller company', async () => {
      prisma.vendor.findFirst.mockResolvedValue(null);
      await expect(service.findOne('company-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('rejects deleting a vendor that has bills recorded against it', async () => {
      prisma.vendor.findFirst.mockResolvedValue({ id: 'vendor-1' });
      prisma.bill.count.mockResolvedValue(2);

      await expect(service.softDelete('company-1', 'vendor-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('allows deleting a vendor with no bills recorded', async () => {
      prisma.vendor.findFirst.mockResolvedValue({ id: 'vendor-1' });
      prisma.bill.count.mockResolvedValue(0);
      prisma.vendor.update.mockResolvedValue({ id: 'vendor-1', deletedAt: new Date() });

      await expect(service.softDelete('company-1', 'vendor-1')).resolves.toBeDefined();
    });
  });
});
