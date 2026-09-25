import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import {
  TASK_TERMINAL_STATES,
  TASK_TRANSITIONS,
  WorkflowTransitionValidator,
} from '../../common/services/workflow-transition.validator';
import { ProjectsService } from '../projects/projects.service';
import { WorkOrdersService } from '../work-orders/work-orders.service';
import { EmployeesService } from '../employees/employees.service';
import {
  AssignTaskDto,
  CreateTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
} from './dto/task.dto';
import { CreateTaskDependencyDto } from './dto/create-task-dependency.dto';
import { PaginationQueryDto, buildMeta } from '../../common/dto/pagination-query.dto';
import { TaskFiltersDto } from './dto/task-filters.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
    private projectsService: ProjectsService,
    private workOrdersService: WorkOrdersService,
    private employeesService: EmployeesService,
    private notifications: NotificationsService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreateTaskDto) {
    if (!dto.projectId && !dto.workOrderId) {
      throw new BadRequestException('A task requires at least one of projectId or workOrderId.');
    }

    let projectId = dto.projectId;
    let workOrder: { id: string; projectId: string } | undefined;

    if (dto.workOrderId) {
      workOrder = await this.workOrdersService.assertWorkOrderBelongsToCompany(companyId, dto.workOrderId);

      if (dto.projectId && dto.projectId !== workOrder.projectId) {
        throw new BadRequestException(
          'The supplied projectId does not match the project that the supplied workOrderId belongs to.',
        );
      }
      projectId = workOrder.projectId;
    }

    if (dto.projectId) {
      await this.projectsService.assertProjectBelongsToCompany(companyId, dto.projectId);
    }

    if (dto.assignedToEmployeeId) {
      await this.employeesService.assertActiveEmployeeInCompany(companyId, dto.assignedToEmployeeId);
    }

    const task = await this.prisma.task.create({
      data: {
        companyId,
        projectId,
        workOrderId: dto.workOrderId,
        title: dto.title,
        description: dto.description,
        priority: dto.priority ?? 'medium',
        assignedToEmployeeId: dto.assignedToEmployeeId,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        createdBy: actorUserId,
      },
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'created',
      entityType: 'task',
      entityId: task.id,
      newValues: task,
    });
    if (dto.assignedToEmployeeId) {
      await this.notifyAssignee(companyId, task, 'task_assigned', 'Task Assigned');
    }

    return this.findOne(companyId, task.id);
  }

  async findAll(companyId: string, query: TaskFiltersDto) {
    const { page, pageSize, search, sortBy, sortDir, projectId, workOrderId, status, assignedToEmployeeId } = query;
    const where = {
      companyId,
      deletedAt: null,
      ...(projectId ? { projectId } : {}),
      ...(workOrderId ? { workOrderId } : {}),
      ...(status ? { status } : {}),
      ...(assignedToEmployeeId ? { assignedToEmployeeId } : {}),
      ...(search ? { title: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy ?? 'createdAt']: sortDir },
        include: { assignee: { select: { id: true, firstName: true, lastName: true } } },
      }),
      this.prisma.task.count({ where }),
    ]);

    return { items, meta: buildMeta(page, pageSize, total) };
  }

  async findOne(companyId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, companyId, deletedAt: null },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true } },
        project: { select: { id: true, projectNumber: true, name: true } },
        workOrder: { select: { id: true, workOrderNumber: true } },
      },
    });
    if (!task) throw new NotFoundException('Task not found.');
    return task;
  }

  async update(companyId: string, actorUserId: string, id: string, dto: UpdateTaskDto) {
    const before = await this.findOne(companyId, id);
    this.assertNotTerminal(before);

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'updated',
      entityType: 'task',
      entityId: id,
      oldValues: before,
      newValues: updated,
    });

    return this.findOne(companyId, id);
  }

  async updateStatus(companyId: string, actorUserId: string, id: string, dto: UpdateTaskStatusDto) {
    const before = await this.findOne(companyId, id);

    WorkflowTransitionValidator.assertValidTransition('task', TASK_TRANSITIONS, before.status, dto.status);

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        status: dto.status,
        completedAt: dto.status === 'completed' ? new Date() : undefined,
      },
    });

    const action =
      dto.status === 'completed' ? 'completed' : dto.status === 'cancelled' ? 'cancelled' : 'status_changed';

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action,
      entityType: 'task',
      entityId: id,
      oldValues: { status: before.status },
      newValues: { status: dto.status },
    });

    return this.findOne(companyId, id);
  }

  async assign(companyId: string, actorUserId: string, id: string, dto: AssignTaskDto) {
    const before = await this.findOne(companyId, id);
    await this.employeesService.assertActiveEmployeeInCompany(companyId, dto.employeeId);

    const updated = await this.prisma.task.update({
      where: { id },
      data: { assignedToEmployeeId: dto.employeeId },
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: before.assignedToEmployeeId ? 'reassigned' : 'assigned',
      entityType: 'task',
      entityId: id,
      oldValues: { assignedToEmployeeId: before.assignedToEmployeeId },
      newValues: { assignedToEmployeeId: dto.employeeId },
    });

    await this.notifyAssignee(companyId, updated, 'task_assigned', 'Task Assigned');

    return this.findOne(companyId, id);
  }

  async softDelete(companyId: string, actorUserId: string, id: string) {
    const before = await this.findOne(companyId, id);
    if (before.status !== 'pending') {
      throw new UnprocessableEntityException(
        'Only tasks still in "pending" status can be deleted. In-progress/completed/cancelled tasks must be preserved as history.',
      );
    }

    const deleted = await this.prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'deleted',
      entityType: 'task',
      entityId: id,
      oldValues: before,
    });

    return deleted;
  }

  private assertNotTerminal(task: { status: string }) {
    if (TASK_TERMINAL_STATES.includes(task.status)) {
      throw new UnprocessableEntityException(
        `Task is in a terminal state ('${task.status}') and cannot be modified.`,
      );
    }
  }

  private async notifyAssignee(
    companyId: string,
    task: { id: string; assignedToEmployeeId: string | null; title: string },
    type: string,
    title: string,
  ) {
    if (!task.assignedToEmployeeId) return;
    const employee = await this.prisma.employee.findUnique({
      where: { id: task.assignedToEmployeeId },
      select: { userId: true },
    });
    if (!employee?.userId) return;

    await this.notifications.create({
      companyId,
      userId: employee.userId,
      type,
      title,
      message: `You have been assigned to task "${task.title}".`,
      entityType: 'task',
      entityId: task.id,
    });
  }

  /**
   * Finish-to-start dependency: `taskId` cannot start until
   * `dependsOnTaskId` finishes. See migration 071's comment for
   * why this is the only dependency type modeled.
   */
  async addDependency(companyId: string, actorUserId: string, taskId: string, dto: CreateTaskDependencyDto) {
    const { dependsOnTaskId } = dto;
    if (taskId === dependsOnTaskId) {
      throw new UnprocessableEntityException('A task cannot depend on itself.');
    }

    const [task, dependsOnTask] = await Promise.all([
      this.prisma.task.findFirst({ where: { id: taskId, companyId, deletedAt: null } }),
      this.prisma.task.findFirst({ where: { id: dependsOnTaskId, companyId, deletedAt: null } }),
    ]);
    if (!task) throw new NotFoundException('Task not found.');
    if (!dependsOnTask) throw new NotFoundException('The task to depend on was not found.');

    const existing = await this.prisma.taskDependency.findFirst({ where: { taskId, dependsOnTaskId } });
    if (existing) {
      throw new UnprocessableEntityException('This dependency already exists.');
    }

    if (await this.wouldCreateCycle(taskId, dependsOnTaskId)) {
      throw new UnprocessableEntityException(
        'This dependency would create a circular reference between tasks (e.g. A depends on B, which already depends on A).',
      );
    }

    return this.prisma.taskDependency.create({
      data: { taskId, dependsOnTaskId, createdBy: actorUserId },
    });
  }

  async removeDependency(companyId: string, dependencyId: string) {
    const dependency = await this.prisma.taskDependency.findFirst({
      where: { id: dependencyId, task: { companyId, deletedAt: null } },
    });
    if (!dependency) throw new NotFoundException('Dependency not found.');
    return this.prisma.taskDependency.delete({ where: { id: dependencyId } });
  }

  /**
   * A CHECK constraint can reject a task depending on ITSELF, but
   * SQL has no native way to reject a transitive cycle (A→B→C→A)
   * at insert time — that graph traversal has to happen here.
   *
   * Walks the chain of dependencies STARTING FROM the proposed
   * predecessor (`newDependsOnId`) and follows ITS OWN
   * dependencies outward. If that walk ever reaches `newTaskId`,
   * adding (newTaskId depends on newDependsOnId) would close a
   * loop — newTaskId would end up depending on itself, indirectly.
   */
  private async wouldCreateCycle(newTaskId: string, newDependsOnId: string): Promise<boolean> {
    const visited = new Set<string>();
    const queue: string[] = [newDependsOnId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === newTaskId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      const upstream = await this.prisma.taskDependency.findMany({
        where: { taskId: current },
        select: { dependsOnTaskId: true },
      });
      for (const dep of upstream) {
        queue.push(dep.dependsOnTaskId);
      }
    }
    return false;
  }
}
