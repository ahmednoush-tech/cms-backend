import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceCalculator } from '../../common/services/invoice-calculator';
import { JournalEntryValidator } from '../../common/services/journal-entry-validator';
import { PeriodLockService } from './period-lock.service';
import { CreateInvoiceNoteDto } from './dto/create-invoice-note.dto';

@Injectable()
export class InvoiceNotesService {
  constructor(
    private prisma: PrismaService,
    private periodLock: PeriodLockService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreateInvoiceNoteDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: dto.invoiceId, companyId },
      include: { noteEntries: { where: { status: 'issued' } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found.');
    if (invoice.status === 'draft' || invoice.status === 'cancelled') {
      throw new UnprocessableEntityException(
        `Can only issue a note against an issued invoice (this one is '${invoice.status}').`,
      );
    }

    const totals = InvoiceCalculator.aggregate(
      dto.items.map((i) => ({ ...i, discount: i.discount ?? 0, tax: i.tax ?? 0 })),
    );

    if (dto.noteType === 'credit') {
      const alreadyCredited = invoice.noteEntries
        .filter((n) => n.noteType === 'credit')
        .reduce((sum, n) => sum.add(n.total), new Prisma.Decimal(0));
      const alreadyDebited = invoice.noteEntries
        .filter((n) => n.noteType === 'debit')
        .reduce((sum, n) => sum.add(n.total), new Prisma.Decimal(0));
      const remainingCreditable = new Prisma.Decimal(invoice.total).add(alreadyDebited).sub(alreadyCredited);

      if (totals.total.gt(remainingCreditable)) {
        throw new UnprocessableEntityException(
          `This credit note (${totals.total}) exceeds the remaining creditable value on this invoice (${remainingCreditable}).`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const noteNumber = await this.generateNoteNumber(tx, companyId, dto.noteType);
      return tx.invoiceNote.create({
        data: {
          companyId,
          invoiceId: dto.invoiceId,
          noteType: dto.noteType,
          noteNumber,
          noteDate: new Date(dto.noteDate),
          reason: dto.reason,
          createdBy: actorUserId,
          status: 'draft',
          subtotal: totals.subtotal,
          discount: totals.discount,
          tax: totals.tax,
          total: totals.total,
          items: {
            create: dto.items.map((i) => ({
              ...InvoiceCalculator.calculateLine(i),
              description: i.description,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
            })),
          },
        },
        include: { items: true },
      });
    });
  }

  async findAllForInvoice(companyId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id: invoiceId, companyId } });
    if (!invoice) throw new NotFoundException('Invoice not found.');
    return this.prisma.invoiceNote.findMany({ where: { invoiceId }, orderBy: { noteDate: 'asc' } });
  }

  async findOne(companyId: string, id: string) {
    const note = await this.prisma.invoiceNote.findFirst({
      where: { id, companyId },
      include: { items: true, invoice: true },
    });
    if (!note) throw new NotFoundException('Invoice note not found.');
    return note;
  }

  /**
   * Credit note: debits Revenue (and Tax Payable if any) — the
   * mirror image of Invoice.issue() — and credits Accounts
   * Receivable, reducing what the customer owes.
   *
   * Debit note: posts in the SAME direction as Invoice.issue()
   * (debit AR, credit Revenue + Tax Payable) — economically it IS
   * a small additional invoice, just tied to the original for
   * reference.
   */
  async issue(companyId: string, actorUserId: string, id: string) {
    const note = await this.findOne(companyId, id);
    if (note.status !== 'draft') {
      throw new UnprocessableEntityException(`This action is only available while the note is in 'draft' status (currently '${note.status}').`);
    }
    if (note.items.length === 0) {
      throw new UnprocessableEntityException('Cannot issue a note with no line items.');
    }
    await this.periodLock.assertDateNotLocked(companyId, note.noteDate);

    const settings = await this.prisma.financeSettings.findUnique({ where: { companyId } });
    if (!settings?.defaultReceivableAccountId || !settings?.defaultRevenueAccountId) {
      throw new UnprocessableEntityException(
        'Finance Settings must have a default Accounts Receivable account and a default Revenue account configured before notes can be issued.',
      );
    }
    const taxAmount = new Prisma.Decimal(note.tax);
    if (taxAmount.gt(0) && !settings.defaultTaxPayableAccountId) {
      throw new UnprocessableEntityException(
        'This note has a tax amount, but Finance Settings has no default Tax Payable account configured.',
      );
    }

    const taxableAmount = new Prisma.Decimal(note.subtotal).sub(note.discount);
    const lines =
      note.noteType === 'credit'
        ? [
            { accountId: settings.defaultRevenueAccountId, debit: taxableAmount, credit: 0 },
            ...(taxAmount.gt(0) ? [{ accountId: settings.defaultTaxPayableAccountId!, debit: taxAmount, credit: 0 }] : []),
            { accountId: settings.defaultReceivableAccountId, debit: 0, credit: note.total },
          ]
        : [
            { accountId: settings.defaultReceivableAccountId, debit: note.total, credit: 0 },
            { accountId: settings.defaultRevenueAccountId, debit: 0, credit: taxableAmount },
            ...(taxAmount.gt(0) ? [{ accountId: settings.defaultTaxPayableAccountId!, debit: 0, credit: taxAmount }] : []),
          ];
    JournalEntryValidator.assertBalanced(lines);

    return this.prisma.$transaction(async (tx) => {
      const entryNumber = await this.generateJournalEntryNumber(tx, companyId);
      const entry = await tx.journalEntry.create({
        data: {
          companyId,
          entryNumber,
          entryDate: note.noteDate,
          reference: note.noteNumber,
          description: `${note.noteType === 'credit' ? 'Credit' : 'Debit'} note ${note.noteNumber} for invoice ${note.invoice.invoiceNumber}`,
          status: 'posted',
          postedAt: new Date(),
          createdBy: actorUserId,
          lines: { create: lines.map((l, index) => ({ ...l, lineOrder: index })) },
        },
      });

      return tx.invoiceNote.update({
        where: { id },
        data: { status: 'issued', journalEntryId: entry.id },
      });
    });
  }

  async cancel(companyId: string, id: string) {
    const note = await this.findOne(companyId, id);
    if (note.status !== 'draft') {
      throw new UnprocessableEntityException(`This action is only available while the note is in 'draft' status (currently '${note.status}').`);
    }
    return this.prisma.invoiceNote.update({ where: { id }, data: { status: 'cancelled' } });
  }

  private async generateNoteNumber(tx: Prisma.TransactionClient, companyId: string, noteType: 'credit' | 'debit'): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `${noteType === 'credit' ? 'CN' : 'DN'}-${year}-`;
    const count = await tx.invoiceNote.count({ where: { companyId, noteNumber: { startsWith: prefix } } });
    let attempt = count + 1;
    for (let tries = 0; tries < 5; tries++) {
      const candidate = `${prefix}${String(attempt).padStart(4, '0')}`;
      const clash = await tx.invoiceNote.findFirst({ where: { companyId, noteNumber: candidate }, select: { id: true } });
      if (!clash) return candidate;
      attempt++;
    }
    throw new UnprocessableEntityException('Could not generate a unique note number, please retry.');
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
