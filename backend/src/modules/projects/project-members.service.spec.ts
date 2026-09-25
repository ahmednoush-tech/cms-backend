import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ProjectMembersService } from './project-members.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { ProjectsService } from './projects.service';
import { EmployeesService } from '../employees/employees.service';

describe('ProjectMembersService', () => {
  let service: ProjectMembersService;
  let prisma: any;
  let projectsService: any;
  let employeesService: any;

  beforeEach(async () => {
    prisma = {
      projectMember: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };
    projectsService = { assertProjectBelongsToCompany: jest.fn() };
    employeesService = { assertActiveEmployeeInCompany: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectMembersService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActivityLogService, useValue: { record: jest.fn() } },
        { provide: ProjectsService, useValue: projectsService },
        { provide: EmployeesService, useValue: employeesService },
      ],
    }).compile();

    service = moduleRef.get(ProjectMembersService);
  });

  // ----------------------------------------------------------
  // Duplicate membership
  // ----------------------------------------------------------
  it('rejects adding an employee who is already a member (409)', async () => {
    projectsService.assertProjectBelongsToCompany.mockResolvedValue({ id: 'proj-1' });
    prisma.projectMember.findUnique.mockResolvedValue({ projectId: 'proj-1', employeeId: 'emp-1' });

    await expect(
      service.add('company-A', 'user-1', 'proj-1', { employeeId: 'emp-1', role: 'technician' }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.projectMember.create).not.toHaveBeenCalled();
  });

  it('adds a new member successfully when no existing membership', async () => {
    projectsService.assertProjectBelongsToCompany.mockResolvedValue({ id: 'proj-1' });
    prisma.projectMember.findUnique.mockResolvedValue(null);
    prisma.projectMember.create.mockResolvedValue({ projectId: 'proj-1', employeeId: 'emp-1', role: 'technician' });

    const result = await service.add('company-A', 'user-1', 'proj-1', {
      employeeId: 'emp-1',
      role: 'technician',
    });
    expect(result.role).toBe('technician');
  });

  // ----------------------------------------------------------
  // Cross-company / inactive employee rejection
  // ----------------------------------------------------------
  it('rejects a cross-company employee', async () => {
    projectsService.assertProjectBelongsToCompany.mockResolvedValue({ id: 'proj-1' });
    employeesService.assertActiveEmployeeInCompany.mockRejectedValue(new BadRequestException());

    await expect(
      service.add('company-A', 'user-1', 'proj-1', { employeeId: 'emp-in-B', role: 'technician' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a terminated/inactive employee', async () => {
    projectsService.assertProjectBelongsToCompany.mockResolvedValue({ id: 'proj-1' });
    employeesService.assertActiveEmployeeInCompany.mockRejectedValue(new BadRequestException('Employee must be active to be assigned.'));

    await expect(
      service.add('company-A', 'user-1', 'proj-1', { employeeId: 'emp-terminated', role: 'technician' }),
    ).rejects.toThrow(BadRequestException);
  });

  // ----------------------------------------------------------
  // Tenant isolation
  // ----------------------------------------------------------
  it('propagates NotFoundException for a project in another company', async () => {
    projectsService.assertProjectBelongsToCompany.mockRejectedValue(new NotFoundException());
    await expect(
      service.add('company-A', 'user-1', 'proj-in-B', { employeeId: 'emp-1', role: 'technician' }),
    ).rejects.toThrow(NotFoundException);
  });

  // ----------------------------------------------------------
  // Role update / removal
  // ----------------------------------------------------------
  it('updates a member role without needing to remove/re-add', async () => {
    projectsService.assertProjectBelongsToCompany.mockResolvedValue({ id: 'proj-1' });
    prisma.projectMember.findUnique.mockResolvedValue({ projectId: 'proj-1', employeeId: 'emp-1', role: 'technician' });
    prisma.projectMember.update.mockResolvedValue({ projectId: 'proj-1', employeeId: 'emp-1', role: 'coordinator' });

    const result = await service.updateRole('company-A', 'user-1', 'proj-1', 'emp-1', { role: 'coordinator' });
    expect(result.role).toBe('coordinator');
  });

  it('removes a member', async () => {
    projectsService.assertProjectBelongsToCompany.mockResolvedValue({ id: 'proj-1' });
    prisma.projectMember.findUnique.mockResolvedValue({ projectId: 'proj-1', employeeId: 'emp-1', role: 'technician' });
    prisma.projectMember.delete.mockResolvedValue({});

    const result = await service.remove('company-A', 'user-1', 'proj-1', 'emp-1');
    expect(result.removed).toBe(true);
  });
});
