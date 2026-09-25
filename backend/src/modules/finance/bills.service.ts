import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceCalculator } from '../../common/services/invoice-calculator';
import { JournalEntryValidator } from '../../common/services/journal-entry-validator';
import { PeriodLockService } from './period-lock.service';
import { CreateBillDto } from './dto/create-bill.dto';
import { UpdateBillDto } from './dto/update-bill.dto';
import { PaginationQueryDto, buildMeta } from '../../common/dto/pagination-query.dto';

@Injectable()
export class BillsService {
  constructor(
    private prisma: PrismaService,
    private periodLock: PeriodLockService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreateBillDto) {
    const vendor = await this.prisma.vendor.findFirst({ where: { id: dto.vendorId, companyId, deletedAt: null } });
    if (!vendor) throw new NotFoundException('Vendor not found.');

    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({ where: { id: dto.projectId, companyId, deletedAt: null } });
      if (!project) throw new NotFoundException('Project not found.');
    }

    // Same line/total math as Invoices (InvoiceCalculator is
    // deliberately reused here — a bill's shape is identical to
    // an invoice's, just describing money owed instead of money
    // owed to us; there is no reason to duplicate a THIRD copy of
    // this calculator for a structurally identical calculation).
    const totals = InvoiceCalculator.aggregate(
      dto.items.map((i) => ({ ...i, discount: i.discount ?? 0, tax: i.tax ?? 0 })),
    );

