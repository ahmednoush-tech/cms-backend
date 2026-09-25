import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PaginationQueryDto, buildMeta } from '../../common/dto/pagination-query.dto';
import { AuthContext } from '../../common/interfaces/request-context.interface';
import { getScopedDepartmentIds } from '../../common/services/scope.util';

@Injectable()
export class EmployeesService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreateEmployeeDto) {
    if (dto.departmentId) {
      await this.assertDepartmentBelongsToCompany(companyId, dto.departmentId);
    }
    if (dto.managerId) {
      await this.assertEmployeeBelongsToCompany(companyId, dto.managerId);
    }
    if (dto.userId) {
      await this.assertUserAvailableForLinking(companyId, dto.userId);
    }

    try {
      const employee = await this.prisma.employee.create({
        data: {
          companyId,
          departmentId: dto.departmentId,
          userId: dto.userId,
          employeeNumber: dto.employeeNumber,
          firstName: dto.firstName,
          lastName: dto.lastName,
          jobTitle: dto.jobTitle,
          phone: dto.phone,
          email: dto.email,
          hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
          managerId: dto.managerId,
        },
      });

      await this.activityLog.record({
        companyId,
        userId: actorUserId,
        action: 'created',
        entityType: 'employee',
        entityId: employee.id,
        newValues: employee,
      });

      return employee;
    } catch (err) {
      throw this.translatePrismaError(err);
    }
  }

  async findAll(companyId: string, query: PaginationQueryDto, user: AuthContext, departmentId?: string) {
    const { page, pageSize, search, sortBy, sortDir } = query;

    // Scope enforcement: null means this user's grant for viewing
    // employees is unscoped (full access, exactly as before scoped
    // roles existed). A non-null array means every one of their
    // grants is scoped to specific departments — their effective
    // view is the INTERSECTION of that scope and whatever
    // departmentId they explicitly asked for, not a replacement of
    // it: asking for a department outside their scope must return
    // nothing, never silently fall back to their whole scope (that
    // would leak that other departments exist by giving different
    // results for "no matches" vs "not allowed").
    const scopedDepartmentIds = getScopedDepartmentIds(user, 'Administration:employees:view');
    let departmentFilter: Record<string, unknown> = {};
    if (scopedDepartmentIds !== null) {
      if (departmentId) {
        if (!scopedDepartmentIds.includes(departmentId)) {
          return { items: [], meta: buildMeta(page, pageSize, 0) };
        }
        departmentFilter = { departmentId };
      } else {
        departmentFilter = { departmentId: { in: scopedDepartmentIds } };
      }
    } else if (departmentId) {
      departmentFilter = { departmentId };
    }

    const where = {
      companyId,
      deletedAt: null,
      ...departmentFilter,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName: { contains: search, mode: 'insensitive' as const } },
              { employeeNumber: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy ?? 'createdAt']: sortDir },
        include: {
          department: { select: { id: true, name: true } },
          manager: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { items, meta: buildMeta(page, pageSize, total) };
  }

  async findOne(companyId: string, id: string, user: AuthContext, scopePermission = 'Administration:employees:view') {
    const employee = await this.prisma.employee.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
        user: { select: { id: true, email: true, status: true } },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found.');

    // Same NotFoundException as "doesn't exist" rather than a 403
    // — a scoped admin should not be able to tell the difference
    // between "no such employee" and "exists but outside your
    // department", which would otherwise leak which employee IDs
    // are real. scopePermission defaults to :view (the read case)
    // but update/delete/linkUser pass their OWN permission string,
    // since a user's edit-scope and view-scope need not match.
    const scopedDepartmentIds = getScopedDepartmentIds(user, scopePermission);
    if (scopedDepartmentIds !== null && !scopedDepartmentIds.includes(employee.departmentId ?? '')) {
      throw new NotFoundException('Employee not found.');
    }
    return employee;
  }

  async update(
    companyId: string,
    actorUserId: string,
    id: string,
    dto: UpdateEmployeeDto,
    user: AuthContext,
  ) {
    const before = await this.findOne(companyId, id, user, 'Administration:employees:edit');

    if (dto.departmentId) {
      await this.assertDepartmentBelongsToCompany(companyId, dto.departmentId);
    }
    if (dto.managerId) {
      if (dto.managerId === id) {
        throw new BadRequestException('An employee cannot manage themselves.');
      }
      await this.assertEmployeeBelongsToCompany(companyId, dto.managerId);
      await this.assertNoManagerCycle(companyId, id, dto.managerId);
    }

    const updated = await this.prisma.employee.update({
      where: { id },
      data: {
        ...dto,
        hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
        iqamaExpiryDate: dto.iqamaExpiryDate ? new Date(dto.iqamaExpiryDate) : undefined,
      },
    });

    const action = dto.status && dto.status !== before.status ? 'status_changed' : 'updated';

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action,
      entityType: 'employee',
      entityId: id,
      oldValues: before,
      newValues: updated,
    });

    return updated;
  }

  async softDelete(companyId: string, actorUserId: string, id: string, user: AuthContext) {
    const before = await this.findOne(companyId, id, user, 'Administration:employees:delete');

    const deleted = await this.prisma.employee.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'terminated' },
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'deleted',
      entityType: 'employee',
      entityId: id,
      oldValues: before,
    });

    return deleted;
  }

  /** Link an existing employee to an existing users row (grants system login). */
  async linkUser(companyId: string, actorUserId: string, employeeId: string, userId: string, user: AuthContext) {
    await this.findOne(companyId, employeeId, user, 'Administration:employees:edit');
    await this.assertUserAvailableForLinking(companyId, userId);

    try {
      const updated = await this.prisma.employee.update({
        where: { id: employeeId },
        data: { userId },
      });

      await this.activityLog.record({
        companyId,
        userId: actorUserId,
        action: 'linked_user',
        entityType: 'employee',
        entityId: employeeId,
        newValues: { userId },
      });

      return updated;
    } catch (err) {
      throw this.translatePrismaError(err);
    }
  }

  private async assertDepartmentBelongsToCompany(companyId: string, departmentId: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id: departmentId, companyId, deletedAt: null },
    });
    if (!dept) {
      throw new BadRequestException(
        'departmentId must reference an active department in the same company.',
      );
    }
  }

  private async assertEmployeeBelongsToCompany(companyId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
    });
    if (!employee) {
      throw new BadRequestException(
        'managerId must reference an active employee in the same company.',
      );
    }
  }

  /**
   * P2 FIX (V1 Final System Audit §2): direct self-management
   * (managerId === id) was already blocked. This closes the
   * broader gap — a longer chain (A manages B manages C manages
   * A) was previously undetected. Walks the proposed manager's
   * chain upward (manager's manager's manager...) and rejects if
   * the employee being updated appears anywhere in that chain.
   *
   * Bounded defensively: if a pre-existing cycle is encountered
   * that doesn't involve `employeeId` (shouldn't be possible if
   * this check has always run, but the codebase can't rule out
   * data seeded/imported outside the API), the walk stops rather
   * than looping forever, and does not itself throw — a cycle
   * unrelated to the change being made is not this operation's
   * responsibility to fix.
   */
  private async assertNoManagerCycle(companyId: string, employeeId: string, proposedManagerId: string) {
    let currentManagerId: string | null = proposedManagerId;
    const visited = new Set<string>();

    while (currentManagerId) {
      if (currentManagerId === employeeId) {
        throw new UnprocessableEntityException(
          'Assigning this manager would create a circular management chain.',
        );
      }
      if (visited.has(currentManagerId)) {
        break; // pre-existing cycle not involving employeeId — not this operation's concern
      }
      visited.add(currentManagerId);

      const manager: { managerId: string | null } | null = await this.prisma.employee.findFirst({
        where: { id: currentManagerId, companyId },
        select: { managerId: true },
      });
      currentManagerId = manager?.managerId ?? null;
    }
  }

  private async assertUserAvailableForLinking(companyId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId, deletedAt: null },
    });
    if (!user) {
      throw new BadRequestException('userId must reference an active user in the same company.');
    }
    const alreadyLinked = await this.prisma.employee.findUnique({ where: { userId } });
    if (alreadyLinked) {
      throw new ConflictException('This user is already linked to another employee.');
    }
  }

  /**
   * PUBLIC — reused by Operations (Phase 2D) for project-manager
   * assignment, project-member assignment, and work-order/task
   * assignment. Stricter than the private assertEmployeeBelongsToCompany
   * above (which only checks not-deleted): this additionally
   * requires status === 'active', since Operations assignment
   * rules explicitly require an active employee, not merely a
   * non-deleted one (an employee can be 'inactive' without being
   * soft-deleted).
   */
  async assertActiveEmployeeInCompany(companyId: string, employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
    });
    if (!employee) {
      throw new BadRequestException('Employee must belong to the same company.');
    }
    if (employee.status !== 'active') {
      throw new BadRequestException('Employee must be active to be assigned.');
    }
    return employee;
  }

  private translatePrismaError(err: unknown) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      const target = (err.meta?.target as string[] | undefined)?.join(', ');
      return new ConflictException(
        `A record with this ${target ?? 'value'} already exists.`,
      );
    }
    return err;
  }
}
