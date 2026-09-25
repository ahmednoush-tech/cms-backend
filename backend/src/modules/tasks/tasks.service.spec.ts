import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { ProjectsService } from '../projects/projects.service';
import { WorkOrdersService } from '../work-orders/work-orders.service';
import { EmployeesService } from '../employees/employees.service';
import { NotificationsService } from '../notifications/notifications.service';
import { notificationsServiceBackedBy } from '../notifications/testing/notifications-test-adapter';

describe('TasksService', () => {
  let service: TasksService;
  let prisma: any;
  let projectsService: any;
  let workOrdersService: any;
  let employeesService: any;

  beforeEach(async () => {
    prisma = {
      task: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      employee: { findUnique: jest.fn() },
      notification: { create: jest.fn() },
      taskDependency: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), delete: jest.fn() },
    };
    prisma.$transaction = jest.fn((ops) => Promise.all(ops));

    projectsService = { assertProjectBelongsToCompany: jest.fn() };
    workOrdersService = { assertWorkOrderBelongsToCompany: jest.fn() };
    employeesService = { assertActiveEmployeeInCompany: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsServiceBackedBy(prisma) },
        { provide: ActivityLogService, useValue: { record: jest.fn() } },
        { provide: ProjectsService, useValue: projectsService },
        { provide: WorkOrdersService, useValue: workOrdersService },
        { provide: EmployeesService, useValue: employeesService },
      ],
    }).compile();

    service = moduleRef.get(TasksService);
  });

  // ----------------------------------------------------------
  // At-least-one-parent requirement
  // ----------------------------------------------------------
  it('rejects a task with neither projectId nor workOrderId', async () => {
    await expect(service.create('company-A', 'user-1', { title: 'X' } as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  // ----------------------------------------------------------
  // Task/project/work-order consistency + auto-derivation
  // ----------------------------------------------------------
  describe('project/work-order consistency', () => {
    it('auto-derives projectId from workOrderId when only the latter is supplied', async () => {
      workOrdersService.assertWorkOrderBelongsToCompany.mockResolvedValue({ id: 'wo-1', projectId: 'proj-1' });
      prisma.task.create.mockResolvedValue({ id: 'task-1', projectId: 'proj-1', workOrderId: 'wo-1' });
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'task-1' } as any);

      await service.create('company-A', 'user-1', { workOrderId: 'wo-1', title: 'X' } as any);

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ projectId: 'proj-1', workOrderId: 'wo-1' }) }),
      );
    });

    it('rejects when both are supplied but the work order belongs to a different project', async () => {
      workOrdersService.assertWorkOrderBelongsToCompany.mockResolvedValue({ id: 'wo-1', projectId: 'proj-actual' });

      await expect(
        service.create('company-A', 'user-1', {
          workOrderId: 'wo-1',
          projectId: 'proj-claimed',
          title: 'X',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts when both are supplied and consistent', async () => {
      workOrdersService.assertWorkOrderBelongsToCompany.mockResolvedValue({ id: 'wo-1', projectId: 'proj-1' });
      prisma.task.create.mockResolvedValue({ id: 'task-1' });
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'task-1' } as any);

      await service.create('company-A', 'user-1', {
        workOrderId: 'wo-1',
        projectId: 'proj-1',
        title: 'X',
      } as any);

      expect(projectsService.assertProjectBelongsToCompany).toHaveBeenCalledWith('company-A', 'proj-1');
    });

    it('rejects a projectId belonging to another company (propagated)', async () => {
      projectsService.assertProjectBelongsToCompany.mockRejectedValue(new NotFoundException());
      await expect(
        service.create('company-A', 'user-1', { projectId: 'proj-in-B', title: 'X' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ----------------------------------------------------------
  // Assignment: cross-company / inactive rejection
  // ----------------------------------------------------------
  it('rejects assigning an inactive/cross-company employee', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'task-1', assignedToEmployeeId: null } as any);
    employeesService.assertActiveEmployeeInCompany.mockRejectedValue(new BadRequestException());

    await expect(
      service.assign('company-A', 'user-1', 'task-1', { employeeId: 'emp-bad' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows reassignment at any status (pending or in_progress)', async () => {
    jest.spyOn(service, 'findOne')
      .mockResolvedValueOnce({ id: 'task-1', status: 'in_progress', assignedToEmployeeId: 'emp-old' } as any)
      .mockResolvedValueOnce({ id: 'task-1', status: 'in_progress', assignedToEmployeeId: 'emp-new' } as any);
    prisma.task.update.mockResolvedValue({ id: 'task-1', assignedToEmployeeId: 'emp-new' });

    const result = await service.assign('company-A', 'user-1', 'task-1', { employeeId: 'emp-new' } as any);
    expect(result.assignedToEmployeeId).toBe('emp-new');
  });

  // ----------------------------------------------------------
  // Workflow transitions
  // ----------------------------------------------------------
  describe('status transitions', () => {
    it('allows pending -> in_progress', async () => {
      jest.spyOn(service, 'findOne')
        .mockResolvedValueOnce({ id: 'task-1', status: 'pending' } as any)
        .mockResolvedValueOnce({ id: 'task-1', status: 'in_progress' } as any);
      prisma.task.update.mockResolvedValue({ id: 'task-1', status: 'in_progress' });

      const result = await service.updateStatus('company-A', 'user-1', 'task-1', { status: 'in_progress' } as any);
      expect(result.status).toBe('in_progress');
    });

    it('rejects pending -> completed (must pass through in_progress)', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'task-1', status: 'pending' } as any);
      await expect(
        service.updateStatus('company-A', 'user-1', 'task-1', { status: 'completed' } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects any transition out of a terminal state', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'task-1', status: 'completed' } as any);
      await expect(
        service.updateStatus('company-A', 'user-1', 'task-1', { status: 'in_progress' } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ----------------------------------------------------------
  // Soft delete
  // ----------------------------------------------------------
  describe('soft delete', () => {
    it('allows deleting a pending task', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'task-1', status: 'pending' } as any);
      prisma.task.update.mockResolvedValue({ id: 'task-1', deletedAt: new Date() });

      const result = await service.softDelete('company-A', 'user-1', 'task-1');
      expect(result.deletedAt).toBeDefined();
    });

    it('blocks deleting a task that is not pending', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'task-1', status: 'completed' } as any);
      await expect(service.softDelete('company-A', 'user-1', 'task-1')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  // ----------------------------------------------------------
  // findAll — P1 filter regression (V1 Final System Audit §7/13)
  // ----------------------------------------------------------
  describe('findAll — filters reach the service', () => {
    beforeEach(() => {
      prisma.task.findMany.mockResolvedValue([]);
      prisma.task.count.mockResolvedValue(0);
    });

    it('applies projectId, workOrderId, status, and assignedToEmployeeId filters alongside companyId', async () => {
      await service.findAll('company-A', {
        page: 1,
        pageSize: 20,
        projectId: 'proj-1',
        workOrderId: 'wo-1',
        status: 'pending',
        assignedToEmployeeId: 'emp-1',
      } as any);

      const call = prisma.task.findMany.mock.calls[0][0];
      expect(call.where.companyId).toBe('company-A');
      expect(call.where.projectId).toBe('proj-1');
      expect(call.where.workOrderId).toBe('wo-1');
      expect(call.where.status).toBe('pending');
      expect(call.where.assignedToEmployeeId).toBe('emp-1');
      expect(call.where.deletedAt).toBeNull();
    });

    it('omits filter keys entirely when not supplied', async () => {
      await service.findAll('company-A', { page: 1, pageSize: 20 } as any);

      const call = prisma.task.findMany.mock.calls[0][0];
      expect(call.where.companyId).toBe('company-A');
      expect('projectId' in call.where).toBe(false);
      expect('workOrderId' in call.where).toBe(false);
    });
  });

  describe('addDependency — including the cycle-prevention algorithm', () => {
    const taskA = { id: 'task-A', companyId: 'company-1', deletedAt: null };
    const taskB = { id: 'task-B', companyId: 'company-1', deletedAt: null };
    const taskC = { id: 'task-C', companyId: 'company-1', deletedAt: null };

    it('rejects a task depending on itself', async () => {
      await expect(service.addDependency('company-1', 'user-1', 'task-A', { dependsOnTaskId: 'task-A' })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('404s when the dependent task does not exist', async () => {
      prisma.task.findFirst.mockResolvedValueOnce(null);
      await expect(service.addDependency('company-1', 'user-1', 'task-A', { dependsOnTaskId: 'task-B' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('404s when the predecessor task does not exist', async () => {
      prisma.task.findFirst.mockResolvedValueOnce(taskA).mockResolvedValueOnce(null);
      await expect(service.addDependency('company-1', 'user-1', 'task-A', { dependsOnTaskId: 'task-B' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects a duplicate dependency', async () => {
      prisma.task.findFirst.mockResolvedValueOnce(taskA).mockResolvedValueOnce(taskB);
      prisma.taskDependency.findFirst.mockResolvedValue({ id: 'existing-dep' });
      await expect(service.addDependency('company-1', 'user-1', 'task-A', { dependsOnTaskId: 'task-B' })).rejects.toThrow(
        UnprocessableEntityException,
      );
    });

    it('allows a straightforward, non-circular dependency (A depends on B, B has no dependencies)', async () => {
      prisma.task.findFirst.mockResolvedValueOnce(taskA).mockResolvedValueOnce(taskB);
      prisma.taskDependency.findFirst.mockResolvedValue(null);
      prisma.taskDependency.findMany.mockResolvedValue([]); // B has no upstream dependencies
      prisma.taskDependency.create.mockResolvedValue({ id: 'dep-1' });

      await expect(service.addDependency('company-1', 'user-1', 'task-A', { dependsOnTaskId: 'task-B' })).resolves.toEqual({ id: 'dep-1' });
    });

    it('rejects a DIRECT circular dependency (A depends on B, B already depends on A)', async () => {
      prisma.task.findFirst.mockResolvedValueOnce(taskB).mockResolvedValueOnce(taskA);
      prisma.taskDependency.findFirst.mockResolvedValue(null); // no exact duplicate exists yet
      // B's own upstream dependency chain already includes A (B -> A)
      prisma.taskDependency.findMany.mockImplementation(({ where }: any) => {
        if (where.taskId === 'task-A') return Promise.resolve([{ dependsOnTaskId: 'task-B' }]);
        return Promise.resolve([]);
      });

      // Trying to add: B depends on A — but A already (transitively) depends on B
      await expect(service.addDependency('company-1', 'user-1', 'task-B', { dependsOnTaskId: 'task-A' })).rejects.toThrow(
        /circular/,
      );
    });

    it('rejects an INDIRECT 3-node circular dependency (A→B→C, then trying to add C→A)', async () => {
      prisma.task.findFirst.mockResolvedValueOnce(taskC).mockResolvedValueOnce(taskA);
      prisma.taskDependency.findFirst.mockResolvedValue(null);
      // Existing chain: A depends on B, B depends on C
      prisma.taskDependency.findMany.mockImplementation(({ where }: any) => {
        if (where.taskId === 'task-A') return Promise.resolve([{ dependsOnTaskId: 'task-B' }]);
        if (where.taskId === 'task-B') return Promise.resolve([{ dependsOnTaskId: 'task-C' }]);
        return Promise.resolve([]);
      });

      // Trying to add: C depends on A — would close the loop A→B→C→A
      await expect(service.addDependency('company-1', 'user-1', 'task-C', { dependsOnTaskId: 'task-A' })).rejects.toThrow(
        /circular/,
      );
    });
  });

  describe('removeDependency', () => {
    it('404s when the dependency does not belong to the caller company', async () => {
      prisma.taskDependency.findFirst.mockResolvedValue(null);
      await expect(service.removeDependency('company-1', 'dep-1')).rejects.toThrow(NotFoundException);
    });

    it('deletes an existing dependency', async () => {
      prisma.taskDependency.findFirst.mockResolvedValue({ id: 'dep-1' });
      prisma.taskDependency.delete.mockResolvedValue({ id: 'dep-1' });
      await expect(service.removeDependency('company-1', 'dep-1')).resolves.toEqual({ id: 'dep-1' });
    });
  });
});
