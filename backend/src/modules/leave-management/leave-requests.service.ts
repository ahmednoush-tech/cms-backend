import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeaveRequestDto, RejectLeaveRequestDto } from './dto/leave-request.dto';
import { countWorkingDays, resolveEffectiveWorkingDays } from './working-days.util';

/**
 * Balance is deducted ONLY on approve() — never at create() time.
 * A pending or rejected request must never touch a balance; only
 * an APPROVED request represents leave actually granted.
 *
 * OVERLAP CHECK: a new request is rejected if it overlaps any of
 * the SAME employee's existing pending or approved requests (of
 * any leave type) — you cannot request two leaves for the same
 * day twice, whether the earlier one is still pending review or
 * already approved. A rejected or cancelled request never blocks
 * a new one for the same dates.
 */
@Injectable()
export class LeaveRequestsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string, filters: { employeeId?: string; status?: string }) {
    return this.prisma.leaveRequest.findMany({
      where: {
        companyId,
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      include: { leaveType: true, employee: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: { id, companyId },
      include: { leaveType: true, employee: true },
    });
    if (!request) throw new NotFoundException('Leave request not found.');
    return request;
  }

  async create(companyId: string, employeeId: string, dto: CreateLeaveRequestDto) {
    const leaveType = await this.prisma.leaveType.findFirst({ where: { id: dto.leaveTypeId, companyId, deletedAt: null } });
    if (!leaveType) throw new NotFoundException('Leave type not found.');

    const employee = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId, deletedAt: null } });
    if (!employee) throw new NotFoundException('Employee not found.');

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('endDate must not be before startDate.');
    }

    const overlapping = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: { in: ['pending', 'approved'] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });
    if (overlapping) {
      throw new UnprocessableEntityException('This employee already has a pending or approved leave request overlapping these dates.');
    }

    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { defaultWorkingDays: true } });
    if (!company) throw new NotFoundException('Company not found.');
    const effectiveWorkingDays = resolveEffectiveWorkingDays(employee.workingDaysOverride, company.defaultWorkingDays);
    const daysRequested = countWorkingDays(startDate, endDate, effectiveWorkingDays);

    if (leaveType.requiresBalance) {
      const year = startDate.getFullYear();
      const balance = await this.prisma.leaveBalance.findUnique({
        where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: dto.leaveTypeId, year } },
      });
      const remaining = balance ? Number(balance.allocatedDays) - Number(balance.usedDays) : 0;
      if (daysRequested > remaining) {
        throw new UnprocessableEntityException(
          `Insufficient "${leaveType.name}" balance for ${year}: ${remaining} day(s) remaining, ${daysRequested} requested.`,
        );
      }
    }

    return this.prisma.leaveRequest.create({
      data: {
        companyId,
        employeeId,
        leaveTypeId: dto.leaveTypeId,
        startDate,
        endDate,
        daysRequested,
        reason: dto.reason,
        status: 'pending',
      },
      include: { leaveType: true },
    });
  }

  private async assertPending(companyId: string, id: string) {
    const request = await this.prisma.leaveRequest.findFirst({ where: { id, companyId }, include: { leaveType: true } });
    if (!request) throw new NotFoundException('Leave request not found.');
    if (request.status !== 'pending') {
      throw new UnprocessableEntityException(`This request is already ${request.status} — only a pending request can be changed.`);
    }
    return request;
  }

  /**
   * Re-validates the balance INSIDE this transaction before
   * deducting — not just trusting the check already done at
   * create() time. Time has passed since the request was
   * submitted, and other requests for the same employee/type/year
   * may have been approved in between; approving without
   * re-checking here could silently push usedDays past
   * allocatedDays.
   */
  async approve(companyId: string, actorUserId: string, id: string) {
    const request = await this.assertPending(companyId, id);

    return this.prisma.$transaction(async (tx) => {
      if (request.leaveType.requiresBalance) {
        const year = request.startDate.getFullYear();
        const balance = await tx.leaveBalance.findUnique({
          where: { employeeId_leaveTypeId_year: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, year } },
        });
        const remaining = balance ? Number(balance.allocatedDays) - Number(balance.usedDays) : 0;
        if (Number(request.daysRequested) > remaining) {
          throw new UnprocessableEntityException(
            `Cannot approve — only ${remaining} day(s) remain for "${request.leaveType.name}" in ${year} (request needs ${request.daysRequested}).`,
          );
        }
        // upsert: a balance row might not exist yet if HR never
        // explicitly allocated one — but the check above already
        // guarantees remaining (0, if no row) >= daysRequested,
        // meaning daysRequested must also be 0 in that case, so
        // this upsert never actually pushes an implicit-zero
        // allocation negative.
        await tx.leaveBalance.upsert({
          where: { employeeId_leaveTypeId_year: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, year } },
          create: { companyId, employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, year, allocatedDays: 0, usedDays: request.daysRequested },
          update: { usedDays: { increment: request.daysRequested } },
        });
      }

      return tx.leaveRequest.update({
        where: { id },
        data: { status: 'approved', approvedBy: actorUserId, approvedAt: new Date() },
      });
    });
  }

  async reject(companyId: string, actorUserId: string, id: string, dto: RejectLeaveRequestDto) {
    await this.assertPending(companyId, id);
    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: 'rejected', approvedBy: actorUserId, approvedAt: new Date(), rejectionReason: dto.rejectionReason },
    });
  }

  /**
   * Only a PENDING request can be cancelled through this method —
   * withdrawing an already-approved leave (which would need to
   * reverse a balance deduction) is a deliberately separate,
   * not-yet-built capability.
   *
   * expectedEmployeeId is a DATA-INTEGRITY check, not an identity
   * check — this system has no employee self-service login (see
   * LeaveRequestsController's top comment), so staff act on behalf
   * of any employee under HR:leave_requests:create. This guards
   * against cancelling the wrong employee's request via a
   * mismatched URL (e.g. .../employee/A/.../cancel accidentally
   * pointed at a request that actually belongs to employee B),
   * not against a different employee cancelling "someone else's"
   * request — there is no per-employee identity to check against
   * in this version.
   */
  async cancel(companyId: string, id: string, expectedEmployeeId: string) {
    const request = await this.assertPending(companyId, id);
    if (request.employeeId !== expectedEmployeeId) {
      throw new BadRequestException('This leave request does not belong to the specified employee.');
    }
    return this.prisma.leaveRequest.update({ where: { id }, data: { status: 'cancelled' } });
  }
}
