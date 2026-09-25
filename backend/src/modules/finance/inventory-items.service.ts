import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalEntryValidator } from '../../common/services/journal-entry-validator';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { PaginationQueryDto, buildMeta } from '../../common/dto/pagination-query.dto';

const { Decimal } = Prisma;
const COST_DP = 4;
const MONEY_DP = 2;

@Injectable()
export class InventoryItemsService {
  constructor(private prisma: PrismaService) {}

  async create(companyId: string, actorUserId: string, dto: CreateInventoryItemDto) {
    const existing = await this.prisma.inventoryItem.findUnique({ where: { companyId_sku: { companyId, sku: dto.sku } } });
    if (existing) {
      throw new ConflictException(`An inventory item with SKU "${dto.sku}" already exists.`);
    }

    const openingQuantity = new Decimal(dto.openingQuantity ?? 0);
    const openingUnitCost = new Decimal(dto.openingUnitCost ?? 0);

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.create({
        data: {
          companyId,
          sku: dto.sku,
          name: dto.name,
          description: dto.description,
          unitOfMeasure: dto.unitOfMeasure ?? 'unit',
          quantityOnHand: openingQuantity,
          averageUnitCost: openingUnitCost,
          inventoryAccountId: dto.inventoryAccountId,
          cogsAccountId: dto.cogsAccountId,
          isActive: dto.isActive ?? true,
          createdBy: actorUserId,
        },
      });

      if (openingQuantity.gt(0)) {
        await tx.inventoryMovement.create({
          data: {
            companyId,
            inventoryItemId: item.id,
            type: 'opening',
            quantity: openingQuantity,
            unitCost: openingUnitCost,
            quantityAfter: openingQuantity,
            averageCostAfter: openingUnitCost,
            createdBy: actorUserId,
          },
        });
      }

      return item;
    });
  }

  async findAll(companyId: string, query: PaginationQueryDto & { isActive?: boolean }) {
    const { page, pageSize, search, sortBy, sortDir, isActive } = query;
    const where = {
      companyId,
      deletedAt: null,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { sku: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventoryItem.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy ?? 'name']: sortDir ?? 'asc' },
      }),
      this.prisma.inventoryItem.count({ where }),
    ]);

    return { items, meta: buildMeta(page, pageSize, total) };
  }

  async findOne(companyId: string, id: string) {
    const item = await this.prisma.inventoryItem.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!item) throw new NotFoundException('Inventory item not found.');
    return item;
  }

  async update(companyId: string, id: string, dto: UpdateInventoryItemDto) {
    await this.findOne(companyId, id);
    return this.prisma.inventoryItem.update({ where: { id }, data: dto });
  }

  async findMovements(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.inventoryMovement.findMany({
      where: { companyId, inventoryItemId: id },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * A manual stock adjustment ALWAYS requires an explicit
   * offsetting account — never guessed. An increase debits
   * Inventory and credits whatever the caller specifies (e.g. a
   * "found stock" or equity account); a decrease debits whatever
   * the caller specifies (e.g. a shrinkage/write-off expense
   * account) and credits Inventory. Weighted average cost is
   * recomputed only on an increase (a decrease never changes the
   * average cost of what remains).
   */
  async adjustStock(companyId: string, actorUserId: string, dto: AdjustStockDto) {
    const item = await this.findOne(companyId, dto.inventoryItemId);
    if (!item.inventoryAccountId) {
      throw new UnprocessableEntityException('This item has no inventory account configured — set one before adjusting stock.');
    }

    const quantity = new Decimal(dto.quantity);
    const currentQty = new Decimal(item.quantityOnHand);
    const currentAvgCost = new Decimal(item.averageUnitCost);

    let newQty: Prisma.Decimal;
    let newAvgCost: Prisma.Decimal;
    let movementAmount: Prisma.Decimal;
    let unitCostForMovement: Prisma.Decimal;

    if (dto.direction === 'increase') {
      if (dto.unitCost === undefined) {
        throw new UnprocessableEntityException('unitCost is required when increasing stock.');
      }
      unitCostForMovement = new Decimal(dto.unitCost);
      const existingValue = currentQty.mul(currentAvgCost);
      const addedValue = quantity.mul(unitCostForMovement);
      newQty = currentQty.add(quantity);
      newAvgCost = newQty.gt(0) ? existingValue.add(addedValue).div(newQty).toDecimalPlaces(COST_DP) : new Decimal(0);
      movementAmount = addedValue.toDecimalPlaces(MONEY_DP);
    } else {
      if (quantity.gt(currentQty)) {
        throw new UnprocessableEntityException(`Cannot decrease by ${dto.quantity} — only ${item.quantityOnHand} on hand.`);
      }
      unitCostForMovement = currentAvgCost;
      newQty = currentQty.sub(quantity);
      newAvgCost = currentAvgCost;
      movementAmount = quantity.mul(currentAvgCost).toDecimalPlaces(MONEY_DP);
    }

    const lines =
      dto.direction === 'increase'
        ? [
            { accountId: item.inventoryAccountId, debit: movementAmount, credit: 0 },
            { accountId: dto.offsetAccountId, debit: 0, credit: movementAmount },
          ]
        : [
            { accountId: dto.offsetAccountId, debit: movementAmount, credit: 0 },
            { accountId: item.inventoryAccountId, debit: 0, credit: movementAmount },
          ];
    JournalEntryValidator.assertBalanced(lines);

    return this.prisma.$transaction(async (tx) => {
      const entryNumber = await this.generateJournalEntryNumber(tx, companyId);
      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId,
          entryNumber,
          entryDate: new Date(),
          reference: item.sku,
          description: `Stock ${dto.direction} — ${item.name}`,
          status: 'posted',
          postedAt: new Date(),
          createdBy: actorUserId,
          lines: { create: lines.map((l, index) => ({ ...l, lineOrder: index })) },
        },
      });

      await tx.inventoryMovement.create({
        data: {
          companyId,
          inventoryItemId: item.id,
          type: dto.direction === 'increase' ? 'adjustment_increase' : 'adjustment_decrease',
          quantity,
          unitCost: unitCostForMovement,
          quantityAfter: newQty,
          averageCostAfter: newAvgCost,
          journalEntryId: journalEntry.id,
          notes: dto.notes,
          createdBy: actorUserId,
        },
      });

      return tx.inventoryItem.update({
        where: { id: item.id },
        data: { quantityOnHand: newQty, averageUnitCost: newAvgCost },
      });
    });
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
