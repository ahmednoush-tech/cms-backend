import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceCalculator } from '../../common/services/invoice-calculator';
import { JournalEntryValidator } from '../../common/services/journal-entry-validator';
import { ZatcaQrEncoder } from '../../common/services/zatca-qr-encoder';
import { PeriodLockService } from './period-lock.service';
import { InventoryMovementsService } from '../inventory/inventory-movements.service';
import { ZatcaInvoiceSubmissionService } from '../zatca-phase2/zatca-invoice-submission.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoiceItemDto } from './dto/invoice-item.dto';
import { PaginationQueryDto, buildMeta } from '../../common/dto/pagination-query.dto';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private periodLock: PeriodLockService,
    private inventoryMovementsService: InventoryMovementsService,
    private zatcaSubmissionService: ZatcaInvoiceSubmissionService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreateInvoiceDto) {
    let customerId: string;
    let items: InvoiceItemDto[];
    let currencyCode: string;
    let exchangeRateToBase: number;

    if (dto.quotationId) {
      const quotation = await this.prisma.quotation.findFirst({
        where: { id: dto.quotationId, companyId, deletedAt: null },
        include: { items: true },
      });
      if (!quotation) throw new NotFoundException('Quotation not found.');
      if (quotation.status !== 'accepted') {
        throw new UnprocessableEntityException(
          `Can only invoice an accepted quotation (this one is '${quotation.status}').`,
        );
      }
      const existingInvoice = await this.prisma.invoice.findUnique({ where: { quotationId: dto.quotationId } });
      if (existingInvoice) {
        throw new UnprocessableEntityException('This quotation has already been invoiced.');
      }
      customerId = quotation.customerId;
      items = quotation.items.map((i) => ({
        description: i.description,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        discount: Number(i.discount),
        tax: Number(i.tax),
        stockItemId: i.stockItemId ?? undefined,
      }));
      // Carried over, never re-specified — see CreateInvoiceDto's comment.
      currencyCode = quotation.currencyCode;
      exchangeRateToBase = Number(quotation.exchangeRateToBase);
    } else {
      if (!dto.customerId || !dto.items || dto.items.length === 0) {
        throw new BadRequestException('Provide either quotationId, or both customerId and at least one item.');
      }
      const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, companyId, deletedAt: null } });
      if (!customer) throw new BadRequestException('customerId must reference an active customer in your company.');
      customerId = dto.customerId;
      items = dto.items;
      const resolved = await this.resolveCurrency(dto.currencyCode, dto.exchangeRateToBase);
      currencyCode = resolved.currencyCode;
      exchangeRateToBase = resolved.exchangeRateToBase;
    }

    const totals = InvoiceCalculator.aggregate(
      items.map((i) => ({ ...i, discount: i.discount ?? 0, tax: i.tax ?? 0 })),
    );

    return this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.generateInvoiceNumber(tx, companyId);
      return tx.invoice.create({
        data: {
          companyId,
          customerId,
          quotationId: dto.quotationId,
          invoiceNumber,
          issueDate: new Date(dto.issueDate),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          notes: dto.notes,
          warehouseId: dto.warehouseId,
          currencyCode,
          exchangeRateToBase,
          createdBy: actorUserId,
          status: 'draft',
          subtotal: totals.subtotal,
          discount: totals.discount,
          tax: totals.tax,
          total: totals.total,
          items: { create: items.map((i) => ({ ...InvoiceCalculator.calculateLine(i), description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, inventoryItemId: i.inventoryItemId, stockItemId: i.stockItemId })) },
        },
        include: { items: true },
      });
    });
  }

  async findAll(companyId: string, query: PaginationQueryDto & { status?: string; customerId?: string }) {
    const { page, pageSize, search, sortBy, sortDir, status, customerId } = query;
    const where = {
      companyId,
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(customerId ? { customerId } : {}),
      ...(search ? { invoiceNumber: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy ?? 'issueDate']: sortDir ?? 'desc' },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return { items, meta: buildMeta(page, pageSize, total) };
  }

  async findOne(companyId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { items: { include: { inventoryItem: true } }, customer: true, payments: { orderBy: { paymentDate: 'asc' } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found.');
    return invoice;
  }

  async update(companyId: string, id: string, dto: UpdateInvoiceDto) {
    const invoice = await this.findOne(companyId, id);
    this.assertDraft(invoice);
    return this.prisma.invoice.update({
      where: { id },
      data: { dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined, notes: dto.notes, warehouseId: dto.warehouseId },
    });
  }

  /**
   * The heart of Finance F2: converts a draft invoice into a
   * real, posted accounting fact. Debits Accounts Receivable for
   * the full total, credits Revenue for the taxable amount
   * (subtotal - discount), and credits Tax Payable for the tax
   * portion if any — all three account IDs come from
   * FinanceSettings, never guessed or hardcoded. The resulting
   * journal entry is auto-posted immediately (not left as a
   * draft for someone to review) because it's system-generated
   * and correct-by-construction from the invoice's own already-
   * validated totals — there's nothing to review.
   */
  /**
   * If any line item is linked to an inventory item, this ALSO
   * adds a COGS debit / Inventory credit leg to the SAME journal
   * entry, and decreases stock for each — using each item's
   * CURRENT weighted average cost at the moment of sale, frozen
   * onto the movement record. An invoice with NO inventory-linked
   * lines produces EXACTLY the same journal entry as before this
   * integration existed — this only ever ADDS lines, never changes
   * the AR/Revenue/Tax lines already established.
   */
  async issue(companyId: string, actorUserId: string, id: string) {
    const invoice = await this.findOne(companyId, id);
    this.assertDraft(invoice);
    if (invoice.items.length === 0) {
      throw new UnprocessableEntityException('Cannot issue an invoice with no line items.');
    }
    await this.periodLock.assertDateNotLocked(companyId, invoice.issueDate);

    const settings = await this.prisma.financeSettings.findUnique({ where: { companyId } });
    if (!settings?.defaultReceivableAccountId || !settings?.defaultRevenueAccountId) {
      throw new UnprocessableEntityException(
        'Finance Settings must have a default Accounts Receivable account and a default Revenue account configured before invoices can be issued.',
      );
    }
    const taxAmount = new Prisma.Decimal(invoice.tax);
    if (taxAmount.gt(0) && !settings.defaultTaxPayableAccountId) {
      throw new UnprocessableEntityException(
        'This invoice has a tax amount, but Finance Settings has no default Tax Payable account configured.',
      );
    }

    // ---- Multi-currency: convert to BASE currency (SAR) for the ledger ----
    // The invoice's own subtotal/discount/tax/total remain in its
    // DOCUMENT currency everywhere else (what the customer sees on
    // the PDF, what the invoice list displays) — ONLY the journal
    // entry amounts below are converted, using the rate frozen on
    // this invoice at creation. A SAR invoice has rate exactly 1,
    // so this multiplication is a no-op for every invoice that
    // predates multi-currency or was simply never given a foreign
    // currency — zero behavior change for the existing common case.
    const rate = new Prisma.Decimal(invoice.exchangeRateToBase);
    const totalBase = new Prisma.Decimal(invoice.total).mul(rate).toDecimalPlaces(2);
    const taxableAmountBase = new Prisma.Decimal(invoice.subtotal).sub(invoice.discount).mul(rate).toDecimalPlaces(2);
    const taxAmountBase = taxAmount.mul(rate).toDecimalPlaces(2);

    const lines = [
      { accountId: settings.defaultReceivableAccountId, debit: totalBase, credit: 0 },
      { accountId: settings.defaultRevenueAccountId, debit: 0, credit: taxableAmountBase },
      ...(taxAmount.gt(0) ? [{ accountId: settings.defaultTaxPayableAccountId!, debit: 0, credit: taxAmountBase }] : []),
    ];

    // --- NEW multi-warehouse stock integration (separate from the
    // OLD InventoryItem/COGS block below — this system has no
    // costing model, so it creates NO journal lines of its own).
    // Checked and validated BEFORE the GL transaction opens, so a
    // stock shortfall blocks issuance cleanly rather than posting
    // the journal entry and then failing partway through. The
    // actual StockMovement creation still happens AFTER the GL
    // transaction commits (see the end of this method) — each
    // line via the existing, independently-atomic
    // InventoryMovementsService.issue(), not inside this
    // transaction; see PurchaseOrderReceiptsService's comment for
    // why composing into one shared transaction was deliberately
    // not attempted.
    const newStockLines = invoice.items.filter(
      (i): i is typeof i & { stockItemId: string } => !!i.stockItemId,
    );
    if (newStockLines.length > 0) {
      if (!invoice.warehouseId) {
        throw new UnprocessableEntityException('This invoice has line items linked to stock items — select a warehouse before issuing.');
      }
      for (const item of newStockLines) {
        const stock = await this.prisma.inventoryStock.findUnique({
          where: { warehouseId_itemId: { warehouseId: invoice.warehouseId, itemId: item.stockItemId } },
        });
        const available = stock ? Number(stock.quantityOnHand) : 0;
        if (Number(item.quantity) > available) {
          throw new UnprocessableEntityException(
            `Not enough stock for "${item.description}" at the selected warehouse — ${available} available, ${item.quantity} requested.`,
          );
        }
      }
    }

    // --- Inventory / COGS integration (F15) ---
    const inventoryLines = invoice.items.filter((i: any) => i.inventoryItemId);
    const stockUpdates: Array<{ inventoryItemId: string; quantity: Prisma.Decimal; newQty: Prisma.Decimal; unitCost: Prisma.Decimal }> = [];
    const cogsByAccount = new Map<string, Prisma.Decimal>();
    const inventoryCreditByAccount = new Map<string, Prisma.Decimal>();

    for (const item of inventoryLines) {
      const invItem = item.inventoryItem;
      if (!invItem?.inventoryAccountId || !invItem?.cogsAccountId) {
        throw new UnprocessableEntityException(
          `Line item "${item.description}" is linked to an inventory item that has no inventory/COGS account configured.`,
        );
      }
      const quantity = new Prisma.Decimal(item.quantity);
      const onHand = new Prisma.Decimal(invItem.quantityOnHand);
      if (quantity.gt(onHand)) {
        throw new UnprocessableEntityException(
          `Not enough stock for "${invItem.name}" — ${onHand} on hand, ${quantity} requested.`,
        );
      }
      const unitCost = new Prisma.Decimal(invItem.averageUnitCost);
      const cogsAmount = quantity.mul(unitCost).toDecimalPlaces(2);

      cogsByAccount.set(invItem.cogsAccountId, (cogsByAccount.get(invItem.cogsAccountId) ?? new Prisma.Decimal(0)).add(cogsAmount));
      inventoryCreditByAccount.set(
        invItem.inventoryAccountId,
        (inventoryCreditByAccount.get(invItem.inventoryAccountId) ?? new Prisma.Decimal(0)).add(cogsAmount),
      );

      stockUpdates.push({ inventoryItemId: invItem.id, quantity, newQty: onHand.sub(quantity), unitCost });
    }

    for (const [accountId, amount] of cogsByAccount) lines.push({ accountId, debit: amount, credit: 0 });
    for (const [accountId, amount] of inventoryCreditByAccount) lines.push({ accountId, debit: 0, credit: amount });

    JournalEntryValidator.assertBalanced(lines);

    return this.prisma.$transaction(async (tx) => {
      const entryNumber = await this.generateJournalEntryNumber(tx, companyId);
      const entry = await tx.journalEntry.create({
        data: {
          companyId,
          entryNumber,
          entryDate: invoice.issueDate,
          reference: invoice.invoiceNumber,
          description: `Invoice ${invoice.invoiceNumber} issued`,
          status: 'posted',
          postedAt: new Date(),
          createdBy: actorUserId,
          lines: { create: lines.map((l, index) => ({ ...l, lineOrder: index })) },
        },
      });

      for (const su of stockUpdates) {
        await tx.inventoryMovement.create({
          data: {
            companyId,
            inventoryItemId: su.inventoryItemId,
            type: 'sale',
            quantity: su.quantity,
            unitCost: su.unitCost,
            quantityAfter: su.newQty,
            averageCostAfter: su.unitCost,
            journalEntryId: entry.id,
            referenceType: 'invoice',
            referenceId: invoice.id,
            createdBy: actorUserId,
          },
        });
        await tx.inventoryItem.update({ where: { id: su.inventoryItemId }, data: { quantityOnHand: su.newQty } });
      }

      return tx.invoice.update({
        where: { id },
        // issuedAt captures the PRECISE moment of issuance (date
        // and time) — required for ZATCA QR Tag 3, and distinct
        // from issueDate (a date-only business field the user
        // picked, which may not match the actual system time).
        data: { status: 'sent', journalEntryId: entry.id, issuedAt: new Date() },
      });
    }).then(async (updatedInvoice) => {
      // NEW multi-warehouse stock deduction — deliberately AFTER
      // the GL transaction above has already committed. Each line
      // is issued independently via the existing, already-tested
      // InventoryMovementsService.issue() (its own atomic
      // transaction), not composed into the GL transaction's own —
      // same disclosed limitation as PurchaseOrderReceiptsService:
      // if a later line fails, earlier lines in this loop remain
      // committed. The pre-check above (sufficiency + warehouse
      // required) makes a failure here unlikely in normal use, but
      // does not make it impossible under concurrent activity.
      for (const item of newStockLines) {
        await this.inventoryMovementsService.issue(companyId, actorUserId, {
          itemId: item.stockItemId,
          warehouseId: invoice.warehouseId!,
          quantity: Number(item.quantity),
          reason: `Issued against invoice ${invoice.invoiceNumber}`,
        });
      }

      // ZATCA Phase 2 — deliberately AFTER the GL transaction and
      // stock deduction above, and deliberately NOT allowed to
      // throw and undo either of those: see
      // ZatcaInvoiceSubmissionService's file comment for why a
      // submission failure is recorded for operator review rather
      // than blocking an invoice that has already, correctly,
      // been issued in this system. Silently returns null (no-op)
      // for a company not onboarded to Phase 2.
      await this.zatcaSubmissionService.submitInvoice(companyId, invoice);

      return updatedInvoice;
    });
  }

  /**
   * ZATCA Phase 1 (Generation Phase) QR code for this invoice —
   * see ZatcaQrEncoder for why this deliberately stops at Phase 1
   * (Tags 1-5) and does not attempt Phase 2's cryptographic-stamp
   * tags. Only meaningful for an ISSUED invoice (issuedAt is only
   * set once `issue()` has run), and requires Finance Settings to
   * have the seller name + VAT registration number configured —
   * same "reject with a clear message rather than guess" pattern
   * as the accounts required to issue an invoice in the first
   * place.
   */
  async getZatcaQrCode(companyId: string, id: string): Promise<string> {
    const invoice = await this.findOne(companyId, id);
    if (!invoice.issuedAt) {
      throw new UnprocessableEntityException('This invoice has not been issued yet — no ZATCA QR code exists for a draft.');
    }

    // Phase 2 (if this company is onboarded and this invoice was
    // actually submitted): use the QR computed and stored AT
    // SUBMISSION TIME — never recomputed, since ECDSA signing is
    // non-deterministic (see migration 103's comment). Falls back
    // to Phase 1 below for a company not yet on Phase 2, or if a
    // submission is still pending/failed and has no stored QR yet.
    const submission = await this.prisma.zatcaSubmission.findFirst({
      where: { invoiceId: id, qrCodeBase64: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    if (submission?.qrCodeBase64) {
      return submission.qrCodeBase64;
    }

    const settings = await this.prisma.financeSettings.findUnique({ where: { companyId } });
    if (!settings?.sellerName || !settings?.vatRegistrationNumber) {
      throw new UnprocessableEntityException(
        'Finance Settings must have the seller name and VAT registration number configured before a ZATCA QR code can be generated.',
      );
    }

    // ZATCA QR amounts MUST be in the base currency (SAR) — Saudi
    // e-invoicing regulation is not denominated in whatever
    // currency an invoice happened to be issued in. This is the
    // SAME conversion issue() already applies to the journal entry
    // (see that method's comment); a SAR invoice has rate 1, so
    // this is a no-op for the common case.
    const rate = new Prisma.Decimal(invoice.exchangeRateToBase);
    const invoiceTotalBase = new Prisma.Decimal(invoice.total).mul(rate).toDecimalPlaces(2);
    const vatTotalBase = new Prisma.Decimal(invoice.tax).mul(rate).toDecimalPlaces(2);

    return ZatcaQrEncoder.encode({
      sellerName: settings.sellerName,
      vatRegistrationNumber: settings.vatRegistrationNumber,
      invoiceTimestamp: invoice.issuedAt,
      invoiceTotal: invoiceTotalBase.toString(),
      vatTotal: vatTotalBase.toString(),
    });
  }

  async cancel(companyId: string, id: string) {
    const invoice = await this.findOne(companyId, id);
    this.assertDraft(invoice);
    return this.prisma.invoice.update({ where: { id }, data: { status: 'cancelled' } });
  }

  async softDelete(companyId: string, id: string) {
    const invoice = await this.findOne(companyId, id);
    this.assertDraft(invoice);
    return this.prisma.invoice.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private assertDraft(invoice: { status: string }) {
    if (invoice.status !== 'draft') {
      throw new UnprocessableEntityException(
        `This action is only available while the invoice is in 'draft' status (currently '${invoice.status}').`,
      );
    }
  }

  /**
   * Duplicated intentionally from QuotationsService's identical
   * method rather than introducing a cross-module dependency for
   * one small validation — see that copy's comment for the full
   * rationale (SAR is always rate 1, a non-SAR code must be a real
   * active currency with a positive rate supplied).
   */
  private async resolveCurrency(
    currencyCode: string | undefined,
    exchangeRateToBase: number | undefined,
  ): Promise<{ currencyCode: string; exchangeRateToBase: number }> {
    const code = (currencyCode ?? 'SAR').toUpperCase();
    if (code === 'SAR') {
      return { currencyCode: 'SAR', exchangeRateToBase: 1 };
    }
    const currency = await this.prisma.currency.findFirst({ where: { code, isActive: true } });
    if (!currency) {
      throw new UnprocessableEntityException(`Unknown or inactive currency code: ${code}`);
    }
    if (!exchangeRateToBase || exchangeRateToBase <= 0) {
      throw new UnprocessableEntityException('exchangeRateToBase is required and must be greater than 0 for a non-SAR currency.');
    }
    return { currencyCode: code, exchangeRateToBase };
  }

  private async generateInvoiceNumber(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const count = await tx.invoice.count({ where: { companyId, invoiceNumber: { startsWith: prefix } } });
    let attempt = count + 1;
    for (let tries = 0; tries < 5; tries++) {
      const candidate = `${prefix}${String(attempt).padStart(4, '0')}`;
      const clash = await tx.invoice.findFirst({ where: { companyId, invoiceNumber: candidate }, select: { id: true } });
      if (!clash) return candidate;
      attempt++;
    }
    throw new UnprocessableEntityException('Could not generate a unique invoice number, please retry.');
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
