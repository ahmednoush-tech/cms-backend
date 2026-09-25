import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { PaginationQueryDto, buildMeta } from '../../common/dto/pagination-query.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreateDepartmentDto) {
    if (dto.managerId) {
      await this.assertManagerBelongsToCompany(companyId, dto.managerId);
    }

    const department = await this.prisma.department.create({
      data: {
        companyId,
        name: dto.name,
        description: dto.description,
        managerId: dto.managerId,
      },
    });

    // NOTE: activity_logs.entity_type is CHECK-constrained (migration
    // 018) to: customer, lead, opportunity, quotation, project,
    // work_order, task, employee, user, role. 'department' is not in
    // that list, so department mutations are intentionally NOT
    // written to activity_logs here rather than mislabeling them
    // under a different entity type. Flagging for your decision:
    // either add 'department' to the CHECK list in a follow-up
    // migration, or confirm department changes don't need auditing
    // for V1. No schema change made without your approval.

    return department;
  }

  async findAll(companyId: string, query: PaginationQueryDto) {
    const { page, pageSize, search, sortBy, sortDir } = query;
    const where = {
      companyId,
      deletedAt: null,
      ...(search
        ? { name: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.department.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy ?? 'createdAt']: sortDir },
        include: { manager: { select: { id: true, firstName: true, lastName: true } } },
      }),
      this.prisma.department.count({ where }),
    ]);

    return { items, meta: buildMeta(page, pageSize, total) };
  }

  async findOne(companyId: string, id: string) {
    const department = await this.prisma.department.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { manager: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!department) throw new NotFoundException('Department not found.');
    return department;
  }

  async update(
    companyId: string,
    actorUserId: string,
    id: string,
    dto: UpdateDepartmentDto,
  ) {
    const before = await this.findOne(companyId, id);
    if (dto.managerId) {
      await this.assertManagerBelongsToCompany(companyId, dto.managerId);
    }

    const updated = await this.prisma.department.update({
      where: { id },
      data: dto,
    });

    // See note in create() re: 'department' not being a supported
    // activity_logs.entity_type value under the approved schema.

    return updated;
  }

  async softDelete(companyId: string, actorUserId: string, id: string) {
    const before = await this.findOne(companyId, id);

    const activeEmployeeCount = await this.prisma.employee.count({
      where: { companyId, departmentId: id, deletedAt: null },
    });
    if (activeEmployeeCount > 0) {
      throw new UnprocessableEntityException(
        'Cannot delete a department that still has active employees assigned.',
      );
    }

    const deleted = await this.prisma.department.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // See note in create() re: 'department' not being a supported
    // activity_logs.entity_type value under the approved schema.

    return deleted;
  }

  private async assertManagerBelongsToCompany(companyId: string, managerId: string) {
    const manager = await this.prisma.employee.findFirst({
      where: { id: managerId, companyId, deletedAt: null },
    });
    if (!manager) {
      throw new BadRequestException(
        'managerId must reference an active employee in the same company.',
      );
    }
  }
}
