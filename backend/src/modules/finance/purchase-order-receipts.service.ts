import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryMovementsService } from '../inventory/inventory-movements.service';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';

@Injectable()
export class PurchaseOrderReceiptsService {
  constructor(
    private prisma: PrismaService,
    private inventoryMovementsService: InventoryMovementsService,
  ) {}

  /**
   * Records a (possibly partial) delivery against a purchase
   * order. Only lines with a stockItemId set actually create a
   * StockMovement (via the EXISTING, already-tested
   * InventoryMovementsService.receipt() — this method never
   * duplicates that atomic stock-update logic itself); a line with
   * no stockItemId (a service, or anything not tracked as
   * multi-warehouse stock) still has its receivedQuantity updated,
   * but produces no stock movement.
   *
   * KNOWN LIMITATION, disclosed rather than hidden: each line is
   * processed independently — receipt() commits its own stock
   * movement in its own transaction, and receivedQuantity is
   * updated right after in a second, separate write. If a later
   * line in a multi-line request fails, EARLIER lines in the SAME
   * request remain committed — this is NOT a single all-or-nothing
   * transaction across every line. A caller who wants strict
   * atomicity across multiple lines should submit one line per
   * request. Refactoring InventoryMovementsService.receipt() to
   * compose into one larger transaction was deliberately left out
   * of this change rather than risk altering its already-tested
   * atomicity guarantees.
   */
  async receive(companyId: string, actorId: string, purchaseOrderId: string, dto: ReceivePurchaseOrderDto) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, companyId, deletedAt: null },
      include: { items: true },
    });
    if (!po) throw new NotFoundException('Purchase order not found.');
    if (po.status !== 'sent') {
      throw new UnprocessableEntityException(`Can only receive goods against a purchase order that has been sent to the vendor (currently '${po.status}').`);
    }

    const itemsById = new Map(po.items.map((item) => [item.id, item]));
    const results: Array<{ purchaseOrderItemId: string; receivedNow: number; movementCreated: boolean }> = [];

    for (const line of dto.lines) {
      const item = itemsById.get(line.purchaseOrderItemId);
      if (!item) {
        throw new NotFoundException(`Purchase order line ${line.purchaseOrderItemId} does not belong to this purchase order.`);
      }

      const remaining = Number(item.quantity) - Number(item.receivedQuantity);
      if (line.quantity > remaining) {
        throw new UnprocessableEntityException(
          `Cannot receive ${line.quantity} for "${item.description}" — only ${remaining} remains unreceived on this line.`,
        );
      }

      if (item.stockItemId) {
        await this.inventoryMovementsService.receipt(companyId, actorId, {
          itemId: item.stockItemId,
          warehouseId: dto.warehouseId,
          quantity: line.quantity,
          reason: `Received against PO ${po.poNumber}`,
        });
      }

      await this.prisma.purchaseOrderItem.update({
        where: { id: item.id },
        data: { receivedQuantity: { increment: line.quantity } },
      });

      results.push({ purchaseOrderItemId: item.id, receivedNow: line.quantity, movementCreated: !!item.stockItemId });
    }

    return { purchaseOrderId, results };
  }
}
