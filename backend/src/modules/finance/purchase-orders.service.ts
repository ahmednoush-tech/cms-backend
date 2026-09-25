import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceCalculator } from '../../common/services/invoice-calculator';
import { BillsService } from './bills.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { PurchaseOrderItemDto } from './dto/purchase-order-item.dto';
import { RejectPurchaseOrderDto } from './dto/reject-purchase-order.dto';
import { PaginationQueryDto, buildMeta } from '../../common/dto/pagination-query.dto';

/**
 * Only a draft PO's items can be added/removed. Once submitted
 * for approval, the requested content is frozen — an approver is
 * approving a fixed set of items, not a moving target; a change of
 * mind at that stage means cancel-and-recreate, matching the same
 * "delete and start over" rule already used for depreciation-basis
 * fields on FixedAsset and identity fields on TimeEntry.
 */
const ITEM_MUTABLE_STATUSES = ['draft'];

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private prisma: PrismaService,
    private billsService: BillsService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreatePurchaseOrderDto) {
    const vendor = await this.prisma.vendor.findFirst({ where: { id: dto.vendorId, companyId, deletedAt: null } });
    if (!vendor) throw new NotFoundException('Vendor not found.');

    const items = dto.items ?? [];
    const totals = items.length > 0
      ? InvoiceCalculator.aggregate(items.map((i) => ({ ...i, discount: i.discount ?? 0, tax: i.tax ?? 0 })))
      : { subtotal: 0, discount: 0, tax: 0, total: 0 };

    return this.prisma.$transaction(async (tx) => {
      const poNumber = await this.generatePoNumber(tx, companyId);
      return tx.purchaseOrder.create({
        data: {
          companyId,
          vendorId: dto.vendorId,
          poNumber,
          expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : undefined,
          notes: dto.notes,
          createdBy: actorUserId,
          status: 'draft',
          subtotal: totals.subtotal,
          discount: totals.discount,
          tax: totals.tax,
          total: totals.total,
          items: items.length > 0 ? { create: items.map((i) => ({ ...InvoiceCalculator.calculateLine(i), description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, inventoryItemId: i.inventoryItemId })) } : undefined,
        },
        include: { items: true },
      });
    });
  }

  async findAll(companyId: string, query: PaginationQueryDto & { status?: string; vendorId?: string }) {
    const { page, pageSize, sortBy, sortDir, status, vendorId } = query;
    const where = {
      companyId,
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(vendorId ? { vendorId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy ?? 'createdAt']: sortDir ?? 'desc' },
        include: { vendor: { select: { id: true, name: true } } },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return { items, meta: buildMeta(page, pageSize, total) };
  }

  async findOne(companyId: string, id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { items: { include: { inventoryItem: true } }, vendor: true, bill: true, approvedByUser: { select: { id: true, email: true } } },
    });
    if (!po) throw new NotFoundException('Purchase order not found.');
    return po;
  }

  async update(companyId: string, id: string, dto: UpdatePurchaseOrderDto) {
    const po = await this.findOne(companyId, id);
    if (po.status !== 'draft') {
      throw new UnprocessableEntityException('Only a draft purchase order can be edited.');
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : undefined,
        notes: dto.notes,
      },
    });
  }

  async addItem(companyId: string, poId: string, dto: PurchaseOrderItemDto) {
    const po = await this.findOne(companyId, poId);
    this.assertItemsMutable(po);

    const line = InvoiceCalculator.calculateLine(dto);

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.purchaseOrderItem.create({
        data: {
          purchaseOrderId: poId,
          description: dto.description,
          quantity: dto.quantity,
          unitPrice: dto.unitPrice,
          discount: line.discount,
          tax: line.tax,
          total: line.total,
          inventoryItemId: dto.inventoryItemId,
        },
      });
      await this.recalculateTotals(tx, poId);
      return item;
    });
  }

  async removeItem(companyId: string, poId: string, itemId: string) {
    const po = await this.findOne(companyId, poId);
    this.assertItemsMutable(po);

    const existingItem = po.items.find((i) => i.id === itemId);
    if (!existingItem) throw new NotFoundException('Purchase order item not found.');

    return this.prisma.$transaction(async (tx) => {
      await tx.purchaseOrderItem.delete({ where: { id: itemId } });
      await this.recalculateTotals(tx, poId);
    });
  }

  async submitForApproval(companyId: string, id: string) {
    const po = await this.findOne(companyId, id);
    if (po.status !== 'draft') {
      throw new UnprocessableEntityException(`Only a draft purchase order can be submitted for approval (currently '${po.status}').`);
    }
    if (po.items.length === 0) {
      throw new UnprocessableEntityException('Cannot submit a purchase order with no line items.');
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'pending_approval', submittedAt: new Date() },
    });
  }

  /**
   * Single-level, permission-based approval
   * (Finance:purchase_orders:approve) — no multi-step chain, no
   * value-threshold routing, and no check preventing the same
   * user from approving their own request. A company needing
   * those controls would build them as a distinct feature on top
   * of this foundation.
   */
  async approve(companyId: string, actorUserId: string, id: string) {
    const po = await this.findOne(companyId, id);
    if (po.status !== 'pending_approval') {
      throw new UnprocessableEntityException(`Only a purchase order pending approval can be approved (currently '${po.status}').`);
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'approved', approvedBy: actorUserId, approvedAt: new Date() },
    });
  }

  async reject(companyId: string, id: string, dto: RejectPurchaseOrderDto) {
    const po = await this.findOne(companyId, id);
    if (po.status !== 'pending_approval') {
      throw new UnprocessableEntityException(`Only a purchase order pending approval can be rejected (currently '${po.status}').`);
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'rejected', rejectionReason: dto.rejectionReason },
    });
  }

  async send(companyId: string, id: string) {
    const po = await this.findOne(companyId, id);
    if (po.status !== 'approved') {
      throw new UnprocessableEntityException(`Only an approved purchase order can be sent (currently '${po.status}').`);
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'sent', sentAt: new Date() },
    });
  }

  async cancel(companyId: string, id: string) {
    const po = await this.findOne(companyId, id);
    if (!['draft', 'pending_approval', 'approved'].includes(po.status)) {
      throw new UnprocessableEntityException(`A purchase order in '${po.status}' status cannot be cancelled.`);
    }
    return this.prisma.purchaseOrder.update({ where: { id }, data: { status: 'cancelled' } });
  }

  async softDelete(companyId: string, id: string) {
    const po = await this.findOne(companyId, id);
    if (po.status !== 'draft') {
      throw new UnprocessableEntityException('Only a draft purchase order can be deleted — cancel it instead.');
    }
    return this.prisma.purchaseOrder.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  /**
   * Creates an actual Bill pre-filled from this PO's vendor and
   * items (mirroring how a Quotation converts into an Invoice),
   * and marks the PO 'closed' with a link to the new Bill. The
   * Bill itself starts as a normal draft — receiving it (posting
   * the journal entry, updating inventory) is the SAME
   * BillsService.receive() action used everywhere else, untouched
   * by this conversion.
   */
  async convertToBill(companyId: string, actorUserId: string, id: string) {
    const po = await this.findOne(companyId, id);
    if (po.status !== 'sent') {
      throw new UnprocessableEntityException(`Only a purchase order that has been sent to the vendor can be converted to a bill (currently '${po.status}').`);
    }
    if (po.billId) {
      throw new ConflictException('This purchase order has already been converted to a bill.');
    }

    const bill = await this.billsService.create(companyId, actorUserId, {
      vendorId: po.vendorId,
      vendorReference: po.poNumber,
      billDate: new Date().toISOString().slice(0, 10),
      notes: po.notes ?? undefined,
      items: po.items.map((i) => ({
        description: i.description,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        discount: Number(i.discount),
        tax: Number(i.tax),
        inventoryItemId: i.inventoryItemId ?? undefined,
      })),
    });

    await this.prisma.purchaseOrder.update({ where: { id }, data: { status: 'closed', billId: bill.id } });

    return bill;
  }

  private assertItemsMutable(po: { status: string }) {
    if (!ITEM_MUTABLE_STATUSES.includes(po.status)) {
      throw new UnprocessableEntityException(`Line items can only be changed while the purchase order is a draft (currently '${po.status}').`);
    }
  }

  private async recalculateTotals(tx: Prisma.TransactionClient, poId: string) {
    const items = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: poId } });
    const totals = InvoiceCalculator.aggregate(
      items.map((i) => ({ quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), discount: Number(i.discount), tax: Number(i.tax) })),
    );
    await tx.purchaseOrder.update({
      where: { id: poId },
      data: { subtotal: totals.subtotal, discount: totals.discount, tax: totals.tax, total: totals.total },
    });
  }

  private async generatePoNumber(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PO-${year}-`;
    const count = await tx.purchaseOrder.count({ where: { companyId, poNumber: { startsWith: prefix } } });
    let attempt = count + 1;
    for (let tries = 0; tries < 5; tries++) {
      const candidate = `${prefix}${String(attempt).padStart(4, '0')}`;
      const clash = await tx.purchaseOrder.findFirst({ where: { companyId, poNumber: candidate }, select: { id: true } });
      if (!clash) return candidate;
      attempt++;
    }
    throw new ConflictException('Could not generate a unique purchase order number, please retry.');
  }
}
