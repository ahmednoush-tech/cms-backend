import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInventoryItemDto, UpdateInventoryItemDto } from './dto/inventory-item.dto';

@Injectable()
export class InventoryItemsService {
  constructor(private prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.stockItem.findMany({ where: { companyId, deletedAt: null }, orderBy: { name: 'asc' } });
  }

  async findOne(companyId: string, id: string) {
    const item = await this.prisma.stockItem.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!item) throw new NotFoundException('Inventory item not found.');
    return item;
  }

  async create(companyId: string, dto: CreateInventoryItemDto) {
    const existing = await this.prisma.stockItem.findFirst({ where: { companyId, sku: dto.sku, deletedAt: null } });
    if (existing) {
      throw new UnprocessableEntityException(`SKU "${dto.sku}" is already in use.`);
    }
    return this.prisma.stockItem.create({
      data: {
        companyId,
        sku: dto.sku,
        name: dto.name,
        description: dto.description,
        unitOfMeasure: dto.unitOfMeasure ?? 'unit',
        reorderPoint: dto.reorderPoint,
      },
    });
  }

  async update(companyId: string, id: string, dto: UpdateInventoryItemDto) {
    await this.findOne(companyId, id);
    return this.prisma.stockItem.update({ where: { id }, data: dto });
  }

  /** Soft-delete only — an item referenced by past inventory_movements must remain readable in that historical context. */
  async deactivate(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.stockItem.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
  }
}
