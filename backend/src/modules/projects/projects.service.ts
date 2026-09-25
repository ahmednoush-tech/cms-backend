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
import {
  PROJECT_TERMINAL_STATES,
  PROJECT_TRANSITIONS,
  WorkflowTransitionValidator,
} from '../../common/services/workflow-transition.validator';
import { CustomersService } from '../customers/customers.service';
import { EmployeesService } from '../employees/employees.service';
import {
  AssignProjectManagerDto,
  CreateProjectDto,
  UpdateProjectDto,
  UpdateProjectStatusDto,
} from './dto/project.dto';
import { PaginationQueryDto, buildMeta } from '../../common/dto/pagination-query.dto';
import { ProjectFiltersDto } from './dto/project-filters.dto';
import { NotificationsService } from '../notifications/notifications.service';

const { Decimal } = Prisma;

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
    private customersService: CustomersService,
    private employeesService: EmployeesService,
    private notifications: NotificationsService,
  ) {}

  // ============================================================
  // CREATE
  // ============================================================

  async create(companyId: string, actorUserId: string, dto: CreateProjectDto) {
    await this.customersService.assertCustomerBelongsToCompany(companyId, dto.customerId);

    if (dto.opportunityId) {
      await this.assertOpportunityMatchesCustomer(companyId, dto.customerId, dto.opportunityId);
    }
    if (dto.quotationId) {
      await this.assertQuotationValidForProject(
        companyId,
        dto.customerId,
        dto.opportunityId,
        dto.quotationId,
      );
    }
    if (dto.projectManagerId) {
      await this.employeesService.assertActiveEmployeeInCompany(companyId, dto.projectManagerId);
    }

    const project = await this.prisma.$transaction(async (tx) => {
      if (dto.quotationId) {
        await this.assertQuotationNotAlreadyLinked(tx, dto.quotationId);
      }

      const projectNumber = await this.generateProjectNumber(tx, companyId);

      const created = await tx.project.create({
        data: {
          companyId,
          customerId: dto.customerId,
          opportunityId: dto.opportunityId,
          quotationId: dto.quotationId,
          projectNumber,
          name: dto.name,
          description: dto.description,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          projectManagerId: dto.projectManagerId,
          createdBy: actorUserId,
        },
      });

      if (dto.projectManagerId) {
        await this.ensureMembership(tx, created.id, dto.projectManagerId, 'manager');
      }

      return created;
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'created',
      entityType: 'project',
      entityId: project.id,
      newValues: project,
    });

    return this.findOne(companyId, project.id);
  }

  // ============================================================
  // READ
  // ============================================================

  async findAll(companyId: string, query: ProjectFiltersDto) {
    const { page, pageSize, search, sortBy, sortDir, customerId, status } = query;
    const where = {
      companyId,
      deletedAt: null,
      ...(customerId ? { customerId } : {}),
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { projectNumber: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy ?? 'createdAt']: sortDir },
      }),
      this.prisma.project.count({ where }),
    ]);

    return { items, meta: buildMeta(page, pageSize, total) };
  }

  async findOne(companyId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        customer: true,
        members: { include: { employee: true } },
        workOrders: { select: { id: true, status: true, workOrderNumber: true } },
        projectManager: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found.');
    return project;
  }

  /** Lightweight tenant check reused by WorkOrdersService/TasksService/ProjectMembersService — returns the raw row, no relations. */
  async assertProjectBelongsToCompany(companyId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!project) {
      throw new NotFoundException('Project not found.');
    }
    return project;
  }

  // ============================================================
  // UPDATE
  // ============================================================

  async update(companyId: string, actorUserId: string, id: string, dto: UpdateProjectDto) {
    const before = await this.findOne(companyId, id);
    this.assertNotTerminal(before);

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'updated',
      entityType: 'project',
      entityId: id,
      oldValues: before,
      newValues: updated,
    });

    return this.findOne(companyId, id);
  }

  async updateStatus(companyId: string, actorUserId: string, id: string, dto: UpdateProjectStatusDto) {
    const before = await this.findOne(companyId, id);

    WorkflowTransitionValidator.assertValidTransition(
      'project',
      PROJECT_TRANSITIONS,
      before.status,
      dto.status,
    );

    if (dto.status === 'completed') {
      await this.assertNoOpenWorkOrders(id);
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: { status: dto.status },
    });

    const action =
      dto.status === 'completed' ? 'completed' : dto.status === 'cancelled' ? 'cancelled' : 'status_changed';

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action,
      entityType: 'project',
      entityId: id,
      oldValues: { status: before.status },
      newValues: { status: dto.status },
    });

    if (dto.status === 'on_hold' || dto.status === 'cancelled' || dto.status === 'completed') {
      await this.notifyProjectManager(
        companyId,
        before,
        `project_${dto.status}`,
        `Project ${dto.status.replace('_', ' ')}`,
        `Project ${before.projectNumber} is now ${dto.status}.`,
      );
    }

    return this.findOne(companyId, id);
  }

  async assignManager(companyId: string, actorUserId: string, id: string, dto: AssignProjectManagerDto) {
    const before = await this.findOne(companyId, id);
    this.assertNotTerminal(before);
    await this.employeesService.assertActiveEmployeeInCompany(companyId, dto.employeeId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id },
        data: { projectManagerId: dto.employeeId },
      });
      await this.ensureMembership(tx, id, dto.employeeId, 'manager');
      return project;
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'manager_assigned',
      entityType: 'project',
      entityId: id,
      oldValues: { projectManagerId: before.projectManagerId },
      newValues: { projectManagerId: updated.projectManagerId },
    });

    return this.findOne(companyId, id);
  }

  async softDelete(companyId: string, actorUserId: string, id: string) {
    const before = await this.findOne(companyId, id);
    if (before.status !== 'planning') {
      throw new UnprocessableEntityException(
        'Only projects still in "planning" status can be deleted. Approved/active/completed/cancelled projects must be preserved as history.',
      );
    }

    const deleted = await this.prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'deleted',
      entityType: 'project',
      entityId: id,
      oldValues: before,
    });

    return deleted;
  }

  // ============================================================
  // Internals
  // ============================================================

  private assertNotTerminal(project: { status: string }) {
    if (PROJECT_TERMINAL_STATES.includes(project.status)) {
      throw new UnprocessableEntityException(
        `Project is in a terminal state ('${project.status}') and cannot be modified.`,
      );
    }
  }

  private async assertNoOpenWorkOrders(projectId: string) {
    const openCount = await this.prisma.workOrder.count({
      where: { projectId, status: { notIn: ['completed', 'cancelled'] } },
    });
    if (openCount > 0) {
      throw new UnprocessableEntityException(
        `Cannot complete this project — ${openCount} work order(s) are not yet completed or cancelled. ` +
          `Strict completion gating is enforced in V1 (no override).`,
      );
    }
  }

  private async assertOpportunityMatchesCustomer(companyId: string, customerId: string, opportunityId: string) {
    const opportunity = await this.prisma.opportunity.findFirst({
      where: { id: opportunityId, companyId, deletedAt: null },
    });
    if (!opportunity) {
      throw new BadRequestException('opportunityId must reference an active opportunity in the same company.');
    }
    if (opportunity.customerId !== customerId) {
      throw new BadRequestException('opportunityId must belong to the same customer as the project.');
    }
  }

  private async assertQuotationValidForProject(
    companyId: string,
    customerId: string,
    opportunityId: string | undefined,
    quotationId: string,
  ) {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id: quotationId, companyId, deletedAt: null },
    });
    if (!quotation) {
      throw new BadRequestException('quotationId must reference an active quotation in the same company.');
    }
    if (quotation.customerId !== customerId) {
      throw new BadRequestException('quotationId must belong to the same customer as the project.');
    }
    if (quotation.status !== 'accepted') {
      throw new BadRequestException(
        `quotationId must reference an accepted quotation (currently '${quotation.status}').`,
      );
    }
    if (opportunityId && quotation.opportunityId && quotation.opportunityId !== opportunityId) {
      throw new BadRequestException(
        'The supplied quotationId belongs to a different opportunity than the one supplied.',
      );
    }
  }

  /**
   * P2 FIX (V1 Final System Audit §9): an accepted quotation must
   * not be linked to more than one project. No schema constraint
   * enforces this (projects.quotation_id has no UNIQUE index, and
   * adding one is a schema change — out of scope per this phase's
   * instruction to avoid schema changes unless unavoidable). This
   * is therefore an application-level check, run INSIDE the same
   * transaction that creates the project (not before it opens) to
   * minimize — though, without a DB-level backstop, not fully
   * eliminate — the race window between two concurrent requests
   * both linking the same quotation. Flagged as a residual risk
   * in the Phase 2F report: a DB-level partial unique index
   * (`CREATE UNIQUE INDEX ... ON projects(quotation_id) WHERE
   * quotation_id IS NOT NULL AND deleted_at IS NULL`) would close
   * this completely, but was judged not "absolutely unavoidable"
   * for this pass — the application-level check inside the
   * transaction is the agreed-scope mitigation.
   */
  private async assertQuotationNotAlreadyLinked(tx: Prisma.TransactionClient, quotationId: string) {
    const existing = await tx.project.findFirst({
      where: { quotationId, deletedAt: null },
      select: { id: true, projectNumber: true },
    });
    if (existing) {
      throw new ConflictException(
        `This quotation is already linked to project ${existing.projectNumber}. ` +
          `An accepted quotation cannot be linked to more than one project.`,
      );
    }
  }

  /** Idempotent — creates the membership row only if it doesn't already exist. Used for PM auto-sync (never errors on duplicate). */
  private async ensureMembership(
    tx: Prisma.TransactionClient,
    projectId: string,
    employeeId: string,
    role: string,
  ) {
    const existing = await tx.projectMember.findUnique({
      where: { projectId_employeeId: { projectId, employeeId } },
    });
    if (existing) return existing;
    return tx.projectMember.create({ data: { projectId, employeeId, role } });
  }

  private async generateProjectNumber(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PRJ-${year}-`;

    const count = await tx.project.count({ where: { companyId, projectNumber: { startsWith: prefix } } });

    let attempt = count + 1;
    for (let tries = 0; tries < 5; tries++) {
      const candidate = `${prefix}${String(attempt).padStart(4, '0')}`;
      const clash = await tx.project.findFirst({
        where: { companyId, projectNumber: candidate },
        select: { id: true },
      });
      if (!clash) return candidate;
      attempt++;
    }
    throw new BadRequestException('Could not generate a unique project number — please retry.');
  }

  private async notifyProjectManager(
    companyId: string,
    project: { id: string; projectManagerId: string | null; projectNumber: string },
    type: string,
    title: string,
    message: string,
  ) {
    if (!project.projectManagerId) return;
    const manager = await this.prisma.employee.findUnique({
      where: { id: project.projectManagerId },
      select: { userId: true },
    });
    if (!manager?.userId) return;

    await this.notifications.create({
      companyId,
      userId: manager.userId,
      type,
      title,
      message,
      entityType: 'project',
      entityId: project.id,
    });
  }

  /**
   * Everything a Gantt chart needs for one project, in a single
   * call: the project's own date range (for the chart's overall
   * bounds) plus every task with its dates, status, assignee, and
   * the IDs of tasks it depends on (for drawing dependency
   * connector lines). The frontend renderer does the actual
   * layout — this endpoint is pure data assembly.
   */
  async getGanttData(companyId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId, deletedAt: null },
      select: { id: true, name: true, startDate: true, endDate: true },
    });
    if (!project) throw new NotFoundException('Project not found.');

    const tasks = await this.prisma.task.findMany({
      where: { projectId, companyId, deletedAt: null },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        startDate: true,
        dueDate: true,
        assignee: { select: { firstName: true, lastName: true } },
        dependencies: { select: { id: true, dependsOnTaskId: true } },
      },
      orderBy: { startDate: 'asc' },
    });

    return {
      project,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        startDate: t.startDate,
        dueDate: t.dueDate,
        assigneeName: t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : null,
        dependencies: t.dependencies.map((d) => ({ id: d.id, dependsOnTaskId: d.dependsOnTaskId })),
      })),
    };
  }

  /**
   * Budget-vs-actual and progress tracking for one project.
   *
   * "Actual cost" is LABOR COST ONLY (sum of TimeEntry.laborCost
   * for the project's tasks) — see migration 072's comment for
   * why: neither Bill nor PurchaseOrder links to a project in this
   * schema, so material/vendor costs cannot be included. This is
   * disclosed here again, at the point of use, not just in the
   * migration — a caller reading this method should not assume
   * "actual cost" means "total cost".
   *
   * "health" is a simple, transparent two-state signal —
   * 'at_risk' when there is at least one overdue task OR the
   * project has gone over budget (only checked when a budget is
   * actually set), 'on_track' otherwise. This is NOT a
   * sophisticated project-health scoring model; it is two
   * observable facts, ORed together, so a caller can always see
   * exactly why a project was flagged.
   */
  async getProgressAndBudget(companyId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, companyId, deletedAt: null },
      select: { id: true, name: true, budget: true },
    });
    if (!project) throw new NotFoundException('Project not found.');

    const tasks = await this.prisma.task.findMany({
      where: { projectId, companyId, deletedAt: null },
      select: { id: true, status: true, dueDate: true },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const taskCounts = {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      inProgress: tasks.filter((t) => t.status === 'in_progress').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      cancelled: tasks.filter((t) => t.status === 'cancelled').length,
      overdue: tasks.filter((t) => t.dueDate && t.dueDate < today && t.status !== 'completed' && t.status !== 'cancelled').length,
    };

    const percentComplete =
      taskCounts.total > 0 ? new Decimal(taskCounts.completed).div(taskCounts.total).mul(100).toDecimalPlaces(1).toString() : null;

    const laborCostAgg = await this.prisma.timeEntry.aggregate({
      where: { companyId, deletedAt: null, task: { projectId } },
      _sum: { laborCost: true },
    });
    const actualLaborCost = new Decimal(laborCostAgg._sum.laborCost ?? 0);

    /**
     * Material/vendor cost — bills linked to this project (see
     * migration 083). Deliberately excludes 'cancelled' bills: a
     * cancelled bill was never actually paid out, so it is not a
     * real cost against the project. 'draft' bills ARE included —
     * a draft bill still represents a real, already-received
     * vendor charge (see BillsService: drafts are editable but
     * already exist because goods/services were received), unlike
     * a Purchase Order, which is why POs are not linked at all
     * (see migration 083's comment).
     */
    const materialCostAgg = await this.prisma.bill.aggregate({
      where: { companyId, projectId, deletedAt: null, status: { not: 'cancelled' } },
      _sum: { total: true },
    });
    const actualMaterialCost = new Decimal(materialCostAgg._sum.total ?? 0);

    const actualTotalCost = actualLaborCost.add(actualMaterialCost);

    const budget = project.budget !== null ? new Decimal(project.budget) : null;
    const budgetVariance = budget !== null ? budget.sub(actualTotalCost).toDecimalPlaces(2).toString() : null;
    const budgetUtilizationPercent =
      budget !== null && budget.gt(0) ? actualTotalCost.div(budget).mul(100).toDecimalPlaces(1).toString() : null;
    const isOverBudget = budget !== null && actualTotalCost.gt(budget);

    return {
      budget: project.budget !== null ? project.budget.toString() : null,
      actualLaborCost: actualLaborCost.toDecimalPlaces(2).toString(),
      actualMaterialCost: actualMaterialCost.toDecimalPlaces(2).toString(),
      actualTotalCost: actualTotalCost.toDecimalPlaces(2).toString(),
      budgetVariance,
      budgetUtilizationPercent,
      taskCounts,
      percentComplete,
      health: taskCounts.overdue > 0 || isOverBudget ? 'at_risk' : 'on_track',
    };
  }
}
