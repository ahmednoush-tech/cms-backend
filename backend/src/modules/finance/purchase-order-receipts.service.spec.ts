import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PurchaseOrderReceiptsService } from './purchase-order-receipts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryMovementsService } from '../inventory/inventory-movements.service';

describe('PurchaseOrderReceiptsService', () => {
  let service: PurchaseOrderReceiptsService;
  let prisma: any;
  let inventoryMovementsService: any;

  const sentPo = (items: any[]) => ({ id: 'po-1', poNumber: 'PO-1001', status: 'sent', items });

  beforeEach(async () => {
    prisma = {
      purchaseOrder: { findFirst: jest.fn() },
      purchaseOrderItem: { update: jest.fn() },
    };
    inventoryMovementsService = { receipt: jest.fn().mockResolvedValue({ id: 'mv-1' }) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PurchaseOrderReceiptsService,
        { provide: PrismaService, useValue: prisma },
        { provide: InventoryMovementsService, useValue: inventoryMovementsService },
      ],
    }).compile();

    service = moduleRef.get(PurchaseOrderReceiptsService);
  });

  it('404s when the purchase order does not exist in this company', async () => {
    prisma.purchaseOrder.findFirst.mockResolvedValue(null);
    await expect(
      service.receive('company-1', 'user-1', 'po-1', { warehouseId: 'wh-1', lines: [{ purchaseOrderItemId: 'item-1', quantity: 5 }] }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects receiving against a purchase order that has not been sent yet', async () => {
    prisma.purchaseOrder.findFirst.mockResolvedValue({ id: 'po-1', status: 'draft', items: [] });
    await expect(
      service.receive('company-1', 'user-1', 'po-1', { warehouseId: 'wh-1', lines: [{ purchaseOrderItemId: 'item-1', quantity: 5 }] }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('404s when a line references an item id that does not belong to this purchase order', async () => {
    prisma.purchaseOrder.findFirst.mockResolvedValue(sentPo([{ id: 'item-1', quantity: '10', receivedQuantity: '0', stockItemId: null }]));
    await expect(
      service.receive('company-1', 'user-1', 'po-1', { warehouseId: 'wh-1', lines: [{ purchaseOrderItemId: 'not-on-this-po', quantity: 5 }] }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects receiving more than what remains unreceived on a line', async () => {
    prisma.purchaseOrder.findFirst.mockResolvedValue(sentPo([{ id: 'item-1', quantity: '10', receivedQuantity: '7', stockItemId: 'stock-1' }]));
    await expect(
      service.receive('company-1', 'user-1', 'po-1', { warehouseId: 'wh-1', lines: [{ purchaseOrderItemId: 'item-1', quantity: 5 }] }),
    ).rejects.toThrow(UnprocessableEntityException);
    expect(inventoryMovementsService.receipt).not.toHaveBeenCalled();
  });

  it('allows receiving EXACTLY the remaining amount (boundary case)', async () => {
    prisma.purchaseOrder.findFirst.mockResolvedValue(sentPo([{ id: 'item-1', quantity: '10', receivedQuantity: '7', stockItemId: 'stock-1' }]));
    prisma.purchaseOrderItem.update.mockResolvedValue({});

    await expect(
      service.receive('company-1', 'user-1', 'po-1', { warehouseId: 'wh-1', lines: [{ purchaseOrderItemId: 'item-1', quantity: 3 }] }),
    ).resolves.toBeDefined();
  });

  it('creates a stock movement for a line WITH a stockItemId, using the real warehouse and PO-referencing reason', async () => {
    prisma.purchaseOrder.findFirst.mockResolvedValue(sentPo([{ id: 'item-1', quantity: '10', receivedQuantity: '0', stockItemId: 'stock-1' }]));
    prisma.purchaseOrderItem.update.mockResolvedValue({});

    await service.receive('company-1', 'user-1', 'po-1', { warehouseId: 'wh-1', lines: [{ purchaseOrderItemId: 'item-1', quantity: 4 }] });

    expect(inventoryMovementsService.receipt).toHaveBeenCalledWith('company-1', 'user-1', {
      itemId: 'stock-1',
      warehouseId: 'wh-1',
      quantity: 4,
      reason: 'Received against PO PO-1001',
    });
  });

  it('does NOT create a stock movement for a line with no stockItemId (e.g. a service line), but still updates receivedQuantity', async () => {
    prisma.purchaseOrder.findFirst.mockResolvedValue(sentPo([{ id: 'item-1', quantity: '10', receivedQuantity: '0', stockItemId: null }]));
    prisma.purchaseOrderItem.update.mockResolvedValue({});

    const result = await service.receive('company-1', 'user-1', 'po-1', { warehouseId: 'wh-1', lines: [{ purchaseOrderItemId: 'item-1', quantity: 4 }] });

    expect(inventoryMovementsService.receipt).not.toHaveBeenCalled();
    expect(prisma.purchaseOrderItem.update).toHaveBeenCalledWith({ where: { id: 'item-1' }, data: { receivedQuantity: { increment: 4 } } });
    expect(result.results[0].movementCreated).toBe(false);
  });

  it('processes multiple lines in the same request, each against its own remaining-quantity check', async () => {
    prisma.purchaseOrder.findFirst.mockResolvedValue(
      sentPo([
        { id: 'item-1', quantity: '10', receivedQuantity: '0', stockItemId: 'stock-1' },
        { id: 'item-2', quantity: '5', receivedQuantity: '0', stockItemId: 'stock-2' },
      ]),
    );
    prisma.purchaseOrderItem.update.mockResolvedValue({});

    const result = await service.receive('company-1', 'user-1', 'po-1', {
      warehouseId: 'wh-1',
      lines: [
        { purchaseOrderItemId: 'item-1', quantity: 6 },
        { purchaseOrderItemId: 'item-2', quantity: 5 },
      ],
    });

    expect(inventoryMovementsService.receipt).toHaveBeenCalledTimes(2);
    expect(result.results).toHaveLength(2);
  });
});
