import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFixedAssetDto } from './dto/create-fixed-asset.dto';
import { UpdateFixedAssetDto } from './dto/update-fixed-asset.dto';
import { DisposeFixedAssetDto } from './dto/dispose-fixed-asset.dto';
import { PaginationQueryDto, buildMeta } from '../../common/dto/pagination-query.dto';
import { JournalEntryValidator } from '../../common/services/journal-entry-validator';
import { PeriodLockService } from '../finance/period-lock.service';

const { Decimal } = Prisma;
const MONEY_DP = 2;

@Injectable()
export class FixedAssetsService {
  constructor(
    private prisma: PrismaService,
    private periodLock: PeriodLockService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreateFixedAssetDto) {
    const salvageValue = new Decimal(dto.salvageValue ?? 0);
    if (salvageValue.gte(dto.purchaseCost)) {
      throw new UnprocessableEntityException('Salvage value must be less than purchase cost.');
    }

    return this.prisma.$transaction(async (tx) => {
      const assetNumber = await this.generateAssetNumber(tx, companyId);
      return tx.fixedAsset.create({
        data: {
          companyId,
          assetNumber,
          name: dto.name,
          category: dto.category,
          description: dto.description,
          purchaseDate: new Date(dto.purchaseDate),
          purchaseCost: dto.purchaseCost,
          salvageValue,
          usefulLifeMonths: dto.usefulLifeMonths,
          fixedAssetAccountId: dto.fixedAssetAccountId,
          accumulatedDepreciationAccountId: dto.accumulatedDepreciationAccountId,
          depreciationExpenseAccountId: dto.depreciationExpenseAccountId,
          createdBy: actorUserId,
        },
      });
    });
  }

