import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { JournalEntryValidator } from '../../common/services/journal-entry-validator';
import { PeriodLockService } from './period-lock.service';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { UpdateJournalEntryDto } from './dto/update-journal-entry.dto';
import { PaginationQueryDto, buildMeta } from '../../common/dto/pagination-query.dto';

@Injectable()
export class JournalEntriesService {
  constructor(
    private prisma: PrismaService,
    private periodLock: PeriodLockService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreateJournalEntryDto) {
    JournalEntryValidator.assertBalanced(dto.lines.map((l) => ({ ...l, debit: l.debit ?? 0, credit: l.credit ?? 0 })));
    await this.assertAccountsBelongToCompany(companyId, dto.lines.map((l) => l.accountId));

    return this.prisma.$transaction(async (tx) => {
      const entryNumber = await this.generateEntryNumber(tx, companyId);
      return tx.journalEntry.create({
        data: {
          companyId,
          entryNumber,
          entryDate: new Date(dto.entryDate),
          reference: dto.reference,
          description: dto.description,
          createdBy: actorUserId,
          status: 'draft',
          lines: {
            create: dto.lines.map((line, index) => ({
              accountId: line.accountId,
              debit: line.debit ?? 0,
              credit: line.credit ?? 0,
              description: line.description,
              lineOrder: index,
            })),
          },
        },
        include: { lines: true },
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
              { entryNumber: { contains: search, mode: 'insensitive' as const } },
              { reference: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.journalEntry.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy ?? 'entryDate']: sortDir ?? 'desc' },
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return { items, meta: buildMeta(page, pageSize, total) };
  }

  async findOne(companyId: string, id: string) {
    const entry = await this.prisma.journalEntry.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { lines: { include: { account: true }, orderBy: { lineOrder: 'asc' } } },
    });
    if (!entry) throw new NotFoundException('Journal entry not found.');
    return entry;
  }

  async update(companyId: string, id: string, dto: UpdateJournalEntryDto) {
    const before = await this.findOne(companyId, id);
    this.assertDraft(before);

    if (dto.lines) {
      JournalEntryValidator.assertBalanced(dto.lines.map((l) => ({ ...l, debit: l.debit ?? 0, credit: l.credit ?? 0 })));
      await this.assertAccountsBelongToCompany(companyId, dto.lines.map((l) => l.accountId));
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.journalEntryLine.deleteMany({ where: { journalEntryId: id } });
      }
      return tx.journalEntry.update({
        where: { id },
        data: {
          entryDate: dto.entryDate ? new Date(dto.entryDate) : undefined,
          reference: dto.reference,
          description: dto.description,
          ...(dto.lines
            ? {
                lines: {
                  create: dto.lines.map((line, index) => ({
                    accountId: line.accountId,
                    debit: line.debit ?? 0,
                    credit: line.credit ?? 0,
                    description: line.description,
                    lineOrder: index,
                  })),
                },
              }
            : {}),
        },
        include: { lines: true },
      });
    });
  }

  /**
   * Posting is the point of no return: a posted entry becomes
   * immutable (see assertDraft() gating update()/softDelete()) —
   * to correct a posted entry, you post a new REVERSING entry, you
   * never edit history. This is standard accounting-software
   * practice, not a V1 shortcut.
   */
  async post(companyId: string, id: string) {
    const entry = await this.findOne(companyId, id);
    this.assertDraft(entry);
    await this.periodLock.assertDateNotLocked(companyId, entry.entryDate);

    return this.prisma.journalEntry.update({
      where: { id },
      data: { status: 'posted', postedAt: new Date() },
    });
  }

  /**
   * Voiding a POSTED entry doesn't delete or unbalance the ledger
   * — it just marks the entry as void so reports can exclude it,
   * while preserving the full audit trail. Only posted entries can
   * be voided (a draft is simply deleted instead).
   */
  async void(companyId: string, id: string) {
    const entry = await this.findOne(companyId, id);
    if (entry.status !== 'posted') {
      throw new UnprocessableEntityException('Only a posted journal entry can be voided.');
    }
    return this.prisma.journalEntry.update({ where: { id }, data: { status: 'void' } });
  }

  async softDelete(companyId: string, id: string) {
    const entry = await this.findOne(companyId, id);
    this.assertDraft(entry);
    return this.prisma.journalEntry.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private assertDraft(entry: { status: string }) {
    if (entry.status !== 'draft') {
      throw new ForbiddenException('This journal entry has already been posted and can no longer be edited or deleted. Post a reversing entry instead.');
    }
  }

  private async assertAccountsBelongToCompany(companyId: string, accountIds: string[]) {
    const uniqueIds = Array.from(new Set(accountIds));
    const count = await this.prisma.account.count({
      where: { id: { in: uniqueIds }, companyId, deletedAt: null },
    });
    if (count !== uniqueIds.length) {
      throw new UnprocessableEntityException('One or more accountId values do not reference an active account in your company.');
    }
  }

  private async generateEntryNumber(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `JE-${year}-`;

    const count = await tx.journalEntry.count({
      where: { companyId, entryNumber: { startsWith: prefix } },
    });

    let attempt = count + 1;
    for (let tries = 0; tries < 5; tries++) {
      const candidate = `${prefix}${String(attempt).padStart(4, '0')}`;
      const clash = await tx.journalEntry.findFirst({
        where: { companyId, entryNumber: candidate },
        select: { id: true },
      });
      if (!clash) return candidate;
      attempt++;
    }
    throw new UnprocessableEntityException('Could not generate a unique journal entry number, please retry.');
  }
}
