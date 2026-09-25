import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from './payments.service';
import { CreateCustomerPaymentDto } from './dto/create-customer-payment.dto';

@Injectable()
export class CustomerPaymentsService {
  constructor(
    private prisma: PrismaService,
    private paymentsService: PaymentsService,
  ) {}

  /**
   * Validates the customer, invoices, and allocation total up
   * front, then runs every allocation through the EXACT SAME
   * per-invoice logic a single-invoice payment would (status
   * gating, credit/debit note adjustment, overpayment rejection,
   * period lock, balanced journal entry) — all inside one
   * transaction, so either every allocation succeeds together or
   * none of them are recorded at all.
   */
  async create(companyId: string, actorUserId: string, dto: CreateCustomerPaymentDto) {
    const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, companyId, deletedAt: null } });
    if (!customer) throw new NotFoundException('Customer not found.');

    const allocatedTotal = dto.allocations.reduce((sum, a) => sum.add(a.amount), new Prisma.Decimal(0));
    const receivedAmount = new Prisma.Decimal(dto.amount);
    if (allocatedTotal.gt(receivedAmount)) {
      throw new UnprocessableEntityException(
        `Total allocated to invoices (${allocatedTotal}) exceeds the amount received (${receivedAmount}).`,
      );
    }

    // Every allocated invoice must belong to this same customer —
    // a customer payment allocated to someone else's invoice would
    // be a real data-integrity problem, not just an unusual choice.
    const invoiceIds = dto.allocations.map((a) => a.invoiceId);
    const invoices = await this.prisma.invoice.findMany({
      where: { id: { in: invoiceIds }, companyId, customerId: dto.customerId, deletedAt: null },
      select: { id: true },
    });
    if (invoices.length !== new Set(invoiceIds).size) {
      throw new UnprocessableEntityException(
        'One or more allocated invoices were not found, or do not belong to this customer.',
      );
    }

    const unappliedAmount = receivedAmount.sub(allocatedTotal);

    return this.prisma.$transaction(async (tx) => {
      const customerPayment = await tx.customerPayment.create({
        data: {
          companyId,
          customerId: dto.customerId,
          amount: dto.amount,
          unappliedAmount,
          paymentDate: new Date(dto.paymentDate),
          method: dto.method,
          reference: dto.reference,
          createdBy: actorUserId,
        },
      });

      const payments = [];
      for (const allocation of dto.allocations) {
        const payment = await this.paymentsService.applyToInvoice(tx, companyId, actorUserId, {
          invoiceId: allocation.invoiceId,
          amount: allocation.amount,
          paymentDate: dto.paymentDate,
          method: dto.method,
          reference: dto.reference,
          customerPaymentId: customerPayment.id,
          exchangeRateToBase: allocation.exchangeRateToBase,
        });
        payments.push(payment);
      }

      return { ...customerPayment, payments };
    });
  }

  async findAll(companyId: string, customerId?: string) {
    return this.prisma.customerPayment.findMany({
      where: { companyId, ...(customerId ? { customerId } : {}) },
      include: { payments: { include: { invoice: { select: { invoiceNumber: true } } } } },
      orderBy: { paymentDate: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const customerPayment = await this.prisma.customerPayment.findFirst({
      where: { id, companyId },
      include: { payments: { include: { invoice: { select: { invoiceNumber: true } } } }, customer: true },
    });
    if (!customerPayment) throw new NotFoundException('Customer payment not found.');
    return customerPayment;
  }
}
