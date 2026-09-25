import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Called from every code path that creates a POSTED journal entry:
 * JournalEntriesService.create()/update(), InvoicesService.issue(),
 * BillsService.receive(), PaymentsService.create(),
 * BillPaymentsService.create(). This is the actual mechanism that
 * makes "closing a period" mean something — without this check
 * being called everywhere an entry can be posted, locking a period
 * would be purely cosmetic.
 */
@Injectable()
export class PeriodLockService {
  constructor(private prisma: PrismaService) {}

  async assertDateNotLocked(companyId: string, date: Date): Promise<void> {
    const lockedPeriod = await this.prisma.accountingPeriod.findFirst({
      where: {
        companyId,
        status: 'locked',
        startDate: { lte: date },
        endDate: { gte: date },
      },
    });

    if (lockedPeriod) {
      const start = lockedPeriod.startDate.toISOString().slice(0, 10);
      const end = lockedPeriod.endDate.toISOString().slice(0, 10);
      throw new UnprocessableEntityException(
        `Cannot post an entry dated ${date.toISOString().slice(0, 10)} — it falls within the locked accounting period "${lockedPeriod.name}" (${start} to ${end}). Unlock the period first if this entry is truly needed.`,
      );
    }
  }
}
