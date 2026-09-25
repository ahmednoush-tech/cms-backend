import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { CustomerPaymentsService } from './customer-payments.service';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CustomerPaymentsService', () => {
  let service: CustomerPaymentsService;
  let prisma: any;
  let paymentsService: { applyToInvoice: jest.Mock };

  function mockTransaction(prismaMock: any) {
    return jest.fn((arg) => {
      if (typeof arg === 'function') return arg(prismaMock);
      return Promise.all(arg);
    });
  }

  beforeEach(async () => {
    prisma = {
      customer: { findFirst: jest.fn() },
      invoice: { findMany: jest.fn() },
      customerPayment: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
    };
    prisma.$transaction = mockTransaction(prisma);

    paymentsService = { applyToInvoice: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CustomerPaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PaymentsService, useValue: paymentsService },
      ],
    }).compile();

    service = moduleRef.get(CustomerPaymentsService);
  });

  const baseDto = {
    customerId: 'cust-1',
    amount: 1000,
    paymentDate: '2026-06-01',
    method: 'bank_transfer' as const,
    allocations: [
      { invoiceId: 'inv-1', amount: 600 },
      { invoiceId: 'inv-2', amount: 400 },
    ],
  };

  it('404s when the customer does not exist in the caller company', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);

    await expect(service.create('company-1', 'user-1', baseDto)).rejects.toThrow(NotFoundException);
  });

  it('rejects when the total allocated exceeds the amount actually received', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });

    await expect(
      service.create('company-1', 'user-1', { ...baseDto, amount: 500 }),
    ).rejects.toThrow(UnprocessableEntityException);

    expect(paymentsService.applyToInvoice).not.toHaveBeenCalled();
  });

  it('rejects when an allocated invoice does not belong to the specified customer', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
    prisma.invoice.findMany.mockResolvedValue([{ id: 'inv-1' }]);

    await expect(service.create('company-1', 'user-1', baseDto)).rejects.toThrow(UnprocessableEntityException);
    expect(paymentsService.applyToInvoice).not.toHaveBeenCalled();
  });

  it('applies each allocation via PaymentsService.applyToInvoice(), tagged with the new customerPaymentId', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
    prisma.invoice.findMany.mockResolvedValue([{ id: 'inv-1' }, { id: 'inv-2' }]);
    prisma.customerPayment.create.mockResolvedValue({ id: 'cp-1', unappliedAmount: '0' });
    paymentsService.applyToInvoice.mockResolvedValue({ id: 'payment-x' });

    await service.create('company-1', 'user-1', baseDto);

    expect(paymentsService.applyToInvoice).toHaveBeenCalledTimes(2);
    expect(paymentsService.applyToInvoice).toHaveBeenCalledWith(
      prisma,
      'company-1',
      'user-1',
      expect.objectContaining({ invoiceId: 'inv-1', amount: 600, customerPaymentId: 'cp-1' }),
    );
    expect(paymentsService.applyToInvoice).toHaveBeenCalledWith(
      prisma,
      'company-1',
      'user-1',
      expect.objectContaining({ invoiceId: 'inv-2', amount: 400, customerPaymentId: 'cp-1' }),
    );
  });

  it('tracks the leftover as unappliedAmount when allocations sum to less than the amount received', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
    prisma.invoice.findMany.mockResolvedValue([{ id: 'inv-1' }]);
    prisma.customerPayment.create.mockResolvedValue({ id: 'cp-1' });
    paymentsService.applyToInvoice.mockResolvedValue({ id: 'payment-x' });

    await service.create('company-1', 'user-1', {
      ...baseDto,
      amount: 1000,
      allocations: [{ invoiceId: 'inv-1', amount: 700 }],
    });

    const createCall = prisma.customerPayment.create.mock.calls[0][0];
    expect(createCall.data.unappliedAmount.toString()).toBe('300');
  });

  it('allows allocations to sum to exactly the amount received (zero unapplied)', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
    prisma.invoice.findMany.mockResolvedValue([{ id: 'inv-1' }, { id: 'inv-2' }]);
    prisma.customerPayment.create.mockResolvedValue({ id: 'cp-1' });
    paymentsService.applyToInvoice.mockResolvedValue({ id: 'payment-x' });

    await service.create('company-1', 'user-1', baseDto);

    const createCall = prisma.customerPayment.create.mock.calls[0][0];
    expect(createCall.data.unappliedAmount.toString()).toBe('0');
  });

  describe('findOne', () => {
    it('404s when the customer payment does not exist in the caller company', async () => {
      prisma.customerPayment.findFirst.mockResolvedValue(null);
      await expect(service.findOne('company-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });
});
