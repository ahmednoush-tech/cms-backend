import { Test } from '@nestjs/testing';
import { InventoryStockService } from './inventory-stock.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('InventoryStockService', () => {
  let service: InventoryStockService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { stockItem: { findMany: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [InventoryStockService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(InventoryStockService);
  });

  describe('findLowStock', () => {
    it('includes an item whose TOTAL quantity across all warehouses is at or below its reorder point, even if no single warehouse alone looks low', async () => {
      prisma.stockItem.findMany.mockResolvedValue([
        { id: 'item-1', name: 'Widget', reorderPoint: '10', stock: [{ quantityOnHand: '6' }, { quantityOnHand: '3' }] },
      ]);

      const result = await service.findLowStock('company-1');

      expect(result).toHaveLength(1);
      expect(result[0].totalQuantity).toBe(9);
    });

    it('excludes an item whose total is comfortably above its reorder point', async () => {
      prisma.stockItem.findMany.mockResolvedValue([
        { id: 'item-1', name: 'Widget', reorderPoint: '10', stock: [{ quantityOnHand: '20' }] },
      ]);

      const result = await service.findLowStock('company-1');

      expect(result).toHaveLength(0);
    });

    it('includes an item exactly AT its reorder point (boundary: at-or-below, not strictly-below)', async () => {
      prisma.stockItem.findMany.mockResolvedValue([
        { id: 'item-1', name: 'Widget', reorderPoint: '10', stock: [{ quantityOnHand: '10' }] },
      ]);

      const result = await service.findLowStock('company-1');

      expect(result).toHaveLength(1);
    });

    it('only queries items that actually HAVE a reorder point configured', async () => {
      prisma.stockItem.findMany.mockResolvedValue([]);

      await service.findLowStock('company-1');

      const call = prisma.stockItem.findMany.mock.calls[0][0];
      expect(call.where.reorderPoint).toEqual({ not: null });
    });
  });
});
