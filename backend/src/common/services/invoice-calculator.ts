import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const { Decimal } = Prisma;

/**
 * Deliberately a separate class from QuotationCalculator, not a
 * shared/refactored one, even though the logic is identical —
 * Quotations is an already fully-tested, verified V1 module (279
 * passing backend tests), and touching it to extract a shared
 * calculator risked regressing something working for the sake of
 * avoiding a small amount of duplication. Same rule throughout:
 * all monetary arithmetic uses Prisma.Decimal, never native JS
 * numbers, matching invoice_items' DECIMAL(14,2)/(12,2) columns.
 */
export interface InvoiceLineInput {
  quantity: number | string;
  unitPrice: number | string;
  discount?: number | string;
  tax?: number | string;
}

export interface InvoiceLineResult {
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  taxableAmount: Prisma.Decimal;
  tax: Prisma.Decimal;
  total: Prisma.Decimal;
}

export interface InvoiceTotals {
  subtotal: Prisma.Decimal;
  discount: Prisma.Decimal;
  tax: Prisma.Decimal;
  total: Prisma.Decimal;
}

const TWO_DP = 2;

export class InvoiceCalculator {
  static calculateLine(input: InvoiceLineInput): InvoiceLineResult {
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

  static aggregate(
    items: Array<{ quantity: Prisma.Decimal | number | string; unitPrice: Prisma.Decimal | number | string; discount: Prisma.Decimal | number | string; tax: Prisma.Decimal | number | string }>,
  ): InvoiceTotals {
    let subtotal = new Decimal(0);
    let discount = new Decimal(0);
    let tax = new Decimal(0);
    let total = new Decimal(0);

    for (const item of items) {
      const line = InvoiceCalculator.calculateLine({
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
