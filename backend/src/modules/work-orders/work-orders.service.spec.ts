import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { WorkOrdersService } from './work-orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { ProjectsService } from '../projects/projects.service';
import { EmployeesService } from '../employees/employees.service';
import { NotificationsService } from '../notifications/notifications.service';
import { notificationsServiceBackedBy } from '../notifications/testing/notifications-test-adapter';

describe('WorkOrdersService', () => {
  let service: WorkOrdersService;
  let prisma: any;
  let projectsService: any;
  let employeesService: any;

  function mockTransaction(prismaMock: any) {
    return jest.fn((arg) => (typeof arg === 'function' ? arg(prismaMock) : Promise.all(arg)));
  }

  beforeEach(async () => {
    prisma = {
      workOrder: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      task: { count: jest.fn() },
      employee: { findUnique: jest.fn() },
      project: { findUnique: jest.fn() },
      notification: { create: jest.fn() },
    };
    prisma.$transaction = mockTransaction(prisma);

    projectsService = { assertProjectBelongsToCompany: jest.fn() };
    employeesService = { assertActiveEmployeeInCompany: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkOrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsServiceBackedBy(prisma) },
        { provide: ActivityLogService, useValue: { record: jest.fn() } },
        { provide: ProjectsService, useValue: projectsService },
        { provide: EmployeesService, useValue: employeesService },
      ],
    }).compile();

    service = moduleRef.get(WorkOrdersService);
  });

  // ----------------------------------------------------------
  // Tenant isolation / cross-company references
  // ----------------------------------------------------------
  describe('tenant isolation', () => {
    it('findOne throws NotFoundException outside the caller company', async () => {
      prisma.workOrder.findFirst.mockResolvedValue(null);
      await expect(service.findOne('company-A', 'wo-in-B')).rejects.toThrow(NotFoundException);
    });

    it('create rejects a project belonging to another company (propagated from ProjectsService)', async () => {
      projectsService.assertProjectBelongsToCompany.mockRejectedValue(new NotFoundException());
      await expect(
        service.create('company-A', 'user-1', { projectId: 'proj-in-B', title: 'X' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a cross-company employee assignment', async () => {
      projectsService.assertProjectBelongsToCompany.mockResolvedValue({ id: 'proj-1', status: 'in_progress', customerId: 'cust-1' });
      employeesService.assertActiveEmployeeInCompany.mockRejectedValue(new BadRequestException());
      await expect(
        service.create('company-A', 'user-1', { projectId: 'proj-1', title: 'X', assignedToEmployeeId: 'emp-in-B' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ----------------------------------------------------------
  // Project/customer consistency (customer_id auto-derived)
  // ----------------------------------------------------------
  describe('project/customer consistency', () => {
    it('always derives customer_id from the project, never from client input', async () => {
      projectsService.assertProjectBelongsToCompany.mockResolvedValue({
        id: 'proj-1',
        status: 'in_progress',
        customerId: 'cust-from-project',
      });
      prisma.workOrder.count.mockResolvedValue(0);
      prisma.workOrder.findFirst.mockResolvedValue(null);
      prisma.workOrder.create.mockResolvedValue({ id: 'wo-1' });
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'wo-1' } as any);

      // Even if a malicious payload somehow carried a customerId,
      // the DTO has no such field and the service never reads one
      // from dto — it always uses project.customerId.
      await service.create('company-A', 'user-1', { projectId: 'proj-1', title: 'X' } as any);

      expect(prisma.workOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ customerId: 'cust-from-project' }) }),
      );
    });

    it('rejects creating a work order under a completed project', async () => {
      projectsService.assertProjectBelongsToCompany.mockResolvedValue({ id: 'proj-1', status: 'completed', customerId: 'cust-1' });
      await expect(
        service.create('company-A', 'user-1', { projectId: 'proj-1', title: 'X' } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects creating a work order under a cancelled project', async () => {
      projectsService.assertProjectBelongsToCompany.mockResolvedValue({ id: 'proj-1', status: 'cancelled', customerId: 'cust-1' });
      await expect(
        service.create('company-A', 'user-1', { projectId: 'proj-1', title: 'X' } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ----------------------------------------------------------
  // Inactive/terminated employee assignment rejection
  // ----------------------------------------------------------
  it('rejects assigning an inactive/terminated employee', async () => {
    jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'wo-1', status: 'new', assignedToEmployeeId: null } as any);
    employeesService.assertActiveEmployeeInCompany.mockRejectedValue(new BadRequestException());

    await expect(
      service.assign('company-A', 'user-1', 'wo-1', { employeeId: 'emp-terminated' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  // ----------------------------------------------------------
  // Reassignment
  // ----------------------------------------------------------
  describe('reassignment', () => {
    it('auto-transitions new -> assigned on first assignment', async () => {
      jest.spyOn(service, 'findOne')
        .mockResolvedValueOnce({ id: 'wo-1', status: 'new', assignedToEmployeeId: null } as any)
        .mockResolvedValueOnce({ id: 'wo-1', status: 'assigned', assignedToEmployeeId: 'emp-1' } as any);
      prisma.workOrder.update.mockResolvedValue({ id: 'wo-1', status: 'assigned', assignedToEmployeeId: 'emp-1' });

      await service.assign('company-A', 'user-1', 'wo-1', { employeeId: 'emp-1' } as any);

      expect(prisma.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'assigned' }) }),
      );
    });

    it('allows reassigning an in_progress work order without changing its status', async () => {
      jest.spyOn(service, 'findOne')
        .mockResolvedValueOnce({ id: 'wo-1', status: 'in_progress', assignedToEmployeeId: 'emp-old' } as any)
        .mockResolvedValueOnce({ id: 'wo-1', status: 'in_progress', assignedToEmployeeId: 'emp-new' } as any);
      prisma.workOrder.update.mockResolvedValue({ id: 'wo-1', status: 'in_progress', assignedToEmployeeId: 'emp-new' });

      await service.assign('company-A', 'user-1', 'wo-1', { employeeId: 'emp-new' } as any);

      expect(prisma.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'in_progress', assignedToEmployeeId: 'emp-new' }) }),
      );
    });
  });

  // ----------------------------------------------------------
  // Invalid workflow transitions
  // ----------------------------------------------------------
  describe('status transitions', () => {
    it('rejects new -> in_progress (skipping assigned)', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'wo-1', status: 'new' } as any);
      await expect(
        service.updateStatus('company-A', 'user-1', 'wo-1', { status: 'in_progress' } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects any transition out of a terminal state', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'wo-1', status: 'cancelled' } as any);
      await expect(
        service.updateStatus('company-A', 'user-1', 'wo-1', { status: 'in_progress' } as any),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  // ----------------------------------------------------------
  // Completion gating (strict, no override)
  // ----------------------------------------------------------
  describe('completion gating', () => {
    it('blocks completing a work order with open tasks', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'wo-1', status: 'in_progress' } as any);
      prisma.task.count.mockResolvedValue(3);

      await expect(
        service.updateStatus('company-A', 'user-1', 'wo-1', { status: 'completed' } as any),
      ).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.workOrder.update).not.toHaveBeenCalled();
    });

    it('allows completing once all tasks are completed/cancelled', async () => {
      jest.spyOn(service, 'findOne')
        .mockResolvedValueOnce({ id: 'wo-1', status: 'in_progress' } as any)
        .mockResolvedValueOnce({ id: 'wo-1', status: 'completed' } as any);
      prisma.task.count.mockResolvedValue(0);
      prisma.workOrder.update.mockResolvedValue({ id: 'wo-1', status: 'completed' });

      const result = await service.updateStatus('company-A', 'user-1', 'wo-1', { status: 'completed' } as any);
      expect(result.status).toBe('completed');
    });
  });

  // ----------------------------------------------------------
  // Soft delete
  // ----------------------------------------------------------
  describe('soft delete', () => {
    it('allows deleting a "new" work order with no started tasks', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'wo-1', status: 'new' } as any);
      prisma.task.count.mockResolvedValue(0);
      prisma.workOrder.update.mockResolvedValue({ id: 'wo-1', deletedAt: new Date() });

      const result = await service.softDelete('company-A', 'user-1', 'wo-1');
      expect(result.deletedAt).toBeDefined();
    });

    it('blocks deleting a work order that is not "new"', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue({ id: 'wo-1', status: 'assigned' } as any);
      await expect(service.softDelete('company-A', 'user-1', 'wo-1')).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  // ----------------------------------------------------------
  // findAll — P1 filter regression (V1 Final System Audit §7/13)
  // ----------------------------------------------------------
  describe('findAll — filters reach the service', () => {
    beforeEach(() => {
      prisma.workOrder.findMany.mockResolvedValue([]);
      prisma.workOrder.count.mockResolvedValue(0);
    });

    it('applies projectId, status, and assignedToEmployeeId filters alongside companyId', async () => {
      await service.findAll('company-A', {
        page: 1,
        pageSize: 20,
        projectId: 'proj-1',
        status: 'in_progress',
        assignedToEmployeeId: 'emp-1',
      } as any);

      const call = prisma.workOrder.findMany.mock.calls[0][0];
      expect(call.where.companyId).toBe('company-A');
      expect(call.where.projectId).toBe('proj-1');
      expect(call.where.status).toBe('in_progress');
      expect(call.where.assignedToEmployeeId).toBe('emp-1');
      expect(call.where.deletedAt).toBeNull();
    });

    it('omits filter keys entirely when not supplied', async () => {
      await service.findAll('company-A', { page: 1, pageSize: 20 } as any);

      const call = prisma.workOrder.findMany.mock.calls[0][0];
      expect(call.where.companyId).toBe('company-A');
      expect('projectId' in call.where).toBe(false);
      expect('assignedToEmployeeId' in call.where).toBe(false);
    });
  });
});
