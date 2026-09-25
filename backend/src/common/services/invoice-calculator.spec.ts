import { BadRequestException } from '@nestjs/common';
import { InvoiceCalculator } from './invoice-calculator';

describe('InvoiceCalculator', () => {
  describe('calculateLine', () => {
    it('computes subtotal, taxable amount, and total for a simple line', () => {
      const line = InvoiceCalculator.calculateLine({
        quantity: 10,
        unitPrice: 150,
        discount: 100,
        tax: 225,
      });

      expect(line.subtotal.toString()).toBe('1500');
      expect(line.discount.toString()).toBe('100');
      expect(line.taxableAmount.toString()).toBe('1400');
      expect(line.tax.toString()).toBe('225');
      expect(line.total.toString()).toBe('1625');
    });

    it('defaults discount and tax to 0 when omitted', () => {
      const line = InvoiceCalculator.calculateLine({ quantity: 2, unitPrice: 50 });
      expect(line.subtotal.toString()).toBe('100');
      expect(line.discount.toString()).toBe('0');
      expect(line.tax.toString()).toBe('0');
      expect(line.total.toString()).toBe('100');
    });

    it('avoids floating-point drift on fractional money values (0.1 + 0.2 case)', () => {
      const line = InvoiceCalculator.calculateLine({ quantity: 3, unitPrice: 0.1 });
      expect(line.subtotal.toString()).toBe('0.3');
    });

    it('rejects quantity <= 0', () => {
      expect(() => InvoiceCalculator.calculateLine({ quantity: 0, unitPrice: 10 })).toThrow(
        BadRequestException,
      );
      expect(() => InvoiceCalculator.calculateLine({ quantity: -1, unitPrice: 10 })).toThrow(
        BadRequestException,
      );
    });

    it('rejects a negative unitPrice', () => {
      expect(() => InvoiceCalculator.calculateLine({ quantity: 1, unitPrice: -10 })).toThrow(
        BadRequestException,
      );
    });

    it('rejects a negative discount or tax', () => {
      expect(() => InvoiceCalculator.calculateLine({ quantity: 1, unitPrice: 10, discount: -1 })).toThrow(
        BadRequestException,
      );
      expect(() => InvoiceCalculator.calculateLine({ quantity: 1, unitPrice: 10, tax: -1 })).toThrow(
        BadRequestException,
      );
    });

    it('rejects a discount larger than the line subtotal', () => {
      expect(() =>
        InvoiceCalculator.calculateLine({ quantity: 1, unitPrice: 100, discount: 150 }),
      ).toThrow(BadRequestException);
    });
  });

  describe('aggregate', () => {
    it('sums subtotal/discount/tax/total correctly across multiple lines', () => {
      const totals = InvoiceCalculator.aggregate([
        { quantity: 2, unitPrice: 100, discount: 0, tax: 20 },
        { quantity: 1, unitPrice: 50, discount: 10, tax: 4 },
      ]);
      expect(totals.subtotal.toString()).toBe('250');
      expect(totals.discount.toString()).toBe('10');
      expect(totals.tax.toString()).toBe('24');
      expect(totals.total.toString()).toBe('264');
    });

    it('returns all-zero totals for an empty item list', () => {
      const totals = InvoiceCalculator.aggregate([]);
      expect(totals.subtotal.toString()).toBe('0');
      expect(totals.discount.toString()).toBe('0');
      expect(totals.tax.toString()).toBe('0');
      expect(totals.total.toString()).toBe('0');
    });

    it('propagates a per-line validation error (e.g. quantity <= 0) when aggregating', () => {
      expect(() =>
        InvoiceCalculator.aggregate([{ quantity: 0, unitPrice: 10, discount: 0, tax: 0 }]),
      ).toThrow(BadRequestException);
    });
  });
});
