import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { ScopeValidationService } from '../../common/services/scope-validation.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { GrantPermissionDto } from './dto/grant-permission.dto';
import { COMPANY_WIDE_SCOPE_ID } from '../../common/constants/scope.constants';
import { PaginationQueryDto, buildMeta } from '../../common/dto/pagination-query.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private activityLog: ActivityLogService,
    private scopeValidation: ScopeValidationService,
  ) {}

  /**
   * Every method here takes companyId explicitly, sourced only
   * from req.user.companyId (the CurrentUser decorator) at the
   * controller layer — never from a route param or query string.
   */

  async create(companyId: string, dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('A user with this email already exists.');
    }

    const passwordHash = await this.authService.hashPassword(dto.password);

    return this.prisma.user.create({
      data: {
        companyId,
        name: dto.name,
        email: dto.email,
        passwordHash,
        phone: dto.phone,
      },
      select: this.safeSelect(),
    });
  }

  async findAll(companyId: string, query: PaginationQueryDto) {
    const { page, pageSize, search, sortBy, sortDir } = query;
    const where = {
      companyId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: this.safeSelect(),
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy ?? 'createdAt']: sortDir },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, meta: buildMeta(page, pageSize, total) };
  }

  async findOne(companyId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, companyId, deletedAt: null },
      select: {
        ...this.safeSelect(),
        userRoles: { include: { role: { select: { id: true, name: true } } } },
        userPermissions: { include: { permission: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found.');
    return user;
  }

  async update(companyId: string, id: string, dto: UpdateUserDto) {
    await this.findOne(companyId, id); // 404 + tenant check
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: this.safeSelect(),
    });
  }

  /**
   * Admin-initiated password set — deliberately separate from
   * `update()` (UpdateUserDto has no password field at all, by
   * design) so it's impossible to accidentally slip a password
   * change through a generic PATCH. Requires the
   * Administration:users:edit permission, same as every other
   * admin user-management write action.
   */
  async setPassword(companyId: string, id: string, newPassword: string) {
    await this.findOne(companyId, id); // 404 + tenant check
    const passwordHash = await this.authService.hashPassword(newPassword);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    return { message: 'Password updated.' };
  }

  /**
   * actorUserId is who is PERFORMING the deletion (from the JWT,
   * never trust a client-supplied value) — deleting your own
   * account is blocked outright, since it would end the request's
   * own session with no way back in short of another admin's
   * intervention. This does NOT check whether `id` is the last
   * remaining active user in the company; a company that deletes
   * every other user's account can still end up with just the
   * actor left, able to keep deleting everyone else but never
   * themselves — a real, disclosed gap, not a false guarantee.
   */
  async softDelete(companyId: string, actorUserId: string, id: string) {
    if (id === actorUserId) {
      throw new UnprocessableEntityException('You cannot delete your own account.');
    }
    await this.findOne(companyId, id);
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: this.safeSelect(),
    });
  }

  /**
   * Grants a single permission directly to this user — a
   * "permission set" style exception that needs neither creating
   * nor editing a role. Gated by Administration:user_permissions:manage
   * specifically (see migration 109's comment on why this is
   * deliberately a separate, bigger-sounding permission than
   * Administration:roles:manage): handing someone the power to
   * grant ANY single permission directly is a meaningfully larger
   * capability than assigning a pre-defined role.
   */
  async grantPermission(companyId: string, userId: string, dto: GrantPermissionDto, actorUserId: string) {
    const [user, permission, scope] = await Promise.all([
      this.prisma.user.findFirst({ where: { id: userId, companyId, deletedAt: null } }),
      this.prisma.permission.findFirst({ where: { id: dto.permissionId } }),
      this.scopeValidation.resolveScope(companyId, dto.scopeType, dto.scopeId),
    ]);
    if (!user) throw new NotFoundException('User not found.');
    if (!permission) throw new NotFoundException('Permission not found.');

    const result = await this.prisma.userPermission.upsert({
      where: {
        userId_permissionId_scopeId: { userId, permissionId: dto.permissionId, scopeId: scope.scopeId },
      },
      create: { userId, permissionId: dto.permissionId, scopeType: scope.scopeType, scopeId: scope.scopeId },
      update: {},
    });
    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'permission_granted',
      entityType: 'user',
      entityId: userId,
      newValues: {
        permissionId: dto.permissionId,
        permissionString: `${permission.module}:${permission.resource}:${permission.action}`,
        scopeType: scope.scopeType,
        scopeId: scope.scopeId,
      },
    });
    return result;
  }

  /**
   * scopeId identifies WHICH grant of this permission to revoke
   * when the user holds it more than once under different scopes
   * — omitting it revokes the unscoped (company-wide) grant.
   */
  async revokePermission(companyId: string, userId: string, permissionId: string, actorUserId: string, scopeId?: string) {
    const permission = await this.prisma.permission.findFirst({ where: { id: permissionId } });
    if (!permission) throw new NotFoundException('Permission not found.');

    const resolvedScopeId = scopeId ?? COMPANY_WIDE_SCOPE_ID;
    const result = await this.prisma.userPermission.delete({
      where: { userId_permissionId_scopeId: { userId, permissionId, scopeId: resolvedScopeId } },
    });
    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'permission_revoked',
      entityType: 'user',
      entityId: userId,
      oldValues: {
        permissionId,
        permissionString: `${permission.module}:${permission.resource}:${permission.action}`,
        scopeId: resolvedScopeId,
      },
    });
    return result;
  }

  private safeSelect() {
    // Never select passwordHash back out to the client.
    return {
      id: true,
      companyId: true,
      name: true,
      email: true,
      phone: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    };
  }
}
