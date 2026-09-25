import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PurchaseOrdersService } from './purchase-orders.service';
import { BillsService } from './bills.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;
  let prisma: any;
  let billsService: { create: jest.Mock };

  function mockTransaction(prismaMock: any) {
    return jest.fn((arg) => {
      if (typeof arg === 'function') return arg(prismaMock);
      return Promise.all(arg);
    });
  }

  beforeEach(async () => {
    prisma = {
      vendor: { findFirst: jest.fn() },
      purchaseOrder: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn().mockResolvedValue(0), update: jest.fn() },
      purchaseOrderItem: { create: jest.fn(), delete: jest.fn(), findMany: jest.fn() },
    };
    prisma.$transaction = mockTransaction(prisma);

    billsService = { create: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: BillsService, useValue: billsService },
      ],
    }).compile();

    service = moduleRef.get(PurchaseOrdersService);
  });

  describe('create', () => {
    it('404s when the vendor does not belong to the caller company', async () => {
      prisma.vendor.findFirst.mockResolvedValue(null);

      await expect(service.create('company-1', 'user-1', { vendorId: 'other-vendor' } as any)).rejects.toThrow(NotFoundException);
    });

    it('allows creating a PO with no items yet (an empty shell to fill in later)', async () => {
      prisma.vendor.findFirst.mockResolvedValue({ id: 'vendor-1' });
      prisma.purchaseOrder.create.mockResolvedValue({ id: 'po-1', items: [] });

      const result = await service.create('company-1', 'user-1', { vendorId: 'vendor-1' } as any);

      expect(result).toBeDefined();
      const call = prisma.purchaseOrder.create.mock.calls[0][0];
      expect(call.data.status).toBe('draft');
      expect(call.data.total.toString()).toBe('0');
    });

    it('computes totals correctly when items are provided at creation', async () => {
      prisma.vendor.findFirst.mockResolvedValue({ id: 'vendor-1' });
      prisma.purchaseOrder.create.mockResolvedValue({ id: 'po-1' });

      await service.create('company-1', 'user-1', {
        vendorId: 'vendor-1',
        items: [{ description: 'Cable', quantity: 10, unitPrice: 50 }],
      } as any);

      const call = prisma.purchaseOrder.create.mock.calls[0][0];
      expect(call.data.total.toString()).toBe('500');
    });
  });

  describe('item mutability', () => {
    const draftPo = { id: 'po-1', status: 'draft', items: [{ id: 'item-1' }] };
    const approvedPo = { id: 'po-1', status: 'approved', items: [{ id: 'item-1' }] };

    it('allows adding an item while draft', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(draftPo);
      prisma.purchaseOrderItem.create.mockResolvedValue({ id: 'item-2' });
      prisma.purchaseOrderItem.findMany.mockResolvedValue([]);

      await expect(
        service.addItem('company-1', 'po-1', { description: 'New item', quantity: 1, unitPrice: 100 } as any),
      ).resolves.toBeDefined();
    });

    it('rejects adding an item once the PO is no longer a draft (e.g. approved)', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(approvedPo);

      await expect(
        service.addItem('company-1', 'po-1', { description: 'New item', quantity: 1, unitPrice: 100 } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects removing an item once the PO is no longer a draft', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(approvedPo);

      await expect(service.removeItem('company-1', 'po-1', 'item-1')).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('submitForApproval', () => {
    it('rejects submitting a non-draft purchase order', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue({ id: 'po-1', status: 'sent', items: [{ id: 'item-1' }] });

      await expect(service.submitForApproval('company-1', 'po-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects submitting a purchase order with no line items', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue({ id: 'po-1', status: 'draft', items: [] });

      await expect(service.submitForApproval('company-1', 'po-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('moves a valid draft to pending_approval and stamps submittedAt', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue({ id: 'po-1', status: 'draft', items: [{ id: 'item-1' }] });
      prisma.purchaseOrder.update.mockResolvedValue({ id: 'po-1', status: 'pending_approval' });

      await service.submitForApproval('company-1', 'po-1');

      const call = prisma.purchaseOrder.update.mock.calls[0][0];
      expect(call.data.status).toBe('pending_approval');
      expect(call.data.submittedAt).toBeInstanceOf(Date);
    });
  });

  describe('approve / reject', () => {
    const pendingPo = { id: 'po-1', status: 'pending_approval', items: [{ id: 'item-1' }] };

    it('rejects approving a PO that is not pending_approval', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue({ ...pendingPo, status: 'draft' });

      await expect(service.approve('company-1', 'user-1', 'po-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('approve() stamps approvedBy with the acting user', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(pendingPo);
      prisma.purchaseOrder.update.mockResolvedValue({ id: 'po-1', status: 'approved' });

      await service.approve('company-1', 'user-42', 'po-1');

      const call = prisma.purchaseOrder.update.mock.calls[0][0];
      expect(call.data.status).toBe('approved');
      expect(call.data.approvedBy).toBe('user-42');
    });

    it('rejects rejecting a PO that is not pending_approval', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue({ ...pendingPo, status: 'approved' });

      await expect(service.reject('company-1', 'po-1', { rejectionReason: 'Too expensive' })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('reject() always records the reason — never a silent rejection', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(pendingPo);
      prisma.purchaseOrder.update.mockResolvedValue({ id: 'po-1', status: 'rejected' });

      await service.reject('company-1', 'po-1', { rejectionReason: 'Budget exceeded' });

      const call = prisma.purchaseOrder.update.mock.calls[0][0];
      expect(call.data.status).toBe('rejected');
      expect(call.data.rejectionReason).toBe('Budget exceeded');
    });
  });

  describe('send', () => {
    it('rejects sending a PO that is not approved', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue({ id: 'po-1', status: 'draft', items: [] });

      await expect(service.send('company-1', 'po-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('moves an approved PO to sent', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue({ id: 'po-1', status: 'approved', items: [] });
      prisma.purchaseOrder.update.mockResolvedValue({ id: 'po-1', status: 'sent' });

      await service.send('company-1', 'po-1');

      expect(prisma.purchaseOrder.update.mock.calls[0][0].data.status).toBe('sent');
    });
  });

  describe('cancel', () => {
    it.each(['draft', 'pending_approval', 'approved'])('allows cancelling from %s', async (status) => {
      prisma.purchaseOrder.findFirst.mockResolvedValue({ id: 'po-1', status, items: [] });
      prisma.purchaseOrder.update.mockResolvedValue({ id: 'po-1', status: 'cancelled' });

      await expect(service.cancel('company-1', 'po-1')).resolves.toBeDefined();
    });

    it.each(['sent', 'closed', 'rejected', 'cancelled'])('rejects cancelling from %s', async (status) => {
      prisma.purchaseOrder.findFirst.mockResolvedValue({ id: 'po-1', status, items: [] });

      await expect(service.cancel('company-1', 'po-1')).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('convertToBill', () => {
    const sentPo = {
      id: 'po-1',
      status: 'sent',
      vendorId: 'vendor-1',
      poNumber: 'PO-2026-0001',
      notes: 'Urgent',
      billId: null,
      items: [
        { description: 'Cable', quantity: '10.00', unitPrice: '50.00', discount: '0.00', tax: '0.00', inventoryItemId: 'inv-item-1' },
      ],
    };

    it('rejects converting a PO that has not been sent yet', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue({ ...sentPo, status: 'approved' });

      await expect(service.convertToBill('company-1', 'user-1', 'po-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects converting a PO that was already converted', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue({ ...sentPo, billId: 'bill-existing' });

      await expect(service.convertToBill('company-1', 'user-1', 'po-1')).rejects.toThrow(ConflictException);
    });

    it('creates a Bill pre-filled with the PO vendor, reference, and mapped items', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(sentPo);
      billsService.create.mockResolvedValue({ id: 'bill-1' });
      prisma.purchaseOrder.update.mockResolvedValue({ id: 'po-1', status: 'closed', billId: 'bill-1' });

      await service.convertToBill('company-1', 'user-1', 'po-1');

      const billDto = billsService.create.mock.calls[0][2];
      expect(billDto.vendorId).toBe('vendor-1');
      expect(billDto.vendorReference).toBe('PO-2026-0001');
      expect(billDto.items[0]).toMatchObject({ description: 'Cable', quantity: 10, unitPrice: 50, inventoryItemId: 'inv-item-1' });
    });

    it('marks the PO closed and links the new bill id', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(sentPo);
      billsService.create.mockResolvedValue({ id: 'bill-1' });
      prisma.purchaseOrder.update.mockResolvedValue({ id: 'po-1', status: 'closed', billId: 'bill-1' });

      await service.convertToBill('company-1', 'user-1', 'po-1');

      const updateCall = prisma.purchaseOrder.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('closed');
      expect(updateCall.data.billId).toBe('bill-1');
    });
  });

  describe('softDelete', () => {
    it('rejects deleting a non-draft purchase order', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue({ id: 'po-1', status: 'sent', items: [] });

      await expect(service.softDelete('company-1', 'po-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('allows deleting a draft purchase order', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue({ id: 'po-1', status: 'draft', items: [] });
      prisma.purchaseOrder.update.mockResolvedValue({ id: 'po-1', deletedAt: new Date() });

      await expect(service.softDelete('company-1', 'po-1')).resolves.toBeDefined();
    });
  });

  describe('findOne', () => {
    it('404s when the purchase order does not exist in the caller company', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(null);
      await expect(service.findOne('company-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});
