import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InventoryItemsService } from './inventory-items.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('InventoryItemsService', () => {
  let service: InventoryItemsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { stockItem: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [InventoryItemsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(InventoryItemsService);
  });

  describe('findAll', () => {
    it('excludes soft-deleted items', async () => {
      prisma.stockItem.findMany.mockResolvedValue([]);
      await service.findAll('company-1');
      expect(prisma.stockItem.findMany.mock.calls[0][0].where.deletedAt).toBeNull();
    });
  });

  describe('create', () => {
    it('rejects a SKU already used by an active item in this company', async () => {
      prisma.stockItem.findFirst.mockResolvedValue({ id: 'existing-item' });
      await expect(service.create('company-1', { sku: 'WIDGET-1', name: 'Widget' })).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.stockItem.create).not.toHaveBeenCalled();
    });

    it('defaults unitOfMeasure to "unit" when not provided', async () => {
      prisma.stockItem.findFirst.mockResolvedValue(null);
      prisma.stockItem.create.mockResolvedValue({ id: 'item-1' });

      await service.create('company-1', { sku: 'WIDGET-1', name: 'Widget' });

      expect(prisma.stockItem.create.mock.calls[0][0].data.unitOfMeasure).toBe('unit');
    });
  });

  describe('deactivate', () => {
    it('404s when the item does not exist in this company', async () => {
      prisma.stockItem.findFirst.mockResolvedValue(null);
      await expect(service.deactivate('company-1', 'item-1')).rejects.toThrow(NotFoundException);
    });

    it('soft-deletes AND sets isActive to false, rather than hard-deleting', async () => {
      prisma.stockItem.findFirst.mockResolvedValue({ id: 'item-1' });
      prisma.stockItem.update.mockResolvedValue({ id: 'item-1', deletedAt: new Date() });

      await service.deactivate('company-1', 'item-1');

      const call = prisma.stockItem.update.mock.calls[0][0];
      expect(call.data.deletedAt).toBeInstanceOf(Date);
      expect(call.data.isActive).toBe(false);
    });
  });
});
