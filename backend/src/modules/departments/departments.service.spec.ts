import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/services/activity-log.service';

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      department: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      employee: {
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActivityLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(DepartmentsService);
  });

  it('creates a department scoped to the caller company', async () => {
    prisma.department.create.mockResolvedValue({ id: 'dept-1', companyId: 'company-1' });

    const result = await service.create('company-1', 'user-1', { name: 'Sales' });

    expect(prisma.department.create).toHaveBeenCalledWith({
      data: { companyId: 'company-1', name: 'Sales', description: undefined, managerId: undefined },
    });
    expect(result.id).toBe('dept-1');
  });

  it('rejects a managerId that does not belong to the same company', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);

    await expect(
      service.create('company-1', 'user-1', { name: 'Ops', managerId: 'emp-from-other-company' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when the department belongs to another tenant', async () => {
    prisma.department.findFirst.mockResolvedValue(null);
    await expect(service.findOne('company-1', 'dept-x')).rejects.toThrow(NotFoundException);
  });

  it('refuses to delete a department that still has active employees', async () => {
    prisma.department.findFirst.mockResolvedValue({ id: 'dept-1', companyId: 'company-1' });
    prisma.employee.count.mockResolvedValue(3);

    await expect(
      service.softDelete('company-1', 'user-1', 'dept-1'),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('soft-deletes a department with no active employees', async () => {
    prisma.department.findFirst.mockResolvedValue({ id: 'dept-1', companyId: 'company-1' });
    prisma.employee.count.mockResolvedValue(0);
    prisma.department.update.mockResolvedValue({ id: 'dept-1', deletedAt: new Date() });

    const result = await service.softDelete('company-1', 'user-1', 'dept-1');
    expect(result.deletedAt).toBeDefined();
  });
});