  async findAll(companyId: string, query: PaginationQueryDto & { status?: string }) {
    const { page, pageSize, search, sortBy, sortDir, status } = query;
    const where = {
      companyId,
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { assetNumber: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.fixedAsset.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy ?? 'purchaseDate']: sortDir ?? 'desc' },
      }),
      this.prisma.fixedAsset.count({ where }),
    ]);

    return { items, meta: buildMeta(page, pageSize, total) };
  }

  async findOne(companyId: string, id: string) {
    const asset = await this.prisma.fixedAsset.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { depreciationEntries: { orderBy: { createdAt: 'asc' } } },
    });
    if (!asset) throw new NotFoundException('Fixed asset not found.');
    return asset;
  }

  async update(companyId: string, id: string, dto: UpdateFixedAssetDto) {
    await this.findOne(companyId, id);
    return this.prisma.fixedAsset.update({ where: { id }, data: dto });
  }

  /**
   * Real disposal accounting — writes off the asset and its
   * accumulated depreciation, and recognizes any gain or loss
   * versus net book value. See migration 070 for the full
   * treatment and the accounts involved.
   *
   * Requires the asset's own fixedAssetAccountId and
   * accumulatedDepreciationAccountId to already be configured
   * (set at creation) — those are asset-specific, not a
   * company-wide default, since different asset categories
   * legitimately post to different GL accounts. The gain/loss
   * account is company-wide (FinanceSettings) and is only required
   * when this disposal actually produces a nonzero gain or loss.
   */
  async dispose(companyId: string, actorUserId: string, id: string, dto: DisposeFixedAssetDto) {
    const asset = await this.findOne(companyId, id);
    if (asset.status === 'disposed') {
      throw new UnprocessableEntityException('This asset is already marked as disposed.');
    }
    if (!asset.fixedAssetAccountId || !asset.accumulatedDepreciationAccountId) {
      throw new UnprocessableEntityException(
        'This asset has no fixedAssetAccountId / accumulatedDepreciationAccountId configured — required before it can be disposed.',
      );
    }

    const disposalDate = new Date(dto.disposalDate);
    await this.periodLock.assertDateNotLocked(companyId, disposalDate);

    const proceeds = new Decimal(dto.disposalProceeds ?? 0);
    const purchaseCost = new Decimal(asset.purchaseCost);
    const accumulatedDepreciation = new Decimal(asset.accumulatedDepreciation);
    const netBookValue = purchaseCost.sub(accumulatedDepreciation);
    const gainOrLoss = proceeds.sub(netBookValue).toDecimalPlaces(MONEY_DP);

    const settings = await this.prisma.financeSettings.findUnique({ where: { companyId } });
    if (proceeds.gt(0) && !settings?.defaultCashAccountId) {
      throw new UnprocessableEntityException('Finance Settings must have a default Cash account configured to record disposal proceeds.');
    }
    if (!gainOrLoss.eq(0) && !settings?.defaultAssetDisposalGainLossAccountId) {
      throw new UnprocessableEntityException(
        `This disposal produces a ${gainOrLoss.gt(0) ? 'gain' : 'loss'} of ${gainOrLoss.abs().toString()} — Finance Settings must have a default Asset Disposal Gain/Loss account configured before this asset can be disposed.`,
      );
    }

    const lines: { accountId: string; debit: Prisma.Decimal | number; credit: Prisma.Decimal | number }[] = [
      { accountId: asset.fixedAssetAccountId, debit: 0, credit: purchaseCost },
    ];
    if (accumulatedDepreciation.gt(0)) {
      lines.push({ accountId: asset.accumulatedDepreciationAccountId, debit: accumulatedDepreciation, credit: 0 });
    }
    if (proceeds.gt(0)) {
      lines.push({ accountId: settings!.defaultCashAccountId!, debit: proceeds, credit: 0 });
    }
    if (gainOrLoss.gt(0)) {
      lines.push({ accountId: settings!.defaultAssetDisposalGainLossAccountId!, debit: 0, credit: gainOrLoss });
    } else if (gainOrLoss.lt(0)) {
      lines.push({ accountId: settings!.defaultAssetDisposalGainLossAccountId!, debit: gainOrLoss.abs(), credit: 0 });
    }
    JournalEntryValidator.assertBalanced(lines);

    return this.prisma.$transaction(async (tx) => {
      const entryNumber = await this.generateJournalEntryNumber(tx, companyId);
      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId,
          entryNumber,
          entryDate: disposalDate,
          reference: `Disposal — ${asset.assetNumber}`,
          description: `Disposal of ${asset.name} (${asset.assetNumber})`,
          status: 'posted',
          postedAt: new Date(),
          createdBy: actorUserId,
          lines: { create: lines.map((l, index) => ({ ...l, lineOrder: index })) },
        },
      });

      return tx.fixedAsset.update({
        where: { id },
        data: {
          status: 'disposed',
          disposedAt: new Date(),
          disposalProceeds: proceeds,
          disposalJournalEntryId: journalEntry.id,
        },
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

  /**
   * Only allowed before any depreciation has ever been posted
   * against this asset — once a depreciation entry exists, the
   * asset is part of real accounting history and must be disposed
   * (or simply left alone), never deleted outright.
   */
  async softDelete(companyId: string, id: string) {
    const asset = await this.findOne(companyId, id);
    if (new Decimal(asset.accumulatedDepreciation).gt(0)) {
      throw new UnprocessableEntityException(
        'This asset already has depreciation posted against it and cannot be deleted — dispose it instead.',
      );
    }
    return this.prisma.fixedAsset.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async generateAssetNumber(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `AST-${year}-`;
    const count = await tx.fixedAsset.count({ where: { companyId, assetNumber: { startsWith: prefix } } });
    let attempt = count + 1;
    for (let tries = 0; tries < 5; tries++) {
      const candidate = `${prefix}${String(attempt).padStart(4, '0')}`;
      const clash = await tx.fixedAsset.findFirst({ where: { companyId, assetNumber: candidate }, select: { id: true } });
      if (!clash) return candidate;
      attempt++;
    }
    throw new ConflictException('Could not generate a unique asset number, please retry.');
  }
}
