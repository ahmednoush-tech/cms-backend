import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InventoryItemsService } from './inventory-items.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('InventoryItemsService', () => {
  let service: InventoryItemsService;
  let prisma: any;

  function mockTransaction(prismaMock: any) {
    return jest.fn((arg) => {
      if (typeof arg === 'function') return arg(prismaMock);
      return Promise.all(arg);
    });
  }

  beforeEach(async () => {
    prisma = {
      inventoryItem: { findUnique: jest.fn(), create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
      inventoryMovement: { create: jest.fn(), findMany: jest.fn() },
      journalEntry: { create: jest.fn(), count: jest.fn().mockResolvedValue(0), findFirst: jest.fn() },
    };
    prisma.$transaction = mockTransaction(prisma);

    const moduleRef = await Test.createTestingModule({
      providers: [InventoryItemsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(InventoryItemsService);
  });

  describe('create', () => {
    it('rejects a duplicate SKU within the same company', async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create('company-1', 'user-1', { sku: 'CBL-100', name: 'Cable' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('creates opening stock movement with NO journal entry when opening quantity is provided', async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue(null);
      prisma.inventoryItem.create.mockResolvedValue({ id: 'item-1' });

      await service.create('company-1', 'user-1', { sku: 'CBL-100', name: 'Cable', openingQuantity: 50, openingUnitCost: 2 } as any);

      expect(prisma.inventoryMovement.create).toHaveBeenCalled();
      const call = prisma.inventoryMovement.create.mock.calls[0][0];
      expect(call.data.journalEntryId).toBeUndefined();
      expect(call.data.type).toBe('opening');
      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
    });

    it('does NOT create a movement at all when opening quantity is zero/omitted', async () => {
      prisma.inventoryItem.findUnique.mockResolvedValue(null);
      prisma.inventoryItem.create.mockResolvedValue({ id: 'item-1' });

      await service.create('company-1', 'user-1', { sku: 'CBL-100', name: 'Cable' } as any);

      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('adjustStock', () => {
    const baseItem = {
      id: 'item-1',
      sku: 'CBL-100',
      name: 'Cable',
      quantityOnHand: '100.000',
      averageUnitCost: '2.0000',
      inventoryAccountId: 'acc-inventory',
    };

    it('rejects adjusting an item with no inventory account configured', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({ ...baseItem, inventoryAccountId: null });

      await expect(
        service.adjustStock('company-1', 'user-1', { inventoryItemId: 'item-1', direction: 'increase', quantity: 10, unitCost: 3, offsetAccountId: 'acc-x' } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('requires unitCost when increasing stock', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(baseItem);

      await expect(
        service.adjustStock('company-1', 'user-1', { inventoryItemId: 'item-1', direction: 'increase', quantity: 10, offsetAccountId: 'acc-x' } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('recalculates weighted average cost correctly on an increase', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(baseItem);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.inventoryItem.update.mockResolvedValue({ id: 'item-1' });

      await service.adjustStock('company-1', 'user-1', { inventoryItemId: 'item-1', direction: 'increase', quantity: 50, unitCost: 5, offsetAccountId: 'acc-x' } as any);

      const updateCall = prisma.inventoryItem.update.mock.calls[0][0];
      expect(updateCall.data.quantityOnHand.toString()).toBe('150');
      expect(updateCall.data.averageUnitCost.toString()).toBe('3');
    });

    it('never changes the average cost on a decrease', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(baseItem);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.inventoryItem.update.mockResolvedValue({ id: 'item-1' });

      await service.adjustStock('company-1', 'user-1', { inventoryItemId: 'item-1', direction: 'decrease', quantity: 20, offsetAccountId: 'acc-x' } as any);

      const updateCall = prisma.inventoryItem.update.mock.calls[0][0];
      expect(updateCall.data.quantityOnHand.toString()).toBe('80');
      expect(updateCall.data.averageUnitCost.toString()).toBe('2');
    });

    it('rejects decreasing more than the quantity on hand', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(baseItem);

      await expect(
        service.adjustStock('company-1', 'user-1', { inventoryItemId: 'item-1', direction: 'decrease', quantity: 500, offsetAccountId: 'acc-x' } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('posts debit Inventory / credit offset account on an increase', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(baseItem);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.inventoryItem.update.mockResolvedValue({ id: 'item-1' });

      await service.adjustStock('company-1', 'user-1', { inventoryItemId: 'item-1', direction: 'increase', quantity: 10, unitCost: 5, offsetAccountId: 'acc-found-stock' } as any);

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      expect(lines[0]).toMatchObject({ accountId: 'acc-inventory' });
      expect(lines[0].debit.toString()).toBe('50');
      expect(lines[1]).toMatchObject({ accountId: 'acc-found-stock' });
      expect(lines[1].credit.toString()).toBe('50');
    });

    it('posts debit offset account / credit Inventory on a decrease', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(baseItem);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.inventoryItem.update.mockResolvedValue({ id: 'item-1' });

      await service.adjustStock('company-1', 'user-1', { inventoryItemId: 'item-1', direction: 'decrease', quantity: 10, offsetAccountId: 'acc-shrinkage' } as any);

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      expect(lines[0]).toMatchObject({ accountId: 'acc-shrinkage' });
      expect(lines[0].debit.toString()).toBe('20');
      expect(lines[1]).toMatchObject({ accountId: 'acc-inventory' });
      expect(lines[1].credit.toString()).toBe('20');
    });

    it('records a movement row with the correct type for each direction', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(baseItem);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.inventoryItem.update.mockResolvedValue({ id: 'item-1' });

      await service.adjustStock('company-1', 'user-1', { inventoryItemId: 'item-1', direction: 'increase', quantity: 10, unitCost: 5, offsetAccountId: 'acc-x' } as any);

      expect(prisma.inventoryMovement.create.mock.calls[0][0].data.type).toBe('adjustment_increase');
    });
  });

  describe('findOne', () => {
    it('404s when the item does not exist in the caller company', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);
      await expect(service.findOne('company-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findMovements', () => {
    it('404s when the item does not exist', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue(null);
      await expect(service.findMovements('company-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('orders movements most-recent-first', async () => {
      prisma.inventoryItem.findFirst.mockResolvedValue({ id: 'item-1' });
      prisma.inventoryMovement.findMany.mockResolvedValue([]);

      await service.findMovements('company-1', 'item-1');

      expect(prisma.inventoryMovement.findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: 'desc' });
    });
  });
});
