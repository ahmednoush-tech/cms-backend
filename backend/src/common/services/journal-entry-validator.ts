import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const { Decimal } = Prisma;

/**
 * The single enforcement point for the core rule of double-entry
 * bookkeeping: every journal entry's lines must sum to zero
 * (total debits === total credits). All arithmetic uses
 * Prisma.Decimal, never native JS numbers — same rule as
 * QuotationCalculator, for the same reason (no floating-point
 * rounding errors on money).
 *
 * Called from JournalEntriesService on both create() and
 * update() (whenever a full `lines` array is submitted) — unlike
 * Quotations, where items are added one at a time via separate
 * endpoints (making an interim "unbalanced draft" a reasonable
 * state), a journal entry's DTO always carries its complete line
 * set in one request, so there's no legitimate reason to persist
 * an unbalanced entry even in draft status.
 */
export interface JournalLineInput {
  debit: Prisma.Decimal | number | string;
  credit: Prisma.Decimal | number | string;
}

const TWO_DP = 2;

export class JournalEntryValidator {
  /**
   * Throws if any line has both a debit and a credit (a line must
   * be one or the other), any amount is negative, or the entry as
   * a whole doesn't balance. Returns the validated total (equal to
   * both the debit sum and the credit sum) for convenience.
   */
  static assertBalanced(lines: JournalLineInput[]): Prisma.Decimal {
    if (lines.length < 2) {
      throw new BadRequestException('A journal entry needs at least two lines (one debit, one credit).');
    }

    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const line of lines) {
      const debit = new Decimal(line.debit ?? 0);
      const credit = new Decimal(line.credit ?? 0);

      if (debit.lt(0) || credit.lt(0)) {
        throw new BadRequestException('debit and credit amounts must not be negative.');
      }
      if (debit.gt(0) && credit.gt(0)) {
        throw new BadRequestException('A single line cannot have both a debit and a credit amount.');
      }
      if (debit.eq(0) && credit.eq(0)) {
        throw new BadRequestException('Each line must have either a debit or a credit amount greater than zero.');
      }

      totalDebit = totalDebit.add(debit);
      totalCredit = totalCredit.add(credit);
    }

    totalDebit = totalDebit.toDecimalPlaces(TWO_DP);
    totalCredit = totalCredit.toDecimalPlaces(TWO_DP);

    if (!totalDebit.eq(totalCredit)) {
      throw new BadRequestException(
        `Journal entry is not balanced: total debits (${totalDebit}) must equal total credits (${totalCredit}).`,
      );
    }

    return totalDebit;
  }
}
