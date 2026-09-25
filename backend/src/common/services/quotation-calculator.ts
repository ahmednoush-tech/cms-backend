import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const { Decimal } = Prisma;

/**
 * All monetary arithmetic here uses Prisma.Decimal, never native
 * JS numbers, to avoid floating-point rounding errors on money
 * (e.g. 0.1 + 0.2 !== 0.3). Every intermediate and final value is
 * rounded to 2 decimal places (ROUND_HALF_UP) before being
 * persisted or returned, matching the DECIMAL(14,2)/(12,2)
 * columns in the approved schema.
 *
 * This is the ONLY place quotation/line totals are computed.
 * Nothing from the client (subtotal, discount, tax, total — at
 * either the quotation or line-item level) is ever trusted or
 * persisted as-is; every one of those fields is recomputed here
 * from quantity/unit_price/discount/tax inputs.
 */
export interface LineInput {
  quantity: number | string;
  unitPrice: number | string;
  discount?: number | string;
  tax?: number | string;
}

export interface LineResult {
  subtotal: Prisma.Decimal; // quantity * unitPrice
  discount: Prisma.Decimal; // validated line discount amount
  taxableAmount: Prisma.Decimal; // subtotal - discount
  tax: Prisma.Decimal; // validated line tax amount
  total: Prisma.Decimal; // taxableAmount + tax
}

export interface QuotationTotals {
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  tax: Prisma.Decimal;
  total: Prisma.Decimal;
}

const TWO_DP = 2;

export class QuotationCalculator {
  /**
   * Computes one line item's subtotal / taxable amount / total
   * from quantity, unit price, and the line's discount/tax
   * *amounts* (the approved schema stores these as absolute
   * currency amounts on quotation_items, not rates — there is no
   * tax-rate column to derive them from).
   *
   * Validates: quantity > 0, unitPrice >= 0, discount >= 0 and
   * <= line subtotal (a line can't discount below zero), tax >= 0.
   */
  static calculateLine(input: LineInput): LineResult {
    const quantity = new Decimal(input.quantity);
    const unitPrice = new Decimal(input.unitPrice);
    const discount = new Decimal(input.discount ?? 0);
    const tax = new Decimal(input.tax ?? 0);

    if (quantity.lte(0)) {
      throw new BadRequestException('quantity must be greater than 0.');
    }
    if (unitPrice.lt(0)) {
      throw new BadRequestException('unitPrice must not be negative.');
    }
    if (discount.lt(0)) {
      throw new BadRequestException('discount must not be negative.');
    }
    if (tax.lt(0)) {
      throw new BadRequestException('tax must not be negative.');
    }

    const subtotal = quantity.mul(unitPrice).toDecimalPlaces(TWO_DP);

    if (discount.gt(subtotal)) {
      throw new BadRequestException('discount cannot exceed the line subtotal.');
    }

    const taxableAmount = subtotal.sub(discount).toDecimalPlaces(TWO_DP);
    const total = taxableAmount.add(tax).toDecimalPlaces(TWO_DP);

    return {
      subtotal,
      discount: discount.toDecimalPlaces(TWO_DP),
      taxableAmount,
      tax: tax.toDecimalPlaces(TWO_DP),
      total,
    };
  }

  /**
   * Aggregates already-persisted quotation_items rows into the
   * quotation-level subtotal/discount/tax/total. This is what
   * every mutating quotation/item endpoint calls to refresh the
   * parent quotation row — the quotation's stored totals are
   * always a pure function of its current items, recomputed on
   * every write, never accepted as client input.
   */
  static aggregate(
    items: Array<{ quantity: Prisma.Decimal | number | string; unitPrice: Prisma.Decimal | number | string; discount: Prisma.Decimal | number | string; tax: Prisma.Decimal | number | string }>,
  ): QuotationTotals {
    let subtotal = new Decimal(0);
    let discount = new Decimal(0);
    let tax = new Decimal(0);
    let total = new Decimal(0);

    for (const item of items) {
      const line = QuotationCalculator.calculateLine({
        quantity: item.quantity as any,
        unitPrice: item.unitPrice as any,
        discount: item.discount as any,
        tax: item.tax as any,
      });
      subtotal = subtotal.add(line.subtotal);
      discount = discount.add(line.discount);
      tax = tax.add(line.tax);
      total = total.add(line.total);
    }

    return {
      subtotal: subtotal.toDecimalPlaces(TWO_DP),
      discount: discount.toDecimalPlaces(TWO_DP),
      tax: tax.toDecimalPlaces(TWO_DP),
      total: total.toDecimalPlaces(TWO_DP),
    };
  }
}
