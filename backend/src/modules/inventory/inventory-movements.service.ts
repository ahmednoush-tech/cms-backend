import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReceiptDto, IssueDto, TransferDto, AdjustmentDto } from './dto/inventory-movement.dto';

@Injectable()
export class InventoryMovementsService {
  constructor(private prisma: PrismaService) {}

  findAllForItem(companyId: string, itemId: string) {
    return this.prisma.stockMovement.findMany({
      where: { companyId, itemId },
      include: { warehouse: { select: { id: true, name: true } }, performedByUser: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async assertItemAndWarehouse(companyId: string, itemId: string, warehouseId: string) {
    const item = await this.prisma.stockItem.findFirst({ where: { id: itemId, companyId, deletedAt: null } });
    if (!item) throw new NotFoundException('Inventory item not found.');
    const warehouse = await this.prisma.warehouse.findFirst({ where: { id: warehouseId, companyId } });
    if (!warehouse) throw new NotFoundException('Warehouse not found.');
    return { item, warehouse };
  }

  /** Increases stock — creating the stock row if this item has never been held at this warehouse before. */
  async receipt(companyId: string, actorId: string, dto: ReceiptDto) {
    await this.assertItemAndWarehouse(companyId, dto.itemId, dto.warehouseId);

    return this.prisma.$transaction(async (tx) => {
      await tx.inventoryStock.upsert({
        where: { warehouseId_itemId: { warehouseId: dto.warehouseId, itemId: dto.itemId } },
        create: { companyId, warehouseId: dto.warehouseId, itemId: dto.itemId, quantityOnHand: dto.quantity },
        update: { quantityOnHand: { increment: dto.quantity } },
      });

      return tx.stockMovement.create({
        data: {
          companyId,
          itemId: dto.itemId,
          warehouseId: dto.warehouseId,
          movementType: 'receipt',
          quantity: dto.quantity,
          reason: dto.reason,
          performedBy: actorId,
        },
      });
    });
  }

  /**
   * Decreases stock — re-checks the CURRENT quantity INSIDE the
   * transaction before decrementing (not trusting any value read
   * before this call started), so two concurrent issues against
   * the same low-stock item can never both succeed and push the
   * quantity negative. The database's own quantity_on_hand >= 0
   * CHECK constraint (migration 094) is a second, final backstop
   * even if this application-level check were somehow bypassed.
   */
  async issue(companyId: string, actorId: string, dto: IssueDto) {
    await this.assertItemAndWarehouse(companyId, dto.itemId, dto.warehouseId);

    return this.prisma.$transaction(async (tx) => {
      const stock = await tx.inventoryStock.findUnique({ where: { warehouseId_itemId: { warehouseId: dto.warehouseId, itemId: dto.itemId } } });
      const available = stock ? Number(stock.quantityOnHand) : 0;
      if (dto.quantity > available) {
        throw new UnprocessableEntityException(`Cannot issue ${dto.quantity} — only ${available} available at this warehouse.`);
      }

      await tx.inventoryStock.update({
        where: { warehouseId_itemId: { warehouseId: dto.warehouseId, itemId: dto.itemId } },
        data: { quantityOnHand: { decrement: dto.quantity } },
      });

      return tx.stockMovement.create({
        data: {
          companyId,
          itemId: dto.itemId,
          warehouseId: dto.warehouseId,
          movementType: 'issue',
          quantity: dto.quantity,
          reason: dto.reason,
          performedBy: actorId,
        },
      });
    });
  }

  /**
   * A transfer is two linked movements (transfer_out at the
   * source, transfer_in at the destination), created ATOMICALLY —
   * a partial transfer must never be possible.
   */
  async transfer(companyId: string, actorId: string, dto: TransferDto) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new UnprocessableEntityException('Source and destination warehouse must be different.');
    }
    await this.assertItemAndWarehouse(companyId, dto.itemId, dto.fromWarehouseId);
    await this.assertItemAndWarehouse(companyId, dto.itemId, dto.toWarehouseId);

    return this.prisma.$transaction(async (tx) => {
      const sourceStock = await tx.inventoryStock.findUnique({
        where: { warehouseId_itemId: { warehouseId: dto.fromWarehouseId, itemId: dto.itemId } },
      });
      const available = sourceStock ? Number(sourceStock.quantityOnHand) : 0;
      if (dto.quantity > available) {
        throw new UnprocessableEntityException(`Cannot transfer ${dto.quantity} — only ${available} available at the source warehouse.`);
      }

      await tx.inventoryStock.update({
        where: { warehouseId_itemId: { warehouseId: dto.fromWarehouseId, itemId: dto.itemId } },
        data: { quantityOnHand: { decrement: dto.quantity } },
      });
      await tx.inventoryStock.upsert({
        where: { warehouseId_itemId: { warehouseId: dto.toWarehouseId, itemId: dto.itemId } },
        create: { companyId, warehouseId: dto.toWarehouseId, itemId: dto.itemId, quantityOnHand: dto.quantity },
        update: { quantityOnHand: { increment: dto.quantity } },
      });

      const outMovement = await tx.stockMovement.create({
        data: {
          companyId,
          itemId: dto.itemId,
          warehouseId: dto.fromWarehouseId,
          movementType: 'transfer_out',
          quantity: dto.quantity,
          reason: dto.reason,
          performedBy: actorId,
        },
      });
      const inMovement = await tx.stockMovement.create({
        data: {
          companyId,
          itemId: dto.itemId,
          warehouseId: dto.toWarehouseId,
          movementType: 'transfer_in',
          quantity: dto.quantity,
          reason: dto.reason,
          performedBy: actorId,
          relatedMovementId: outMovement.id,
        },
      });
      await tx.stockMovement.update({ where: { id: outMovement.id }, data: { relatedMovementId: inMovement.id } });

      return { outMovement, inMovement };
    });
  }

  /**
   * newQuantity is the counted total after a physical stocktake —
   * the delta (and whether it's recorded as an increase or
   * decrease movement) is computed here from the difference
   * against the CURRENT cached quantity, checked inside the same
   * transaction as every other movement type.
   */
  async adjustment(companyId: string, actorId: string, dto: AdjustmentDto) {
    await this.assertItemAndWarehouse(companyId, dto.itemId, dto.warehouseId);

    return this.prisma.$transaction(async (tx) => {
      const stock = await tx.inventoryStock.findUnique({ where: { warehouseId_itemId: { warehouseId: dto.warehouseId, itemId: dto.itemId } } });
      const current = stock ? Number(stock.quantityOnHand) : 0;
      const delta = dto.newQuantity - current;

      if (delta === 0) {
        throw new UnprocessableEntityException('The new quantity matches the current quantity — nothing to adjust.');
      }

      await tx.inventoryStock.upsert({
        where: { warehouseId_itemId: { warehouseId: dto.warehouseId, itemId: dto.itemId } },
        create: { companyId, warehouseId: dto.warehouseId, itemId: dto.itemId, quantityOnHand: dto.newQuantity },
        update: { quantityOnHand: dto.newQuantity },
      });

      return tx.stockMovement.create({
        data: {
          companyId,
          itemId: dto.itemId,
          warehouseId: dto.warehouseId,
          movementType: 'adjustment',
          quantity: Math.abs(delta),
          reason: dto.reason ?? (delta > 0 ? 'Stocktake increase' : 'Stocktake decrease'),
          performedBy: actorId,
        },
      });
    });
  }
}
