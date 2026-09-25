import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalEntryValidator } from '../../common/services/journal-entry-validator';
import { PeriodLockService } from '../finance/period-lock.service';
import { CreateDepreciationRunDto } from './dto/create-depreciation-run.dto';

const { Decimal } = Prisma;
const MONEY_DP = 2;

@Injectable()
export class DepreciationRunsService {
  constructor(
    private prisma: PrismaService,
    private periodLock: PeriodLockService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreateDepreciationRunDto) {
    const existing = await this.prisma.depreciationRun.findUnique({
      where: { companyId_month_year: { companyId, month: dto.month, year: dto.year } },
    });
    if (existing) {
      throw new UnprocessableEntityException(`A depreciation run for ${dto.month}/${dto.year} already exists.`);
    }

    const periodEndDate = new Date(dto.year, dto.month, 0);

    const assets = await this.prisma.fixedAsset.findMany({
      where: { companyId, status: 'active', deletedAt: null, purchaseDate: { lte: periodEndDate } },
    });

    const skipped: string[] = [];
    const expenseByAccount = new Map<string, Prisma.Decimal>();
    const accumByAccount = new Map<string, Prisma.Decimal>();
    const entryData: Array<{ fixedAssetId: string; depreciationAmount: Prisma.Decimal; newAccumulated: Prisma.Decimal; newNetBookValue: Prisma.Decimal; fullyDepreciated: boolean }> = [];

    for (const asset of assets) {
      if (!asset.fixedAssetAccountId || !asset.accumulatedDepreciationAccountId || !asset.depreciationExpenseAccountId) {
        skipped.push(`${asset.assetNumber} — ${asset.name} (accounts not fully configured)`);
        continue;
      }

      const depreciableBase = new Decimal(asset.purchaseCost).sub(asset.salvageValue);
      const currentAccumulated = new Decimal(asset.accumulatedDepreciation);
      const remaining = depreciableBase.sub(currentAccumulated);

      if (remaining.lte(0)) {
        continue;
      }

      const straightLineMonthly = depreciableBase.div(asset.usefulLifeMonths).toDecimalPlaces(MONEY_DP);
      const depreciationAmount = Decimal.min(straightLineMonthly, remaining).toDecimalPlaces(MONEY_DP);
      const newAccumulated = currentAccumulated.add(depreciationAmount).toDecimalPlaces(MONEY_DP);
      const newNetBookValue = new Decimal(asset.purchaseCost).sub(newAccumulated).toDecimalPlaces(MONEY_DP);

      expenseByAccount.set(
        asset.depreciationExpenseAccountId,
        (expenseByAccount.get(asset.depreciationExpenseAccountId) ?? new Decimal(0)).add(depreciationAmount),
      );
      accumByAccount.set(
        asset.accumulatedDepreciationAccountId,
        (accumByAccount.get(asset.accumulatedDepreciationAccountId) ?? new Decimal(0)).add(depreciationAmount),
      );

      entryData.push({
        fixedAssetId: asset.id,
        depreciationAmount,
        newAccumulated,
        newNetBookValue,
        fullyDepreciated: newAccumulated.gte(depreciableBase),
      });
    }

    if (entryData.length === 0) {
      throw new UnprocessableEntityException(
        'No eligible assets to depreciate for this period — every active asset is either already fully depreciated or missing its account configuration.',
      );
    }

    await this.periodLock.assertDateNotLocked(companyId, periodEndDate);

    const lines = [
      ...Array.from(expenseByAccount.entries()).map(([accountId, amount]) => ({ accountId, debit: amount, credit: 0 })),
      ...Array.from(accumByAccount.entries()).map(([accountId, amount]) => ({ accountId, debit: 0, credit: amount })),
    ];
    JournalEntryValidator.assertBalanced(lines);

    const totalDepreciation = entryData.reduce((sum, e) => sum.add(e.depreciationAmount), new Decimal(0)).toDecimalPlaces(MONEY_DP);

    const run = await this.prisma.$transaction(async (tx) => {
      const entryNumber = await this.generateJournalEntryNumber(tx, companyId);
      const journalEntry = await tx.journalEntry.create({
        data: {
          companyId,
          entryNumber,
          entryDate: periodEndDate,
          reference: `Depreciation ${dto.month}/${dto.year}`,
          description: `Depreciation run for ${dto.month}/${dto.year}`,
          status: 'posted',
          postedAt: new Date(),
          createdBy: actorUserId,
          lines: { create: lines.map((l, index) => ({ ...l, lineOrder: index })) },
        },
      });

      const created = await tx.depreciationRun.create({
        data: {
          companyId,
          month: dto.month,
          year: dto.year,
          totalDepreciation,
          journalEntryId: journalEntry.id,
          createdBy: actorUserId,
          entries: {
            create: entryData.map((e) => ({
              fixedAssetId: e.fixedAssetId,
              depreciationAmount: e.depreciationAmount,
              accumulatedDepreciationAfter: e.newAccumulated,
              netBookValueAfter: e.newNetBookValue,
            })),
          },
        },
        include: { entries: { include: { fixedAsset: true } } },
      });

      for (const e of entryData) {
        await tx.fixedAsset.update({
          where: { id: e.fixedAssetId },
          data: {
            accumulatedDepreciation: e.newAccumulated,
            status: e.fullyDepreciated ? 'fully_depreciated' : undefined,
          },
        });
      }

      return created;
    });

    return { ...run, skippedAssets: skipped };
  }

  async findAll(companyId: string) {
    return this.prisma.depreciationRun.findMany({ where: { companyId }, orderBy: [{ year: 'desc' }, { month: 'desc' }] });
  }

  async findOne(companyId: string, id: string) {
    const run = await this.prisma.depreciationRun.findFirst({
      where: { id, companyId },
      include: { entries: { include: { fixedAsset: true }, orderBy: { createdAt: 'asc' } } },
    });
    if (!run) throw new NotFoundException('Depreciation run not found.');
    return run;
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
