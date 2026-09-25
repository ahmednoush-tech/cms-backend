import { BadRequestException } from '@nestjs/common';
import { QuotationCalculator } from './quotation-calculator';

describe('QuotationCalculator', () => {
  describe('calculateLine', () => {
    it('computes subtotal, taxable amount, and total for a simple line', () => {
      const line = QuotationCalculator.calculateLine({
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
      const line = QuotationCalculator.calculateLine({ quantity: 2, unitPrice: 50 });
      expect(line.subtotal.toString()).toBe('100');
      expect(line.discount.toString()).toBe('0');
      expect(line.tax.toString()).toBe('0');
      expect(line.total.toString()).toBe('100');
    });

    it('avoids floating-point drift on fractional money values (0.1 + 0.2 case)', () => {
      const line = QuotationCalculator.calculateLine({ quantity: 3, unitPrice: 0.1 });
      // Native JS: 3 * 0.1 === 0.30000000000000004. Decimal must not.
      expect(line.subtotal.toString()).toBe('0.3');
    });

    it('rejects quantity <= 0', () => {
      expect(() => QuotationCalculator.calculateLine({ quantity: 0, unitPrice: 10 })).toThrow(
        BadRequestException,
      );
      expect(() => QuotationCalculator.calculateLine({ quantity: -1, unitPrice: 10 })).toThrow(
        BadRequestException,
      );
    });

    it('rejects a negative unitPrice', () => {
      expect(() => QuotationCalculator.calculateLine({ quantity: 1, unitPrice: -5 })).toThrow(
        BadRequestException,
      );
    });

    it('rejects a negative discount', () => {
      expect(() =>
        QuotationCalculator.calculateLine({ quantity: 1, unitPrice: 10, discount: -1 }),
      ).toThrow(BadRequestException);
    });

    it('rejects a negative tax', () => {
      expect(() =>
        QuotationCalculator.calculateLine({ quantity: 1, unitPrice: 10, tax: -1 }),
      ).toThrow(BadRequestException);
    });

    it('rejects a discount larger than the line subtotal', () => {
      expect(() =>
        QuotationCalculator.calculateLine({ quantity: 1, unitPrice: 100, discount: 150 }),
      ).toThrow(BadRequestException);
    });

    it('allows a discount exactly equal to the subtotal (taxable amount becomes 0)', () => {
      const line = QuotationCalculator.calculateLine({ quantity: 1, unitPrice: 100, discount: 100 });
      expect(line.taxableAmount.toString()).toBe('0');
    });
  });

  describe('aggregate', () => {
    it('sums multiple lines into quotation-level totals', () => {
      const totals = QuotationCalculator.aggregate([
        { quantity: 100, unitPrice: 150, discount: 500, tax: 2085 },
        { quantity: 4, unitPrice: 3500, discount: 0, tax: 1470 },
        { quantity: 20, unitPrice: 1200, discount: 1500, tax: 3145 },
      ]);

      // line1 subtotal=15000 disc=500 tax=2085 total=16585
      // line2 subtotal=14000 disc=0   tax=1470 total=15470
      // line3 subtotal=24000 disc=1500 tax=3145 total=25645
      expect(totals.subtotal.toString()).toBe('53000');
      expect(totals.discount.toString()).toBe('2000');
      expect(totals.tax.toString()).toBe('6700');
      expect(totals.total.toString()).toBe('57700');
    });

    it('returns all zeros for an empty item list', () => {
      const totals = QuotationCalculator.aggregate([]);
      expect(totals.subtotal.toString()).toBe('0');
      expect(totals.discount.toString()).toBe('0');
      expect(totals.tax.toString()).toBe('0');
      expect(totals.total.toString()).toBe('0');
    });

    it('propagates a validation error from a single bad line', () => {
      expect(() =>
        QuotationCalculator.aggregate([{ quantity: -1, unitPrice: 10, discount: 0, tax: 0 }]),
      ).toThrow(BadRequestException);
    });
  });
});
