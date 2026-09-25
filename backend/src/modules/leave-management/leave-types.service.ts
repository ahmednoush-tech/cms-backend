import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeaveTypeDto, UpdateLeaveTypeDto } from './dto/leave-type.dto';

@Injectable()
export class LeaveTypesService {
  constructor(private prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.leaveType.findMany({ where: { companyId, deletedAt: null }, orderBy: { name: 'asc' } });
  }

  async findOne(companyId: string, id: string) {
    const type = await this.prisma.leaveType.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!type) throw new NotFoundException('Leave type not found.');
    return type;
  }

  create(companyId: string, dto: CreateLeaveTypeDto) {
    return this.prisma.leaveType.create({
      data: {
        companyId,
        name: dto.name,
        requiresBalance: dto.requiresBalance ?? true,
        isPaid: dto.isPaid ?? true,
      },
    });
  }

  async update(companyId: string, id: string, dto: UpdateLeaveTypeDto) {
    await this.findOne(companyId, id);
    return this.prisma.leaveType.update({ where: { id }, data: dto });
  }

  /**
   * Soft-delete only — a leave type that has ever had a request or
   * balance against it must never be hard-deleted (that history is
   * a real HR record). Deactivating it just stops it from being
   * offered for NEW requests.
   */
  async deactivate(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.leaveType.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
