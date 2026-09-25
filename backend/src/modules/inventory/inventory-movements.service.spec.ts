import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InventoryMovementsService } from './inventory-movements.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('InventoryMovementsService', () => {
  let service: InventoryMovementsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      stockItem: { findFirst: jest.fn() },
      warehouse: { findFirst: jest.fn() },
      inventoryStock: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
      stockMovement: { create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn((fn) => fn(prisma)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [InventoryMovementsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(InventoryMovementsService);
  });

  const validItem = { id: 'item-1' };
  const validWarehouse = { id: 'wh-1' };

  describe('receipt', () => {
    it('404s when the item does not exist in this company', async () => {
      prisma.stockItem.findFirst.mockResolvedValue(null);
      await expect(service.receipt('company-1', 'user-1', { itemId: 'item-1', warehouseId: 'wh-1', quantity: 10 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates a new stock row (via upsert) when the item has never been held at this warehouse', async () => {
      prisma.stockItem.findFirst.mockResolvedValue(validItem);
      prisma.warehouse.findFirst.mockResolvedValue(validWarehouse);
      prisma.stockMovement.create.mockResolvedValue({ id: 'mv-1' });

      await service.receipt('company-1', 'user-1', { itemId: 'item-1', warehouseId: 'wh-1', quantity: 10 });

      const call = prisma.inventoryStock.upsert.mock.calls[0][0];
      expect(call.create.quantityOnHand).toBe(10);
      expect(call.update.quantityOnHand).toEqual({ increment: 10 });
    });
  });

  describe('issue — the sufficiency check is the actual safety boundary', () => {
    beforeEach(() => {
      prisma.stockItem.findFirst.mockResolvedValue(validItem);
      prisma.warehouse.findFirst.mockResolvedValue(validWarehouse);
    });

    it('rejects issuing more than what is currently available, using the CURRENT stock read inside the transaction', async () => {
      prisma.inventoryStock.findUnique.mockResolvedValue({ quantityOnHand: '5' });

      await expect(service.issue('company-1', 'user-1', { itemId: 'item-1', warehouseId: 'wh-1', quantity: 10 })).rejects.toThrow(
        UnprocessableEntityException,
      );
      expect(prisma.inventoryStock.update).not.toHaveBeenCalled();
      expect(prisma.stockMovement.create).not.toHaveBeenCalled();
    });

    it('rejects issuing from a warehouse where this item has NO stock row at all (treated as zero available, not skipped)', async () => {
      prisma.inventoryStock.findUnique.mockResolvedValue(null);

      await expect(service.issue('company-1', 'user-1', { itemId: 'item-1', warehouseId: 'wh-1', quantity: 1 })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('allows issuing exactly the full available quantity (boundary: not strictly less-than)', async () => {
      prisma.inventoryStock.findUnique.mockResolvedValue({ quantityOnHand: '10' });
      prisma.stockMovement.create.mockResolvedValue({ id: 'mv-1' });

      await expect(service.issue('company-1', 'user-1', { itemId: 'item-1', warehouseId: 'wh-1', quantity: 10 })).resolves.toBeDefined();
      expect(prisma.inventoryStock.update).toHaveBeenCalledWith({
        where: { warehouseId_itemId: { warehouseId: 'wh-1', itemId: 'item-1' } },
        data: { quantityOnHand: { decrement: 10 } },
      });
    });
  });

  describe('transfer — atomicity and pairing', () => {
    beforeEach(() => {
      prisma.stockItem.findFirst.mockResolvedValue(validItem);
      prisma.warehouse.findFirst.mockResolvedValue(validWarehouse);
    });

    it('rejects a transfer where source and destination are the same warehouse', async () => {
      await expect(
        service.transfer('company-1', 'user-1', { itemId: 'item-1', fromWarehouseId: 'wh-1', toWarehouseId: 'wh-1', quantity: 5 }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects transferring more than what is available at the SOURCE (destination availability is irrelevant)', async () => {
      prisma.inventoryStock.findUnique.mockResolvedValue({ quantityOnHand: '3' });

      await expect(
        service.transfer('company-1', 'user-1', { itemId: 'item-1', fromWarehouseId: 'wh-1', toWarehouseId: 'wh-2', quantity: 5 }),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.inventoryStock.update).not.toHaveBeenCalled();
    });

    it('creates TWO movements (transfer_out and transfer_in) linked to each other in BOTH directions', async () => {
      prisma.inventoryStock.findUnique.mockResolvedValue({ quantityOnHand: '20' });
      prisma.stockMovement.create.mockResolvedValueOnce({ id: 'out-1' }).mockResolvedValueOnce({ id: 'in-1' });

      const result = await service.transfer('company-1', 'user-1', {
        itemId: 'item-1',
        fromWarehouseId: 'wh-1',
        toWarehouseId: 'wh-2',
        quantity: 5,
      });

      const outCall = prisma.stockMovement.create.mock.calls[0][0];
      const inCall = prisma.stockMovement.create.mock.calls[1][0];
      expect(outCall.data.movementType).toBe('transfer_out');
      expect(outCall.data.warehouseId).toBe('wh-1');
      expect(inCall.data.movementType).toBe('transfer_in');
      expect(inCall.data.warehouseId).toBe('wh-2');
      expect(inCall.data.relatedMovementId).toBe('out-1');

      const linkBackCall = prisma.stockMovement.update.mock.calls[0][0];
      expect(linkBackCall.where.id).toBe('out-1');
      expect(linkBackCall.data.relatedMovementId).toBe('in-1');

      expect(result.outMovement.id).toBe('out-1');
      expect(result.inMovement.id).toBe('in-1');
    });

    it('decrements the source and increments (or creates) the destination stock', async () => {
      prisma.inventoryStock.findUnique.mockResolvedValue({ quantityOnHand: '20' });
      prisma.stockMovement.create.mockResolvedValueOnce({ id: 'out-1' }).mockResolvedValueOnce({ id: 'in-1' });

      await service.transfer('company-1', 'user-1', { itemId: 'item-1', fromWarehouseId: 'wh-1', toWarehouseId: 'wh-2', quantity: 5 });

      const decrementCall = prisma.inventoryStock.update.mock.calls[0][0];
      expect(decrementCall.where.warehouseId_itemId.warehouseId).toBe('wh-1');
      expect(decrementCall.data.quantityOnHand).toEqual({ decrement: 5 });

      const upsertCall = prisma.inventoryStock.upsert.mock.calls[0][0];
      expect(upsertCall.where.warehouseId_itemId.warehouseId).toBe('wh-2');
      expect(upsertCall.update.quantityOnHand).toEqual({ increment: 5 });
    });
  });

  describe('adjustment', () => {
    beforeEach(() => {
      prisma.stockItem.findFirst.mockResolvedValue(validItem);
      prisma.warehouse.findFirst.mockResolvedValue(validWarehouse);
    });

    it('rejects an adjustment where the new quantity equals the current one (nothing to record)', async () => {
      prisma.inventoryStock.findUnique.mockResolvedValue({ quantityOnHand: '10' });

      await expect(
        service.adjustment('company-1', 'user-1', { itemId: 'item-1', warehouseId: 'wh-1', newQuantity: 10 }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('records the ABSOLUTE delta as the movement quantity, and sets the cache directly to newQuantity (not an increment)', async () => {
      prisma.inventoryStock.findUnique.mockResolvedValue({ quantityOnHand: '10' });
      prisma.stockMovement.create.mockResolvedValue({ id: 'mv-1' });

      await service.adjustment('company-1', 'user-1', { itemId: 'item-1', warehouseId: 'wh-1', newQuantity: 7 });

      const upsertCall = prisma.inventoryStock.upsert.mock.calls[0][0];
      expect(upsertCall.update.quantityOnHand).toBe(7);
      const movementCall = prisma.stockMovement.create.mock.calls[0][0];
      expect(movementCall.data.quantity).toBe(3);
      expect(movementCall.data.reason).toMatch(/decrease/i);
    });

    it('treats a never-stocked item (no existing row) as zero for the delta calculation', async () => {
      prisma.inventoryStock.findUnique.mockResolvedValue(null);
      prisma.stockMovement.create.mockResolvedValue({ id: 'mv-1' });

      await service.adjustment('company-1', 'user-1', { itemId: 'item-1', warehouseId: 'wh-1', newQuantity: 15 });

      const movementCall = prisma.stockMovement.create.mock.calls[0][0];
      expect(movementCall.data.quantity).toBe(15);
      expect(movementCall.data.reason).toMatch(/increase/i);
    });
  });
});
