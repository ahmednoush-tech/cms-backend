import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalEntryValidator } from '../../common/services/journal-entry-validator';
import { PeriodLockService } from './period-lock.service';
import { CreateBillPaymentDto } from './dto/create-bill-payment.dto';

const PAYABLE_BILL_STATUSES = ['received', 'partially_paid', 'overdue'];

@Injectable()
export class BillPaymentsService {
  constructor(
    private prisma: PrismaService,
    private periodLock: PeriodLockService,
  ) {}

  /** Immutable once recorded — same rule as Payment (F2), for the same reason. */
  async create(companyId: string, actorUserId: string, dto: CreateBillPaymentDto) {
    const bill = await this.prisma.bill.findFirst({ where: { id: dto.billId, companyId, deletedAt: null } });
    if (!bill) throw new NotFoundException('Bill not found.');

    if (!PAYABLE_BILL_STATUSES.includes(bill.status)) {
      throw new UnprocessableEntityException(
        `Cannot record a payment against a bill with status '${bill.status}'. The bill must be received first.`,
      );
    }

    const remaining = new Prisma.Decimal(bill.total).sub(bill.amountPaid);
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.gt(remaining)) {
      throw new UnprocessableEntityException(
        `Payment amount (${amount}) exceeds the remaining balance (${remaining}) on this bill.`,
      );
    }

    const settings = await this.prisma.financeSettings.findUnique({ where: { companyId } });
    if (!settings?.defaultCashAccountId || !settings?.defaultPayableAccountId) {
      throw new UnprocessableEntityException(
        'Finance Settings must have a default Cash account and a default Accounts Payable account configured before bill payments can be recorded.',
      );
    }
    await this.periodLock.assertDateNotLocked(companyId, new Date(dto.paymentDate));

    const lines = [
      { accountId: settings.defaultPayableAccountId, debit: amount, credit: 0 },
      { accountId: settings.defaultCashAccountId, debit: 0, credit: amount },
    ];
    JournalEntryValidator.assertBalanced(lines);

    const newAmountPaid = new Prisma.Decimal(bill.amountPaid).add(amount);
    const newStatus = newAmountPaid.gte(bill.total) ? 'paid' : 'partially_paid';

    return this.prisma.$transaction(async (tx) => {
      const entryNumber = await this.generateJournalEntryNumber(tx, companyId);
      const entry = await tx.journalEntry.create({
        data: {
          companyId,
          entryNumber,
          entryDate: new Date(dto.paymentDate),
          reference: bill.billNumber,
          description: `Payment made for bill ${bill.billNumber}`,
          status: 'posted',
          postedAt: new Date(),
          createdBy: actorUserId,
          lines: { create: lines.map((l, index) => ({ ...l, lineOrder: index })) },
        },
      });

      const payment = await tx.billPayment.create({
        data: {
          companyId,
          billId: dto.billId,
          amount: dto.amount,
          paymentDate: new Date(dto.paymentDate),
          method: dto.method,
          reference: dto.reference,
          createdBy: actorUserId,
          journalEntryId: entry.id,
        },
      });

      await tx.bill.update({ where: { id: dto.billId }, data: { amountPaid: newAmountPaid, status: newStatus } });

      return payment;
    });
  }

  async findAllForBill(companyId: string, billId: string) {
    const bill = await this.prisma.bill.findFirst({ where: { id: billId, companyId, deletedAt: null } });
    if (!bill) throw new NotFoundException('Bill not found.');
    return this.prisma.billPayment.findMany({ where: { billId, deletedAt: null }, orderBy: { paymentDate: 'asc' } });
  }

  private async generateJournalEntryNumber(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `JE-${year}-`;
    const count = await tx.journalEntry.count({ where: { companyId, entryNumber: { startsWith: prefix } } });
    let attempt = count + 1;
    for (let tries = 0; tries < 5; tries++) {
      const candidate = `${prefix}${String(attempt).padStart(4, '0')}`;
      const clash = await tx.journalEntry.findFirst({ where: { companyId, entryNumber: candidate }, select: { id: true } });
      if (!clash) return candidate;
      attempt++;
    }
    throw new UnprocessableEntityException('Could not generate a unique journal entry number, please retry.');
  }
}
