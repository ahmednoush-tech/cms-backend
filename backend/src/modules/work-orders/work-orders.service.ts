import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import {
  WORK_ORDER_TERMINAL_STATES,
  WORK_ORDER_TRANSITIONS,
  WorkflowTransitionValidator,
} from '../../common/services/workflow-transition.validator';
import { ProjectsService } from '../projects/projects.service';
import { EmployeesService } from '../employees/employees.service';
import {
  AssignWorkOrderDto,
  CreateWorkOrderDto,
  UpdateWorkOrderDto,
  UpdateWorkOrderStatusDto,
} from './dto/work-order.dto';
import { PaginationQueryDto, buildMeta } from '../../common/dto/pagination-query.dto';
import { WorkOrderFiltersDto } from './dto/work-order-filters.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class WorkOrdersService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
    private projectsService: ProjectsService,
    private employeesService: EmployeesService,
    private notifications: NotificationsService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreateWorkOrderDto) {
    const project = await this.projectsService.assertProjectBelongsToCompany(companyId, dto.projectId);

    if (['completed', 'cancelled'].includes(project.status)) {
      throw new UnprocessableEntityException(
        `Cannot create a work order under a project that is '${project.status}'.`,
      );
    }

    if (dto.assignedToEmployeeId) {
      await this.employeesService.assertActiveEmployeeInCompany(companyId, dto.assignedToEmployeeId);
    }

    const workOrder = await this.prisma.$transaction(async (tx) => {
      const workOrderNumber = await this.generateWorkOrderNumber(tx, companyId);

      return tx.workOrder.create({
        data: {
          companyId,
          projectId: dto.projectId,
          customerId: project.customerId,
          workOrderNumber,
          title: dto.title,
          description: dto.description,
          priority: dto.priority ?? 'medium',
          status: dto.assignedToEmployeeId ? 'assigned' : 'new',
          assignedToEmployeeId: dto.assignedToEmployeeId,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          createdBy: actorUserId,
        },
      });
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'created',
      entityType: 'work_order',
      entityId: workOrder.id,
      newValues: workOrder,
    });
    if (dto.assignedToEmployeeId) {
      await this.notifyAssignee(companyId, workOrder, 'work_order_assigned', 'Work Order Assigned');
    }

    return this.findOne(companyId, workOrder.id);
  }

  async findAll(companyId: string, query: WorkOrderFiltersDto) {
    const { page, pageSize, search, sortBy, sortDir, projectId, status, assignedToEmployeeId } = query;
    const where = {
      companyId,
      deletedAt: null,
      ...(projectId ? { projectId } : {}),
      ...(status ? { status } : {}),
      ...(assignedToEmployeeId ? { assignedToEmployeeId } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              { workOrderNumber: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.workOrder.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy ?? 'createdAt']: sortDir },
        include: { assignee: { select: { id: true, firstName: true, lastName: true } } },
      }),
      this.prisma.workOrder.count({ where }),
    ]);

    return { items, meta: buildMeta(page, pageSize, total) };
  }

  async findOne(companyId: string, id: string) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { assignee: { select: { id: true, firstName: true, lastName: true } }, tasks: { select: { id: true, status: true, title: true } } },
    });
    if (!workOrder) throw new NotFoundException('Work order not found.');
    return workOrder;
  }

  async assertWorkOrderBelongsToCompany(companyId: string, id: string) {
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!workOrder) throw new NotFoundException('Work order not found.');
    return workOrder;
  }

  async update(companyId: string, actorUserId: string, id: string, dto: UpdateWorkOrderDto) {
    const before = await this.findOne(companyId, id);
    this.assertNotTerminal(before);

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'updated',
      entityType: 'work_order',
      entityId: id,
      oldValues: before,
      newValues: updated,
    });

    return this.findOne(companyId, id);
  }

  async updateStatus(companyId: string, actorUserId: string, id: string, dto: UpdateWorkOrderStatusDto) {
    const before = await this.findOne(companyId, id);

    WorkflowTransitionValidator.assertValidTransition(
      'work_order',
      WORK_ORDER_TRANSITIONS,
      before.status,
      dto.status,
    );

    if (dto.status === 'completed') {
      await this.assertNoOpenTasks(id);
    }

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        status: dto.status,
        completedAt: dto.status === 'completed' ? new Date() : undefined,
      },
    });

    const action = dto.status === 'completed' ? 'completed' : dto.status === 'cancelled' ? 'cancelled' : 'status_changed';

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action,
      entityType: 'work_order',
      entityId: id,
      oldValues: { status: before.status },
      newValues: { status: dto.status },
    });

    if (dto.status === 'completed') {
      await this.notifyProjectManagerOfWorkOrder(companyId, updated, 'work_order_completed', 'Work Order Completed');
    }

    return this.findOne(companyId, id);
  }

  async assign(companyId: string, actorUserId: string, id: string, dto: AssignWorkOrderDto) {
    const before = await this.findOne(companyId, id);
    await this.employeesService.assertActiveEmployeeInCompany(companyId, dto.employeeId);

    const nextStatus = before.status === 'new' ? 'assigned' : before.status;

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: { assignedToEmployeeId: dto.employeeId, status: nextStatus },
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: before.assignedToEmployeeId ? 'reassigned' : 'assigned',
      entityType: 'work_order',
      entityId: id,
      oldValues: { assignedToEmployeeId: before.assignedToEmployeeId },
      newValues: { assignedToEmployeeId: dto.employeeId },
    });

    await this.notifyAssignee(companyId, updated, 'work_order_assigned', 'Work Order Assigned');

    return this.findOne(companyId, id);
  }

  async softDelete(companyId: string, actorUserId: string, id: string) {
    const before = await this.findOne(companyId, id);
    if (before.status !== 'new') {
      throw new UnprocessableEntityException(
        'Only work orders still in "new" status can be deleted. Assigned/active/completed/cancelled work orders must be preserved as history.',
      );
    }
    const openTasks = await this.prisma.task.count({
      where: { workOrderId: id, status: { notIn: ['pending', 'cancelled'] } },
    });
    if (openTasks > 0) {
      throw new UnprocessableEntityException('Cannot delete a work order that has tasks already in progress or completed.');
    }

    const deleted = await this.prisma.workOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'deleted',
      entityType: 'work_order',
      entityId: id,
      oldValues: before,
    });

    return deleted;
  }

  private assertNotTerminal(workOrder: { status: string }) {
    if (WORK_ORDER_TERMINAL_STATES.includes(workOrder.status)) {
      throw new UnprocessableEntityException(
        `Work order is in a terminal state ('${workOrder.status}') and cannot be modified.`,
      );
    }
  }

  private async assertNoOpenTasks(workOrderId: string) {
    const openCount = await this.prisma.task.count({
      where: { workOrderId, status: { notIn: ['completed', 'cancelled'] } },
    });
    if (openCount > 0) {
      throw new UnprocessableEntityException(
        `Cannot complete this work order — ${openCount} task(s) are not yet completed or cancelled. ` +
          `Strict completion gating is enforced in V1 (no override).`,
      );
    }
  }

  private async generateWorkOrderNumber(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `WO-${year}-`;
    const count = await tx.workOrder.count({ where: { companyId, workOrderNumber: { startsWith: prefix } } });

    let attempt = count + 1;
    for (let tries = 0; tries < 5; tries++) {
      const candidate = `${prefix}${String(attempt).padStart(4, '0')}`;
      const clash = await tx.workOrder.findFirst({
        where: { companyId, workOrderNumber: candidate },
        select: { id: true },
      });
      if (!clash) return candidate;
      attempt++;
    }
    throw new UnprocessableEntityException('Could not generate a unique work order number — please retry.');
  }

  private async notifyAssignee(
    companyId: string,
    workOrder: { id: string; assignedToEmployeeId: string | null; workOrderNumber: string },
    type: string,
    title: string,
  ) {
    if (!workOrder.assignedToEmployeeId) return;
    const employee = await this.prisma.employee.findUnique({
      where: { id: workOrder.assignedToEmployeeId },
      select: { userId: true },
    });
    if (!employee?.userId) return;

    await this.notifications.create({
      companyId,
      userId: employee.userId,
      type,
      title,
      message: `You have been assigned to work order ${workOrder.workOrderNumber}.`,
      entityType: 'work_order',
      entityId: workOrder.id,
    });
  }

  private async notifyProjectManagerOfWorkOrder(
    companyId: string,
    workOrder: { id: string; projectId: string; workOrderNumber: string },
    type: string,
    title: string,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: workOrder.projectId },
      select: { projectManagerId: true },
    });
    if (!project?.projectManagerId) return;
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
      message: `Work order ${workOrder.workOrderNumber} was completed.`,
      entityType: 'work_order',
      entityId: workOrder.id,
    });
  }
}
