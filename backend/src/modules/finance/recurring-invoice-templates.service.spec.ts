import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { RecurringInvoiceTemplatesService } from './recurring-invoice-templates.service';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('RecurringInvoiceTemplatesService', () => {
  let service: RecurringInvoiceTemplatesService;
  let prisma: any;
  let invoicesService: { create: jest.Mock };

  beforeEach(async () => {
    prisma = {
      customer: { findFirst: jest.fn() },
      currency: { findFirst: jest.fn() },
      recurringInvoiceTemplate: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      recurringInvoiceTemplateItem: { deleteMany: jest.fn() },
      invoice: { update: jest.fn() },
    };
    invoicesService = { create: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RecurringInvoiceTemplatesService,
        { provide: PrismaService, useValue: prisma },
        { provide: InvoicesService, useValue: invoicesService },
      ],
    }).compile();

    service = moduleRef.get(RecurringInvoiceTemplatesService);
  });

  const validDto = {
    customerId: 'cust-1',
    name: 'Monthly Maintenance',
    frequency: 'monthly' as const,
    startDate: '2026-01-31',
    items: [{ description: 'Maintenance fee', quantity: 1, unitPrice: 500 }],
  };

  describe('create', () => {
    it('404s when the customer does not belong to the caller company', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);
      await expect(service.create('company-1', 'user-1', validDto)).rejects.toThrow(NotFoundException);
    });

    it('sets nextGenerationDate equal to startDate on creation — the first invoice is due immediately at start', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.recurringInvoiceTemplate.create.mockResolvedValue({ id: 'template-1' });

      await service.create('company-1', 'user-1', validDto);

      const call = prisma.recurringInvoiceTemplate.create.mock.calls[0][0];
      expect(call.data.nextGenerationDate.toISOString().slice(0, 10)).toBe('2026-01-31');
    });

    it('rejects an endDate before startDate', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      await expect(service.create('company-1', 'user-1', { ...validDto, endDate: '2025-01-01' })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('rejects a non-SAR currency with no exchange rate', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.currency.findFirst.mockResolvedValue({ code: 'USD', isActive: true });
      await expect(service.create('company-1', 'user-1', { ...validDto, currencyCode: 'USD' })).rejects.toThrow(
        /exchangeRateToBase is required/,
      );
    });
  });

  describe('pause / resume / cancel', () => {
    it('rejects pausing a template that is not active', async () => {
      prisma.recurringInvoiceTemplate.findFirst.mockResolvedValue({ id: 't-1', status: 'paused' });
      await expect(service.pause('company-1', 't-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects resuming a template that is not paused', async () => {
      prisma.recurringInvoiceTemplate.findFirst.mockResolvedValue({ id: 't-1', status: 'active' });
      await expect(service.resume('company-1', 't-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects cancelling an already-cancelled template', async () => {
      prisma.recurringInvoiceTemplate.findFirst.mockResolvedValue({ id: 't-1', status: 'cancelled' });
      await expect(service.cancel('company-1', 't-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('allows cancelling from active or paused', async () => {
      prisma.recurringInvoiceTemplate.findFirst.mockResolvedValue({ id: 't-1', status: 'paused' });
      prisma.recurringInvoiceTemplate.update.mockResolvedValue({ id: 't-1', status: 'cancelled' });
      await expect(service.cancel('company-1', 't-1')).resolves.toBeDefined();
    });
  });

  describe('generateDue — the calendar-aware period advancement', () => {
    const dueTemplate = {
      id: 'template-1',
      name: 'Monthly Maintenance',
      customerId: 'cust-1',
      currencyCode: 'SAR',
      exchangeRateToBase: '1.000000',
      frequency: 'monthly',
      nextGenerationDate: new Date(2026, 0, 31),
      endDate: null,
      items: [{ description: 'Fee', quantity: '1.00', unitPrice: '500.00', discount: '0.00', tax: '0.00' }],
    };

    it('advances Jan 31 + 1 month to Feb 28 (2026 is not a leap year) — never rolls into March', async () => {
      prisma.recurringInvoiceTemplate.findMany.mockResolvedValue([dueTemplate]);
      invoicesService.create.mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV-2026-0001' });
      prisma.invoice.update.mockResolvedValue({});
      prisma.recurringInvoiceTemplate.update.mockResolvedValue({});

      await service.generateDue('company-1', 'user-1');

      const updateCall = prisma.recurringInvoiceTemplate.update.mock.calls[0][0];
      expect(updateCall.data.nextGenerationDate.toISOString().slice(0, 10)).toBe('2026-02-28');
    });

    it('advances Jan 31 + 1 month to Feb 29 in a leap year (2028)', async () => {
      const leapYearTemplate = { ...dueTemplate, nextGenerationDate: new Date(2028, 0, 31) };
      prisma.recurringInvoiceTemplate.findMany.mockResolvedValue([leapYearTemplate]);
      invoicesService.create.mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV-2028-0001' });
      prisma.invoice.update.mockResolvedValue({});
      prisma.recurringInvoiceTemplate.update.mockResolvedValue({});

      await service.generateDue('company-1', 'user-1');

      const updateCall = prisma.recurringInvoiceTemplate.update.mock.calls[0][0];
      expect(updateCall.data.nextGenerationDate.toISOString().slice(0, 10)).toBe('2028-02-29');
    });

    it('rolls Dec 31 + 1 month over into January of the NEXT year', async () => {
      const yearEndTemplate = { ...dueTemplate, nextGenerationDate: new Date(2026, 11, 31) };
      prisma.recurringInvoiceTemplate.findMany.mockResolvedValue([yearEndTemplate]);
      invoicesService.create.mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV-2027-0001' });
      prisma.invoice.update.mockResolvedValue({});
      prisma.recurringInvoiceTemplate.update.mockResolvedValue({});

      await service.generateDue('company-1', 'user-1');

      const updateCall = prisma.recurringInvoiceTemplate.update.mock.calls[0][0];
      expect(updateCall.data.nextGenerationDate.toISOString().slice(0, 10)).toBe('2027-01-31');
    });

    it('marks the template completed once the advanced date passes its endDate', async () => {
      const endingTemplate = { ...dueTemplate, endDate: new Date(2026, 1, 15) };
      prisma.recurringInvoiceTemplate.findMany.mockResolvedValue([endingTemplate]);
      invoicesService.create.mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV-2026-0001' });
      prisma.invoice.update.mockResolvedValue({});
      prisma.recurringInvoiceTemplate.update.mockResolvedValue({});

      await service.generateDue('company-1', 'user-1');

      const updateCall = prisma.recurringInvoiceTemplate.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('completed');
    });

    it('links the generated invoice back to its template via recurringTemplateId', async () => {
      prisma.recurringInvoiceTemplate.findMany.mockResolvedValue([dueTemplate]);
      invoicesService.create.mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV-2026-0001' });
      prisma.invoice.update.mockResolvedValue({});
      prisma.recurringInvoiceTemplate.update.mockResolvedValue({});

      await service.generateDue('company-1', 'user-1');

      expect(prisma.invoice.update).toHaveBeenCalledWith({ where: { id: 'inv-1' }, data: { recurringTemplateId: 'template-1' } });
    });

    it('one failing template does NOT abort the run for other due templates', async () => {
      const templateA = { ...dueTemplate, id: 'template-A', name: 'Template A' };
      const templateB = { ...dueTemplate, id: 'template-B', name: 'Template B' };
      prisma.recurringInvoiceTemplate.findMany.mockResolvedValue([templateA, templateB]);
      invoicesService.create
        .mockRejectedValueOnce(new Error('Customer no longer exists'))
        .mockResolvedValueOnce({ id: 'inv-B', invoiceNumber: 'INV-2026-0002' });
      prisma.invoice.update.mockResolvedValue({});
      prisma.recurringInvoiceTemplate.update.mockResolvedValue({});

      const result = await service.generateDue('company-1', 'user-1');

      expect(result.generatedCount).toBe(1);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]).toContain('Template A');
    });

    it('finds zero templates when none are due — returns an empty, non-throwing result', async () => {
      prisma.recurringInvoiceTemplate.findMany.mockResolvedValue([]);
      const result = await service.generateDue('company-1', 'user-1');
      expect(result.generatedCount).toBe(0);
      expect(invoicesService.create).not.toHaveBeenCalled();
    });
  });
});
