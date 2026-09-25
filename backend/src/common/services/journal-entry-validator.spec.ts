import { BadRequestException } from '@nestjs/common';
import { JournalEntryValidator } from './journal-entry-validator';

describe('JournalEntryValidator', () => {
  describe('assertBalanced', () => {
    it('accepts a simple balanced two-line entry and returns the total', () => {
      const total = JournalEntryValidator.assertBalanced([
        { debit: 1000, credit: 0 },
        { debit: 0, credit: 1000 },
      ]);
      expect(total.toString()).toBe('1000');
    });

    it('accepts a balanced multi-line entry (one debit, two credits)', () => {
      const total = JournalEntryValidator.assertBalanced([
        { debit: 1150, credit: 0 },
        { debit: 0, credit: 1000 },
        { debit: 0, credit: 150 },
      ]);
      expect(total.toString()).toBe('1150');
    });

    it('rejects an unbalanced entry (debits do not equal credits)', () => {
      expect(() =>
        JournalEntryValidator.assertBalanced([
          { debit: 1000, credit: 0 },
          { debit: 0, credit: 900 },
        ]),
      ).toThrow(BadRequestException);
    });

    it('avoids floating-point drift on fractional money values (0.1 + 0.2 case)', () => {
      expect(() =>
        JournalEntryValidator.assertBalanced([
          { debit: 0.1, credit: 0 },
          { debit: 0.2, credit: 0 },
          { debit: 0, credit: 0.3 },
        ]),
      ).not.toThrow();
    });

    it('rejects fewer than two lines', () => {
      expect(() => JournalEntryValidator.assertBalanced([{ debit: 100, credit: 0 }])).toThrow(
        BadRequestException,
      );
      expect(() => JournalEntryValidator.assertBalanced([])).toThrow(BadRequestException);
    });

    it('rejects a single line carrying both a debit and a credit amount', () => {
      expect(() =>
        JournalEntryValidator.assertBalanced([
          { debit: 100, credit: 50 },
          { debit: 0, credit: 50 },
        ]),
      ).toThrow(BadRequestException);
    });

    it('rejects a line with neither a debit nor a credit amount', () => {
      expect(() =>
        JournalEntryValidator.assertBalanced([
          { debit: 0, credit: 0 },
          { debit: 100, credit: 0 },
        ]),
      ).toThrow(BadRequestException);
    });

    it('rejects negative amounts', () => {
      expect(() =>
        JournalEntryValidator.assertBalanced([
          { debit: -100, credit: 0 },
          { debit: 0, credit: -100 },
        ]),
      ).toThrow(BadRequestException);
    });

    it('defaults a missing debit/credit field to 0 rather than throwing', () => {
      const total = JournalEntryValidator.assertBalanced([
        { debit: 500, credit: undefined as unknown as number },
        { debit: undefined as unknown as number, credit: 500 },
      ]);
      expect(total.toString()).toBe('500');
    });
  });
});
