import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InventoryStockService {
  constructor(private prisma: PrismaService) {}

  findByWarehouse(companyId: string, warehouseId: string) {
    return this.prisma.inventoryStock.findMany({
      where: { companyId, warehouseId },
      include: { item: true },
      orderBy: { item: { name: 'asc' } },
    });
  }

  findByItem(companyId: string, itemId: string) {
    return this.prisma.inventoryStock.findMany({
      where: { companyId, itemId },
      include: { warehouse: true },
      orderBy: { warehouse: { name: 'asc' } },
    });
  }

  /** Items at or below their configured reorder point, across ALL warehouses combined — a company-wide replenishment view, not per-warehouse. */
  async findLowStock(companyId: string) {
    const items = await this.prisma.stockItem.findMany({
      where: { companyId, deletedAt: null, isActive: true, reorderPoint: { not: null } },
      include: { stock: true },
    });

    return items
      .map((item) => ({
        item,
        totalQuantity: item.stock.reduce((sum, s) => sum + Number(s.quantityOnHand), 0),
      }))
      .filter(({ item, totalQuantity }) => totalQuantity <= Number(item.reorderPoint));
  }
}
