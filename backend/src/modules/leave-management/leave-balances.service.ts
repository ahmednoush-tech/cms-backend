import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SetLeaveBalanceDto } from './dto/set-leave-balance.dto';

@Injectable()
export class LeaveBalancesService {
  constructor(private prisma: PrismaService) {}

  async listForEmployee(companyId: string, employeeId: string, year: number) {
    return this.prisma.leaveBalance.findMany({
      where: { companyId, employeeId, year },
      include: { leaveType: true },
    });
  }

  /**
   * Upsert — HR sets (or corrects) the allocation for a given
   * employee/type/year. Never touches usedDays: that field is
   * ONLY ever incremented by LeaveRequestsService.approve(),
   * regardless of how many times HR re-sets the allocation.
   */
  async setAllocation(companyId: string, dto: SetLeaveBalanceDto) {
    const leaveType = await this.prisma.leaveType.findFirst({ where: { id: dto.leaveTypeId, companyId, deletedAt: null } });
    if (!leaveType) throw new NotFoundException('Leave type not found.');
    if (!leaveType.requiresBalance) {
      throw new UnprocessableEntityException(`"${leaveType.name}" does not track a balance — there is nothing to allocate.`);
    }

    const employee = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId, deletedAt: null } });
    if (!employee) throw new NotFoundException('Employee not found.');

    return this.prisma.leaveBalance.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId: dto.employeeId, leaveTypeId: dto.leaveTypeId, year: dto.year } },
      create: { companyId, employeeId: dto.employeeId, leaveTypeId: dto.leaveTypeId, year: dto.year, allocatedDays: dto.allocatedDays },
      update: { allocatedDays: dto.allocatedDays },
    });
  }
}
