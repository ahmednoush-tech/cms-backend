import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalEntryValidator } from '../../common/services/journal-entry-validator';
import { PeriodLockService } from './period-lock.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

const PAYABLE_INVOICE_STATUSES = ['sent', 'partially_paid', 'overdue'];

export interface ApplyPaymentParams {
  invoiceId: string;
  amount: number;
  paymentDate: string;
  method: string;
  reference?: string;
  customerPaymentId?: string;
  /**
   * The exchange rate to base currency (SAR) AT THE MOMENT this
   * payment was received — independent of, and frozen separately
   * from, the invoice's own exchangeRateToBase (captured at
   * issuance). The difference between the two, applied to this
   * same payment amount, is exactly the realized FX gain or loss
   * for this payment — see applyToInvoice(). Ignored (has no
   * effect) when the invoice's own currency is SAR, since a rate
   * relative to itself is meaningless; defaults to 1.
   */
  exchangeRateToBase?: number;
}

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private periodLock: PeriodLockService,
  ) {}

  /**
   * Payments are immutable once recorded — same rule as posted
   * journal entries, for the same reason (a payment is a
   * historical fact; correcting one means recording a new,
   * separate transaction, not editing or deleting history). There
   * is deliberately no update/delete method on this service.
   */
  async create(companyId: string, actorUserId: string, dto: CreatePaymentDto) {
    return this.prisma.$transaction((tx) => this.applyToInvoice(tx, companyId, actorUserId, dto));
  }

  /**
   * The actual per-invoice payment logic — extracted so
   * CustomerPaymentsService can call it multiple times (once per
   * allocation) inside ONE larger transaction covering the whole
   * customer payment, while create() above wraps a single call in
   * its own transaction for the ordinary single-invoice case. Every
   * check (status gating, credit/debit note adjustment, overpayment
   * rejection, period lock, balanced journal entry) is identical
   * either way — there is exactly one code path for "can this
   * amount be applied to this invoice", not two.
   */
  async applyToInvoice(tx: Prisma.TransactionClient, companyId: string, actorUserId: string, params: ApplyPaymentParams) {
    const invoice = await tx.invoice.findFirst({
      where: { id: params.invoiceId, companyId, deletedAt: null },
      include: { noteEntries: { where: { status: 'issued' } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found.');

    if (!PAYABLE_INVOICE_STATUSES.includes(invoice.status)) {
      throw new UnprocessableEntityException(
        `Cannot record a payment against an invoice with status '${invoice.status}'. The invoice must be issued (sent) first.`,
      );
    }

    // A credit note issued against this invoice reduces what the
    // customer can still be asked to pay; a debit note increases
    // it. Both must be reflected here — otherwise a customer could
    // still be charged (or a payment wrongly rejected as "too
    // much") based on a total that credit/debit notes have already
    // superseded.
    const netAdjustment = invoice.noteEntries.reduce(
      (sum: Prisma.Decimal, n) => (n.noteType === 'credit' ? sum.sub(n.total) : sum.add(n.total)),
      new Prisma.Decimal(0),
    );
    const effectiveTotal = new Prisma.Decimal(invoice.total).add(netAdjustment);

    const remaining = effectiveTotal.sub(invoice.amountPaid);
    const amount = new Prisma.Decimal(params.amount);
    if (amount.gt(remaining)) {
      throw new UnprocessableEntityException(
        `Payment amount (${amount}) exceeds the remaining balance (${remaining}) on this invoice.`,
      );
    }

    const settings = await tx.financeSettings.findUnique({ where: { companyId } });
    if (!settings?.defaultCashAccountId || !settings?.defaultReceivableAccountId) {
      throw new UnprocessableEntityException(
        'Finance Settings must have a default Cash account and a default Accounts Receivable account configured before payments can be recorded.',
      );
    }
    await this.periodLock.assertDateNotLocked(companyId, new Date(params.paymentDate));

    // ---- Multi-currency: realized FX gain/loss ----
    // Cash is debited at TODAY's rate (when the money actually
    // arrived); Accounts Receivable is credited at the invoice's
    // OWN frozen rate (the rate the receivable was originally
    // booked at, back when the invoice was issued) — the two
    // amounts, both converted from the exact same invoice-currency
    // `amount`, will only match when the rate hasn't moved. Any
    // difference is the realized FX gain (more base-currency cash
    // arrived than the receivable was worth) or loss (less), posted
    // as a third journal line so the entry still balances exactly —
    // never silently absorbed into either the Cash or AR line.
    const paymentRate = new Prisma.Decimal(params.exchangeRateToBase ?? 1);
    const invoiceRate = new Prisma.Decimal(invoice.exchangeRateToBase);
    const cashBase = amount.mul(paymentRate).toDecimalPlaces(2);
    const arBase = amount.mul(invoiceRate).toDecimalPlaces(2);
    const fxDifference = cashBase.sub(arBase);

    const lines = [
      { accountId: settings.defaultCashAccountId, debit: cashBase, credit: 0 },
      { accountId: settings.defaultReceivableAccountId, debit: 0, credit: arBase },
    ];

    if (!fxDifference.eq(0)) {
      if (!settings.defaultFxGainLossAccountId) {
        throw new UnprocessableEntityException(
          `This payment's exchange rate differs from the invoice's rate, producing a realized FX ${fxDifference.gt(0) ? 'gain' : 'loss'} of ${fxDifference.abs().toString()} — Finance Settings must have a default FX Gain/Loss account configured before this payment can be recorded.`,
        );
      }
      if (fxDifference.gt(0)) {
        lines.push({ accountId: settings.defaultFxGainLossAccountId, debit: 0, credit: fxDifference });
      } else {
        lines.push({ accountId: settings.defaultFxGainLossAccountId, debit: fxDifference.abs(), credit: 0 });
      }
    }
    JournalEntryValidator.assertBalanced(lines);

    const newAmountPaid = new Prisma.Decimal(invoice.amountPaid).add(amount);
    const newStatus = newAmountPaid.gte(effectiveTotal) ? 'paid' : 'partially_paid';

    const entryNumber = await this.generateJournalEntryNumber(tx, companyId);
    const entry = await tx.journalEntry.create({
      data: {
        companyId,
        entryNumber,
        entryDate: new Date(params.paymentDate),
        reference: invoice.invoiceNumber,
        description: `Payment received for invoice ${invoice.invoiceNumber}`,
        status: 'posted',
        postedAt: new Date(),
        createdBy: actorUserId,
        lines: { create: lines.map((l, index) => ({ ...l, lineOrder: index })) },
      },
    });

    const payment = await tx.payment.create({
      data: {
        companyId,
        invoiceId: params.invoiceId,
        amount: params.amount,
        exchangeRateToBase: paymentRate,
        paymentDate: new Date(params.paymentDate),
        method: params.method,
        reference: params.reference,
        createdBy: actorUserId,
        journalEntryId: entry.id,
        customerPaymentId: params.customerPaymentId,
      },
    });

    await tx.invoice.update({
      where: { id: params.invoiceId },
      data: { amountPaid: newAmountPaid, status: newStatus },
    });

    return payment;
  }

  async findAllForInvoice(companyId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, companyId, deletedAt: null } });
    if (!invoice) throw new NotFoundException('Invoice not found.');
    return this.prisma.payment.findMany({ where: { invoiceId, deletedAt: null }, orderBy: { paymentDate: 'asc' } });
  }

  async generateJournalEntryNumber(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
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