    return this.prisma.$transaction(async (tx) => {
      const billNumber = await this.generateBillNumber(tx, companyId);
      return tx.bill.create({
        data: {
          companyId,
          vendorId: dto.vendorId,
          billNumber,
          vendorReference: dto.vendorReference,
          billDate: new Date(dto.billDate),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          notes: dto.notes,
          projectId: dto.projectId,
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
              inventoryItemId: i.inventoryItemId,
            })),
          },
        },
        include: { items: true },
      });
    });
  }

  async findAll(companyId: string, query: PaginationQueryDto & { status?: string; vendorId?: string }) {
    const { page, pageSize, search, sortBy, sortDir, status, vendorId } = query;
    const where = {
      companyId,
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(vendorId ? { vendorId } : {}),
      ...(search ? { billNumber: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.bill.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy ?? 'billDate']: sortDir ?? 'desc' },
      }),
      this.prisma.bill.count({ where }),
    ]);

    return { items, meta: buildMeta(page, pageSize, total) };
  }

  async findOne(companyId: string, id: string) {
    const bill = await this.prisma.bill.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        items: { include: { inventoryItem: true } },
        vendor: true,
        payments: { orderBy: { paymentDate: 'asc' } },
        project: { select: { id: true, name: true } },
      },
    });
    if (!bill) throw new NotFoundException('Bill not found.');
    return bill;
  }

  async update(companyId: string, id: string, dto: UpdateBillDto) {
    const bill = await this.findOne(companyId, id);
    this.assertDraft(bill);

    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({ where: { id: dto.projectId, companyId, deletedAt: null } });
      if (!project) throw new NotFoundException('Project not found.');
    }

    return this.prisma.bill.update({
      where: { id },
      data: {
        vendorReference: dto.vendorReference,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        notes: dto.notes,
        projectId: dto.projectId,
      },
    });
  }

  /**
   * Mirror of InvoicesService.issue(): debits Expense for the
   * taxable amount, debits Tax Recoverable (input VAT) if any,
   * and credits Accounts Payable for the full total. Auto-posted
   * immediately, same reasoning as invoices — system-generated
   * and correct-by-construction.
   */
  /**
   * If any line item is linked to an inventory item, this debits
   * THAT item's own Inventory account for its net (pre-tax)
   * amount — instead of lumping it into the aggregate Expense
   * account — and increases stock using the weighted average cost
   * method (the line's net unit cost is blended with whatever
   * quantity/cost the item already had). The aggregate Expense
   * line only ever covers the REMAINING non-inventory items, so a
   * bill with no inventory-linked lines produces EXACTLY the same
   * journal entry as before this integration existed.
   */
  async receive(companyId: string, actorUserId: string, id: string) {
    const bill = await this.findOne(companyId, id);
    this.assertDraft(bill);
    if (bill.items.length === 0) {
      throw new UnprocessableEntityException('Cannot receive a bill with no line items.');
    }
    await this.periodLock.assertDateNotLocked(companyId, bill.billDate);

    const settings = await this.prisma.financeSettings.findUnique({ where: { companyId } });
    if (!settings?.defaultPayableAccountId || !settings?.defaultExpenseAccountId) {
      throw new UnprocessableEntityException(
        'Finance Settings must have a default Accounts Payable account and a default Expense account configured before bills can be received.',
      );
    }
    const taxAmount = new Prisma.Decimal(bill.tax);
    if (taxAmount.gt(0) && !settings.defaultTaxRecoverableAccountId) {
      throw new UnprocessableEntityException(
        'This bill has a tax amount, but Finance Settings has no default Tax Recoverable account configured.',
      );
    }

    // --- Inventory integration (F15) ---
    const inventoryLines = bill.items.filter((i: any) => i.inventoryItemId);
    const stockUpdates: Array<{ inventoryItemId: string; quantity: Prisma.Decimal; newQty: Prisma.Decimal; unitCost: Prisma.Decimal; newAvgCost: Prisma.Decimal }> = [];
    const inventoryDebitByAccount = new Map<string, Prisma.Decimal>();
    let inventoryLinesTaxableTotal = new Prisma.Decimal(0);

    for (const item of inventoryLines) {
      const invItem = item.inventoryItem;
      if (!invItem?.inventoryAccountId) {
        throw new UnprocessableEntityException(
          `Line item "${item.description}" is linked to an inventory item that has no inventory account configured.`,
        );
      }
      const quantity = new Prisma.Decimal(item.quantity);
      const lineNetAmount = new Prisma.Decimal(item.total).sub(item.tax); // pre-tax net value of this line
      const unitCost = lineNetAmount.div(quantity).toDecimalPlaces(4);

      const currentQty = new Prisma.Decimal(invItem.quantityOnHand);
      const currentAvgCost = new Prisma.Decimal(invItem.averageUnitCost);
      const newQty = currentQty.add(quantity);
      const newAvgCost = newQty.gt(0)
        ? currentQty.mul(currentAvgCost).add(quantity.mul(unitCost)).div(newQty).toDecimalPlaces(4)
        : new Prisma.Decimal(0);

      inventoryDebitByAccount.set(
        invItem.inventoryAccountId,
        (inventoryDebitByAccount.get(invItem.inventoryAccountId) ?? new Prisma.Decimal(0)).add(lineNetAmount),
      );
      inventoryLinesTaxableTotal = inventoryLinesTaxableTotal.add(lineNetAmount);
      stockUpdates.push({ inventoryItemId: invItem.id, quantity, newQty, unitCost, newAvgCost });
    }

    const taxableAmount = new Prisma.Decimal(bill.subtotal).sub(bill.discount);
    const nonInventoryTaxable = taxableAmount.sub(inventoryLinesTaxableTotal);
    if (nonInventoryTaxable.lt(0)) {
      throw new UnprocessableEntityException('Inventory-linked line total exceeds the bill taxable amount — check line item data.');
    }

    const lines = [
      ...(nonInventoryTaxable.gt(0) ? [{ accountId: settings.defaultExpenseAccountId, debit: nonInventoryTaxable, credit: 0 }] : []),
      ...Array.from(inventoryDebitByAccount.entries()).map(([accountId, amount]) => ({ accountId, debit: amount, credit: 0 })),
      ...(taxAmount.gt(0) ? [{ accountId: settings.defaultTaxRecoverableAccountId!, debit: taxAmount, credit: 0 }] : []),
      { accountId: settings.defaultPayableAccountId, debit: 0, credit: bill.total },
    ];
    JournalEntryValidator.assertBalanced(lines);

    return this.prisma.$transaction(async (tx) => {
      const entryNumber = await this.generateJournalEntryNumber(tx, companyId);
      const entry = await tx.journalEntry.create({
        data: {
          companyId,
          entryNumber,
          entryDate: bill.billDate,
          reference: bill.billNumber,
          description: `Bill ${bill.billNumber} received`,
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
            type: 'purchase',
            quantity: su.quantity,
            unitCost: su.unitCost,
            quantityAfter: su.newQty,
            averageCostAfter: su.newAvgCost,
            journalEntryId: entry.id,
            referenceType: 'bill',
            referenceId: bill.id,
            createdBy: actorUserId,
          },
        });
        await tx.inventoryItem.update({
          where: { id: su.inventoryItemId },
          data: { quantityOnHand: su.newQty, averageUnitCost: su.newAvgCost },
        });
      }

      return tx.bill.update({
        where: { id },
        data: { status: 'received', journalEntryId: entry.id },
      });
    });
  }

  async cancel(companyId: string, id: string) {
    const bill = await this.findOne(companyId, id);
    this.assertDraft(bill);
    return this.prisma.bill.update({ where: { id }, data: { status: 'cancelled' } });
  }

  async softDelete(companyId: string, id: string) {
    const bill = await this.findOne(companyId, id);
    this.assertDraft(bill);
    return this.prisma.bill.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private assertDraft(bill: { status: string }) {
    if (bill.status !== 'draft') {
      throw new UnprocessableEntityException(
        `This action is only available while the bill is in 'draft' status (currently '${bill.status}').`,
      );
    }
  }

  private async generateBillNumber(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `BILL-${year}-`;
    const count = await tx.bill.count({ where: { companyId, billNumber: { startsWith: prefix } } });
    let attempt = count + 1;
    for (let tries = 0; tries < 5; tries++) {
      const candidate = `${prefix}${String(attempt).padStart(4, '0')}`;
      const clash = await tx.bill.findFirst({ where: { companyId, billNumber: candidate }, select: { id: true } });
      if (!clash) return candidate;
      attempt++;
    }
    throw new UnprocessableEntityException('Could not generate a unique bill number, please retry.');
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
