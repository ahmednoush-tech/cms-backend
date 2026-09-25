import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { ProjectsService } from './projects.service';
import { EmployeesService } from '../employees/employees.service';
import { AddProjectMemberDto, UpdateProjectMemberRoleDto } from './dto/project-member.dto';

@Injectable()
export class ProjectMembersService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
    private projectsService: ProjectsService,
    private employeesService: EmployeesService,
  ) {}

  async add(companyId: string, actorUserId: string, projectId: string, dto: AddProjectMemberDto) {
    await this.projectsService.assertProjectBelongsToCompany(companyId, projectId);
    await this.employeesService.assertActiveEmployeeInCompany(companyId, dto.employeeId);

    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_employeeId: { projectId, employeeId: dto.employeeId } },
    });
    if (existing) {
      throw new ConflictException('This employee is already a member of this project.');
    }

    let member;
    try {
      member = await this.prisma.projectMember.create({
        data: { projectId, employeeId: dto.employeeId, role: dto.role },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('This employee is already a member of this project.');
      }
      throw err;
    }

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'member_added',
      entityType: 'project',
      entityId: projectId,
      newValues: member,
    });

    return member;
  }

  async findAll(companyId: string, projectId: string) {
    await this.projectsService.assertProjectBelongsToCompany(companyId, projectId);
    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: { employee: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateRole(
    companyId: string,
    actorUserId: string,
    projectId: string,
    employeeId: string,
    dto: UpdateProjectMemberRoleDto,
  ) {
    await this.projectsService.assertProjectBelongsToCompany(companyId, projectId);
    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_employeeId: { projectId, employeeId } },
    });
    if (!existing) throw new NotFoundException('This employee is not a member of this project.');

    const updated = await this.prisma.projectMember.update({
      where: { projectId_employeeId: { projectId, employeeId } },
      data: { role: dto.role },
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'member_role_changed',
      entityType: 'project',
      entityId: projectId,
      oldValues: { employeeId, role: existing.role },
      newValues: { employeeId, role: updated.role },
    });

    return updated;
  }

  async remove(companyId: string, actorUserId: string, projectId: string, employeeId: string) {
    await this.projectsService.assertProjectBelongsToCompany(companyId, projectId);
    const existing = await this.prisma.projectMember.findUnique({
      where: { projectId_employeeId: { projectId, employeeId } },
    });
    if (!existing) throw new NotFoundException('This employee is not a member of this project.');

    await this.prisma.projectMember.delete({
      where: { projectId_employeeId: { projectId, employeeId } },
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'member_removed',
      entityType: 'project',
      entityId: projectId,
      oldValues: existing,
    });

    return { removed: true };
  }
}
