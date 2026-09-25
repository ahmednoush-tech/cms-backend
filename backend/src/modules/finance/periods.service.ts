import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePeriodDto } from './dto/create-period.dto';

@Injectable()
export class PeriodsService {
  constructor(private prisma: PrismaService) {}

  async create(companyId: string, dto: CreatePeriodDto) {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('endDate must not be before startDate.');
    }

    // Application-level overlap check — not a DB exclusion
    // constraint (more complex to express portably), but exactly
    // as effective for this use case: two periods for the same
    // company covering the same date would make "which period is
    // this entry's date in" ambiguous.
    const overlapping = await this.prisma.accountingPeriod.findFirst({
      where: {
        companyId,
        OR: [{ startDate: { lte: endDate }, endDate: { gte: startDate } }],
      },
    });
    if (overlapping) {
      throw new UnprocessableEntityException(
        `This date range overlaps with an existing period: "${overlapping.name}".`,
      );
    }

    return this.prisma.accountingPeriod.create({
      data: { companyId, name: dto.name, startDate, endDate },
    });
  }

  async findAll(companyId: string) {
    return this.prisma.accountingPeriod.findMany({
      where: { companyId },
      orderBy: { startDate: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const period = await this.prisma.accountingPeriod.findFirst({ where: { id, companyId } });
    if (!period) throw new NotFoundException('Accounting period not found.');
    return period;
  }

  async lock(companyId: string, actorUserId: string, id: string) {
    const period = await this.findOne(companyId, id);
    if (period.status === 'locked') {
      throw new UnprocessableEntityException('This period is already locked.');
    }
    return this.prisma.accountingPeriod.update({
      where: { id },
      data: { status: 'locked', lockedAt: new Date(), lockedBy: actorUserId },
    });
  }

  /**
   * Deliberately a separate, distinctly-named action from lock()
   * rather than a generic "toggle status" — unlocking a closed
   * period is an exceptional, audit-worthy action (it reopens the
   * possibility of altering historical financial data), and should
   * always require the caller to explicitly say "unlock", never be
   * reachable via the same button/endpoint as locking.
   */
  async unlock(companyId: string, id: string) {
    const period = await this.findOne(companyId, id);
    if (period.status !== 'locked') {
      throw new UnprocessableEntityException('This period is not locked.');
    }
    return this.prisma.accountingPeriod.update({
      where: { id },
      data: { status: 'open', lockedAt: null, lockedBy: null },
    });
  }
}
