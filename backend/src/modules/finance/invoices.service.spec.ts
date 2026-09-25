import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { PeriodLockService } from './period-lock.service';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryMovementsService } from '../inventory/inventory-movements.service';
import { ZatcaInvoiceSubmissionService } from '../zatca-phase2/zatca-invoice-submission.service';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let prisma: any;
  let periodLock: { assertDateNotLocked: jest.Mock };
  let inventoryMovementsService: { issue: jest.Mock };
  let zatcaSubmissionService: { submitInvoice: jest.Mock };

  function mockTransaction(prismaMock: any) {
    return jest.fn((arg) => {
      if (typeof arg === 'function') return arg(prismaMock);
      return Promise.all(arg);
    });
  }

  beforeEach(async () => {
    prisma = {
      quotation: { findFirst: jest.fn() },
      customer: { findFirst: jest.fn() },
      invoice: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      financeSettings: { findUnique: jest.fn() },
      inventoryItem: { update: jest.fn() },
      inventoryMovement: { create: jest.fn() },
      inventoryStock: { findUnique: jest.fn() },
      journalEntry: {
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
      },
    };
    prisma.$transaction = mockTransaction(prisma);

    periodLock = { assertDateNotLocked: jest.fn().mockResolvedValue(undefined) };
    inventoryMovementsService = { issue: jest.fn().mockResolvedValue({ id: 'stock-mv-1' }) };
    zatcaSubmissionService = { submitInvoice: jest.fn().mockResolvedValue(null) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        InvoicesService,
        { provide: PrismaService, useValue: prisma },
        { provide: PeriodLockService, useValue: periodLock },
        { provide: InventoryMovementsService, useValue: inventoryMovementsService },
        { provide: ZatcaInvoiceSubmissionService, useValue: zatcaSubmissionService },
      ],
    }).compile();

    service = moduleRef.get(InvoicesService);
  });

  describe('create — from an accepted quotation', () => {
    it('copies the customer and items from the quotation', async () => {
      prisma.quotation.findFirst.mockResolvedValue({
        id: 'q-1',
        customerId: 'cust-1',
        status: 'accepted',
        items: [{ description: 'Consulting', quantity: '2', unitPrice: '500', discount: '0', tax: '0' }],
      });
      prisma.invoice.findUnique.mockResolvedValue(null);
      prisma.invoice.create.mockResolvedValue({ id: 'inv-1', status: 'draft' });

      await service.create('company-1', 'user-1', { quotationId: 'q-1', issueDate: '2026-06-01' } as any);

      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ customerId: 'cust-1', quotationId: 'q-1' }) }),
      );
    });

    it('rejects invoicing a quotation that is not accepted', async () => {
      prisma.quotation.findFirst.mockResolvedValue({ id: 'q-1', status: 'draft', items: [] });

      await expect(
        service.create('company-1', 'user-1', { quotationId: 'q-1', issueDate: '2026-06-01' } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('carries stockItemId over from the quotation line to the invoice line — without this, a stock-catalog link made on a quotation would silently vanish on conversion', async () => {
      prisma.quotation.findFirst.mockResolvedValue({
        id: 'q-1',
        customerId: 'cust-1',
        status: 'accepted',
        items: [{ description: 'Widget', quantity: '2', unitPrice: '500', discount: '0', tax: '0', stockItemId: 'stock-42' }],
      });
      prisma.invoice.findUnique.mockResolvedValue(null);
      prisma.invoice.create.mockResolvedValue({ id: 'inv-1', status: 'draft' });

      await service.create('company-1', 'user-1', { quotationId: 'q-1', issueDate: '2026-06-01' } as any);

      const createCall = prisma.invoice.create.mock.calls[0][0];
      expect(createCall.data.items.create[0].stockItemId).toBe('stock-42');
    });

    it('leaves stockItemId undefined (not a crash) for a quotation line with no stock item linked', async () => {
      prisma.quotation.findFirst.mockResolvedValue({
        id: 'q-1',
        customerId: 'cust-1',
        status: 'accepted',
        items: [{ description: 'Consulting hours', quantity: '2', unitPrice: '500', discount: '0', tax: '0', stockItemId: null }],
      });
      prisma.invoice.findUnique.mockResolvedValue(null);
      prisma.invoice.create.mockResolvedValue({ id: 'inv-1', status: 'draft' });

      await service.create('company-1', 'user-1', { quotationId: 'q-1', issueDate: '2026-06-01' } as any);

      const createCall = prisma.invoice.create.mock.calls[0][0];
      expect(createCall.data.items.create[0].stockItemId).toBeUndefined();
    });

    it('rejects invoicing a quotation that has already been invoiced', async () => {
      prisma.quotation.findFirst.mockResolvedValue({ id: 'q-1', status: 'accepted', customerId: 'cust-1', items: [] });
      prisma.invoice.findUnique.mockResolvedValue({ id: 'existing-invoice' });

      await expect(
        service.create('company-1', 'user-1', { quotationId: 'q-1', issueDate: '2026-06-01' } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('404s when the quotation does not exist in the caller company', async () => {
      prisma.quotation.findFirst.mockResolvedValue(null);

      await expect(
        service.create('company-1', 'user-1', { quotationId: 'missing', issueDate: '2026-06-01' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create — standalone (no quotation)', () => {
    it('requires customerId and at least one item', async () => {
      await expect(
        service.create('company-1', 'user-1', { issueDate: '2026-06-01' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a customerId that does not belong to the caller company', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.create('company-1', 'user-1', {
          customerId: 'cust-1',
          issueDate: '2026-06-01',
          items: [{ description: 'x', quantity: 1, unitPrice: 100 }],
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a draft invoice with computed totals', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.invoice.create.mockResolvedValue({ id: 'inv-1', status: 'draft', total: '200.00' });

      const result = await service.create('company-1', 'user-1', {
        customerId: 'cust-1',
        issueDate: '2026-06-01',
        items: [{ description: 'Item', quantity: 2, unitPrice: 100 }],
      } as any);

      expect(result.status).toBe('draft');
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ subtotal: expect.anything(), total: expect.anything(), status: 'draft' }),
        }),
      );
    });
  });

  describe('issue', () => {
    const draftInvoice = {
      id: 'inv-1',
      status: 'draft',
      issueDate: new Date('2026-06-15'),
      invoiceNumber: 'INV-2026-0001',
      subtotal: '1000.00',
      discount: '0.00',
      tax: '150.00',
      total: '1150.00',
      items: [{ id: 'item-1' }],
      customer: {},
      payments: [],
    };

    it('rejects issuing an invoice with no line items', async () => {
      prisma.invoice.findFirst.mockResolvedValue({ ...draftInvoice, items: [] });

      await expect(service.issue('company-1', 'user-1', 'inv-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it("checks the period lock using the invoice's issueDate", async () => {
      prisma.invoice.findFirst.mockResolvedValue(draftInvoice);
      prisma.financeSettings.findUnique.mockResolvedValue({
        defaultReceivableAccountId: 'acc-ar',
        defaultRevenueAccountId: 'acc-rev',
        defaultTaxPayableAccountId: 'acc-tax',
      });
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.invoice.update.mockResolvedValue({ id: 'inv-1', status: 'sent' });

      await service.issue('company-1', 'user-1', 'inv-1');

      expect(periodLock.assertDateNotLocked).toHaveBeenCalledWith('company-1', draftInvoice.issueDate);
    });

    it('rejects issuing when Finance Settings has no receivable/revenue account configured', async () => {
      prisma.invoice.findFirst.mockResolvedValue(draftInvoice);
      prisma.financeSettings.findUnique.mockResolvedValue({ defaultReceivableAccountId: null });

      await expect(service.issue('company-1', 'user-1', 'inv-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects issuing a taxed invoice when no Tax Payable account is configured', async () => {
      prisma.invoice.findFirst.mockResolvedValue(draftInvoice);
      prisma.financeSettings.findUnique.mockResolvedValue({
        defaultReceivableAccountId: 'acc-ar',
        defaultRevenueAccountId: 'acc-rev',
        defaultTaxPayableAccountId: null,
      });

      await expect(service.issue('company-1', 'user-1', 'inv-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('posts a balanced journal entry (debit AR = total, credit revenue + tax) and moves the invoice to sent', async () => {
      prisma.invoice.findFirst.mockResolvedValue(draftInvoice);
      prisma.financeSettings.findUnique.mockResolvedValue({
        defaultReceivableAccountId: 'acc-ar',
        defaultRevenueAccountId: 'acc-rev',
        defaultTaxPayableAccountId: 'acc-tax',
      });
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.invoice.update.mockResolvedValue({ id: 'inv-1', status: 'sent', journalEntryId: 'je-1' });

      const result = await service.issue('company-1', 'user-1', 'inv-1');

      expect(result.status).toBe('sent');
      const createCall = prisma.journalEntry.create.mock.calls[0][0];
      expect(createCall.data.status).toBe('posted');
      const lines = createCall.data.lines.create;
      expect(lines).toHaveLength(3);
      expect(prisma.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'sent', journalEntryId: 'je-1' }) }),
      );
    });

    it('omits the tax line entirely when the invoice has zero tax', async () => {
      prisma.invoice.findFirst.mockResolvedValue({ ...draftInvoice, tax: '0.00', total: '1000.00' });
      prisma.financeSettings.findUnique.mockResolvedValue({
        defaultReceivableAccountId: 'acc-ar',
        defaultRevenueAccountId: 'acc-rev',
        defaultTaxPayableAccountId: null,
      });
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.invoice.update.mockResolvedValue({ id: 'inv-1', status: 'sent' });

      await service.issue('company-1', 'user-1', 'inv-1');

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      expect(lines).toHaveLength(2);
    });

    it('rejects issuing an invoice that is not a draft', async () => {
      prisma.invoice.findFirst.mockResolvedValue({ ...draftInvoice, status: 'sent' });

      await expect(service.issue('company-1', 'user-1', 'inv-1')).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('cancel / softDelete — draft-only gating', () => {
    it('rejects cancelling a non-draft invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-1', status: 'sent', items: [], payments: [] });

      await expect(service.cancel('company-1', 'inv-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects deleting a non-draft invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue({ id: 'inv-1', status: 'paid', items: [], payments: [] });

      await expect(service.softDelete('company-1', 'inv-1')).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('getZatcaQrCode', () => {
    const issuedInvoice = {
      id: 'inv-1',
      status: 'sent',
      issuedAt: new Date('2026-06-15T14:30:00.000Z'),
      total: '1150.00',
      tax: '150.00',
      items: [],
      customer: {},
      payments: [],
    };

    it('rejects generating a QR code for a draft invoice (issuedAt is not set yet)', async () => {
      prisma.invoice.findFirst.mockResolvedValue({ ...issuedInvoice, issuedAt: null });

      await expect(service.getZatcaQrCode('company-1', 'inv-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects when Finance Settings has no seller name or VAT registration number configured', async () => {
      prisma.invoice.findFirst.mockResolvedValue(issuedInvoice);
      prisma.financeSettings.findUnique.mockResolvedValue({ sellerName: null, vatRegistrationNumber: null });

      await expect(service.getZatcaQrCode('company-1', 'inv-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('produces a base64 QR string using the invoice total, tax, and issuedAt timestamp', async () => {
      prisma.invoice.findFirst.mockResolvedValue(issuedInvoice);
      prisma.financeSettings.findUnique.mockResolvedValue({
        sellerName: 'Arkan Integrated Systems',
        vatRegistrationNumber: '300000000000003',
      });

      const qr = await service.getZatcaQrCode('company-1', 'inv-1');

      expect(typeof qr).toBe('string');
      expect(qr.length).toBeGreaterThan(0);
      expect(() => Buffer.from(qr, 'base64')).not.toThrow();
    });
  });

  describe('issue — inventory/COGS integration (F15)', () => {
    const financeSettings = {
      defaultReceivableAccountId: 'acc-ar',
      defaultRevenueAccountId: 'acc-rev',
      defaultTaxPayableAccountId: 'acc-tax',
    };

    function invoiceWithItem(itemOverrides: any) {
      return {
        id: 'inv-1',
        status: 'draft',
        issueDate: new Date('2026-06-15'),
        invoiceNumber: 'INV-2026-0001',
        subtotal: '500.00',
        discount: '0.00',
        tax: '0.00',
        total: '500.00',
        customer: {},
        payments: [],
        items: [
          {
            id: 'item-1',
            description: 'Cable',
            quantity: '10.00',
            total: '500.00',
            tax: '0.00',
            inventoryItemId: 'inv-item-1',
            inventoryItem: {
              id: 'inv-item-1',
              name: 'CAT6 Cable',
              quantityOnHand: '100.000',
              averageUnitCost: '50.0000',
              inventoryAccountId: 'acc-inventory',
              cogsAccountId: 'acc-cogs',
              ...itemOverrides,
            },
          },
        ],
      };
    }

    it('an invoice with NO inventory-linked lines produces the exact same journal entry as before (zero-touch)', async () => {
      const plainInvoice = {
        id: 'inv-1', status: 'draft', issueDate: new Date('2026-06-15'), invoiceNumber: 'INV-2026-0001',
        subtotal: '1000.00', discount: '0.00', tax: '150.00', total: '1150.00',
        items: [{ id: 'item-1', inventoryItemId: null }], customer: {}, payments: [],
      };
      prisma.invoice.findFirst.mockResolvedValue(plainInvoice);
      prisma.financeSettings.findUnique.mockResolvedValue(financeSettings);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.invoice.update.mockResolvedValue({ id: 'inv-1', status: 'sent' });

      await service.issue('company-1', 'user-1', 'inv-1');

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      expect(lines).toHaveLength(3); // AR debit, Revenue credit, Tax credit — unchanged
      expect(prisma.inventoryMovement.create).not.toHaveBeenCalled();
    });

    it('rejects issuing when the linked inventory item has no inventory/COGS account configured', async () => {
      prisma.invoice.findFirst.mockResolvedValue(invoiceWithItem({ cogsAccountId: null }));
      prisma.financeSettings.findUnique.mockResolvedValue(financeSettings);

      await expect(service.issue('company-1', 'user-1', 'inv-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects issuing when quantity requested exceeds quantity on hand', async () => {
      prisma.invoice.findFirst.mockResolvedValue(invoiceWithItem({ quantityOnHand: '5.000' }));
      prisma.financeSettings.findUnique.mockResolvedValue(financeSettings);

      await expect(service.issue('company-1', 'user-1', 'inv-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('adds a COGS debit / Inventory credit leg using the CURRENT average cost, on top of the normal AR/Revenue lines', async () => {
      prisma.invoice.findFirst.mockResolvedValue(invoiceWithItem({}));
      prisma.financeSettings.findUnique.mockResolvedValue(financeSettings);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.invoice.update.mockResolvedValue({ id: 'inv-1', status: 'sent' });

      await service.issue('company-1', 'user-1', 'inv-1');

      const lines = prisma.journalEntry.create.mock.calls[0][0].data.lines.create;
      // AR debit, Revenue credit, COGS debit, Inventory credit = 4 lines (no tax on this fixture)
      expect(lines).toHaveLength(4);
      const cogsLine = lines.find((l: any) => l.accountId === 'acc-cogs');
      const invLine = lines.find((l: any) => l.accountId === 'acc-inventory');
      expect(cogsLine.debit.toString()).toBe('500'); // 10 units * 50 avg cost
      expect(invLine.credit.toString()).toBe('500');
    });

    it('decreases stock and records a "sale" movement referencing the invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue(invoiceWithItem({}));
      prisma.financeSettings.findUnique.mockResolvedValue(financeSettings);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.invoice.update.mockResolvedValue({ id: 'inv-1', status: 'sent' });

      await service.issue('company-1', 'user-1', 'inv-1');

      const movementCall = prisma.inventoryMovement.create.mock.calls[0][0];
      expect(movementCall.data.type).toBe('sale');
      expect(movementCall.data.referenceType).toBe('invoice');
      expect(movementCall.data.quantityAfter.toString()).toBe('90'); // 100 - 10

      const updateCall = prisma.inventoryItem.update.mock.calls[0][0];
      expect(updateCall.data.quantityOnHand.toString()).toBe('90');
    });
  });

  describe('issue — NEW multi-warehouse stock integration', () => {
    const financeSettings = {
      defaultReceivableAccountId: 'acc-ar',
      defaultRevenueAccountId: 'acc-rev',
      defaultTaxPayableAccountId: 'acc-tax',
    };

    function invoiceWithStockLine(overrides: any = {}) {
      return {
        id: 'inv-1',
        status: 'draft',
        issueDate: new Date('2026-06-15'),
        invoiceNumber: 'INV-2026-0001',
        subtotal: '500.00',
        discount: '0.00',
        tax: '0.00',
        total: '500.00',
        warehouseId: 'wh-1',
        customer: {},
        payments: [],
        items: [{ id: 'item-1', description: 'Widget', quantity: '5.00', total: '500.00', tax: '0.00', stockItemId: 'stock-1', inventoryItemId: null }],
        ...overrides,
      };
    }

    it('an invoice with no stockItemId lines never touches InventoryMovementsService (zero-touch)', async () => {
      const plainInvoice = invoiceWithStockLine({ items: [{ id: 'item-1', quantity: '5.00', total: '500.00', tax: '0.00', stockItemId: null, inventoryItemId: null }] });
      prisma.invoice.findFirst.mockResolvedValue(plainInvoice);
      prisma.financeSettings.findUnique.mockResolvedValue(financeSettings);
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.invoice.update.mockResolvedValue({ id: 'inv-1', status: 'sent' });

      await service.issue('company-1', 'user-1', 'inv-1');

      expect(inventoryMovementsService.issue).not.toHaveBeenCalled();
    });

    it('rejects issuing when a stockItemId line exists but no warehouseId is set on the invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue(invoiceWithStockLine({ warehouseId: null }));
      prisma.financeSettings.findUnique.mockResolvedValue(financeSettings);

      await expect(service.issue('company-1', 'user-1', 'inv-1')).rejects.toThrow(UnprocessableEntityException);
      expect(inventoryMovementsService.issue).not.toHaveBeenCalled();
    });

    it('rejects issuing when the warehouse does not have enough stock — checked BEFORE the GL transaction opens', async () => {
      prisma.invoice.findFirst.mockResolvedValue(invoiceWithStockLine());
      prisma.financeSettings.findUnique.mockResolvedValue(financeSettings);
      prisma.inventoryStock.findUnique.mockResolvedValue({ quantityOnHand: '2' }); // only 2 available, invoice wants 5

      await expect(service.issue('company-1', 'user-1', 'inv-1')).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.journalEntry.create).not.toHaveBeenCalled();
      expect(inventoryMovementsService.issue).not.toHaveBeenCalled();
    });

    it('treats a warehouse with NO stock row for this item as zero available (not skipped)', async () => {
      prisma.invoice.findFirst.mockResolvedValue(invoiceWithStockLine());
      prisma.financeSettings.findUnique.mockResolvedValue(financeSettings);
      prisma.inventoryStock.findUnique.mockResolvedValue(null);

      await expect(service.issue('company-1', 'user-1', 'inv-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('calls InventoryMovementsService.issue() AFTER the GL transaction commits, with the invoice-referencing reason', async () => {
      prisma.invoice.findFirst.mockResolvedValue(invoiceWithStockLine());
      prisma.financeSettings.findUnique.mockResolvedValue(financeSettings);
      prisma.inventoryStock.findUnique.mockResolvedValue({ quantityOnHand: '100' });
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.invoice.update.mockResolvedValue({ id: 'inv-1', status: 'sent' });

      await service.issue('company-1', 'user-1', 'inv-1');

      expect(inventoryMovementsService.issue).toHaveBeenCalledWith('company-1', 'user-1', {
        itemId: 'stock-1',
        warehouseId: 'wh-1',
        quantity: 5,
        reason: 'Issued against invoice INV-2026-0001',
      });
    });

    it('creates NO journal lines of its own for the new-system deduction — the GL entry is unaffected by stockItemId lines', async () => {
      prisma.invoice.findFirst.mockResolvedValue(invoiceWithStockLine());
      prisma.financeSettings.findUnique.mockResolvedValue(financeSettings);
      prisma.inventoryStock.findUnique.mockResolvedValue({ quantityOnHand: '100' });
      prisma.journalEntry.create.mockResolvedValue({ id: 'je-1' });
      prisma.invoice.update.mockResolvedValue({ id: 'inv-1', status: 'sent' });

      await service.issue('company-1', 'user-1', 'inv-1');

      const journalCall = prisma.journalEntry.create.mock.calls[0][0];
      const lineCount = journalCall.data.lines.create.length;
      expect(lineCount).toBe(2); // AR debit + Revenue credit only — no tax (0.00), no extra COGS/inventory lines
    });
  });
});
