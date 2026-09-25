import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { ScopeValidationService } from '../../common/services/scope-validation.service';
import { COMPANY_WIDE_SCOPE_ID } from '../../common/constants/scope.constants';
import { CreateRoleDto } from './dto/create-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

@Injectable()
export class RolesService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
    private scopeValidation: ScopeValidationService,
  ) {}

  async create(companyId: string, dto: CreateRoleDto) {
    const existing = await this.prisma.role.findFirst({
      where: { companyId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException('A role with this name already exists.');
    }
    return this.prisma.role.create({
      data: { companyId, name: dto.name, description: dto.description },
    });
  }

  async findAll(companyId: string) {
    return this.prisma.role.findMany({
      where: { companyId },
      include: {
        rolePermissions: { include: { permission: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const role = await this.prisma.role.findFirst({
      where: { id, companyId },
      include: {
        rolePermissions: { include: { permission: true } },
        userRoles: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });
    if (!role) throw new NotFoundException('Role not found.');
    return role;
  }

  async assignPermissions(
    companyId: string,
    roleId: string,
    dto: AssignPermissionsDto,
    actorUserId: string,
  ) {
    await this.findOne(companyId, roleId); // 404 + tenant check

    await this.prisma.$transaction(
      dto.permissionIds.map((permissionId) =>
        this.prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId, permissionId } },
          create: { roleId, permissionId },
          update: {},
        }),
      ),
    );
    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'permissions_assigned',
      entityType: 'role',
      entityId: roleId,
      newValues: { permissionIds: dto.permissionIds },
    });
    return this.findOne(companyId, roleId);
  }

  /** List every atomic permission available to assign to roles. */
  async listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { resource: 'asc' }, { action: 'asc' }],
    });
  }

  async assignRoleToUser(companyId: string, dto: AssignRoleDto, actorUserId: string) {
    const [user, role, scope] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: dto.userId, companyId, deletedAt: null },
      }),
      this.prisma.role.findFirst({ where: { id: dto.roleId, companyId } }),
      this.scopeValidation.resolveScope(companyId, dto.scopeType, dto.scopeId),
    ]);
    if (!user) throw new NotFoundException('User not found.');
    if (!role) throw new NotFoundException('Role not found.');

    const result = await this.prisma.userRole.upsert({
      where: {
        userId_roleId_scopeId: { userId: dto.userId, roleId: dto.roleId, scopeId: scope.scopeId },
      },
      create: { userId: dto.userId, roleId: dto.roleId, scopeType: scope.scopeType, scopeId: scope.scopeId },
      update: {},
    });
    // Logged against the USER (not the role) — this is the event
    // that actually changes what that person can do, which is
    // what an audit trail needs to answer "why can this account
    // do X" for. entityId is deliberately the user's id even
    // though roleId also identifies which grant this was.
    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'role_assigned',
      entityType: 'user',
      entityId: dto.userId,
      newValues: { roleId: dto.roleId, roleName: role.name, scopeType: scope.scopeType, scopeId: scope.scopeId },
    });
    return result;
  }

  /**
   * scopeId identifies WHICH grant of this role to remove when the
   * user holds it more than once under different scopes (e.g. both
   * company-wide and scoped to one department) — omitting it
   * removes the unscoped (company-wide) grant, matching this
   * method's behavior before scoping existed.
   */
  async removeRoleFromUser(companyId: string, userId: string, roleId: string, actorUserId: string, scopeId?: string) {
    const role = await this.prisma.role.findFirst({
      where: { id: roleId, companyId },
    });
    if (!role) throw new NotFoundException('Role not found.');

    const resolvedScopeId = scopeId ?? COMPANY_WIDE_SCOPE_ID;
    const result = await this.prisma.userRole.delete({
      where: { userId_roleId_scopeId: { userId, roleId, scopeId: resolvedScopeId } },
    });
    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'role_removed',
      entityType: 'user',
      entityId: userId,
      oldValues: { roleId, roleName: role.name, scopeId: resolvedScopeId },
    });
    return result;
  }
}
