import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, UnprocessableEntityException } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import type { AuthContext } from '../../common/interfaces/request-context.interface';

// A fully unscoped (company-wide) caller — every test in this file
// exercises behavior unrelated to scoped/delegated admin, so this
// fixture exists purely to satisfy findOne/update/softDelete/
// linkUser's now-required `user` parameter while preserving the
// exact "no filtering" behavior these tests already relied on.
// Scoped-admin-specific behavior has its own dedicated tests below.
const unscopedTestUser: AuthContext = {
  sub: 'actor-1',
  companyId: 'company-1',
  email: 'actor@company-1.example',
  roles: [],
  permissions: [],
  scopedPermissions: {},
  isCustomerUser: false,
};

describe('EmployeesService', () => {
  let service: EmployeesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      employee: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      department: { findFirst: jest.fn() },
      user: { findFirst: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActivityLogService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(EmployeesService);
  });

  it('creates an employee scoped to the caller company', async () => {
    prisma.employee.create.mockResolvedValue({ id: 'emp-1', companyId: 'company-1' });

    const result = await service.create('company-1', 'user-1', {
      employeeNumber: 'EMP-100',
      firstName: 'Sara',
      lastName: 'Al-Qahtani',
    });

    expect(result.id).toBe('emp-1');
    expect(prisma.employee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyId: 'company-1', employeeNumber: 'EMP-100' }),
      }),
    );
  });

  it('rejects a departmentId belonging to a different tenant', async () => {
    prisma.department.findFirst.mockResolvedValue(null);

    await expect(
      service.create('company-1', 'user-1', {
        employeeNumber: 'EMP-101',
        firstName: 'A',
        lastName: 'B',
        departmentId: 'dept-from-other-company',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects linking a user that is already linked to another employee', async () => {
    // linkUser() calls findOne() first (confirms the target employee
    // exists) before checking whether userId is already linked
    // elsewhere — findOne's prisma.employee.findFirst call must be
    // mocked too, or it 404s before ever reaching the check this
    // test is actually exercising.
    prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', companyId: 'company-1', status: 'active' });
    prisma.user.findFirst.mockResolvedValue({ id: 'user-2', companyId: 'company-1' });
    prisma.employee.findUnique.mockResolvedValue({ id: 'other-emp', userId: 'user-2' });

    await expect(
      service.linkUser('company-1', 'actor-1', 'emp-1', 'user-2', unscopedTestUser),
    ).rejects.toThrow(ConflictException);
  });

  it('prevents an employee from being set as their own manager', async () => {
    prisma.employee.findFirst.mockResolvedValueOnce({ id: 'emp-1', companyId: 'company-1', status: 'active' });

    await expect(
      service.update('company-1', 'actor-1', 'emp-1', { managerId: 'emp-1' }, unscopedTestUser),
    ).rejects.toThrow(BadRequestException);
  });

  it('soft-deletes and marks the employee terminated', async () => {
    prisma.employee.findFirst.mockResolvedValueOnce({ id: 'emp-1', companyId: 'company-1', status: 'active' });
    prisma.employee.update.mockResolvedValue({ id: 'emp-1', status: 'terminated', deletedAt: new Date() });

    const result = await service.softDelete('company-1', 'actor-1', 'emp-1', unscopedTestUser);
    expect(result.status).toBe('terminated');
    expect(result.deletedAt).toBeDefined();
  });

  // ============================================================
  // Phase 2F P2 fix: manager cycle detection (V1 Final System Audit §2)
  // ============================================================
  describe('manager cycle detection', () => {
    function mockManagerChain(chain: Record<string, { managerId: string | null }>) {
      prisma.employee.findFirst.mockImplementation(({ where }: any) => {
        const entry = chain[where.id];
        if (!entry) return Promise.resolve(null);
        return Promise.resolve({
          id: where.id,
          companyId: 'company-1',
          status: 'active',
          deletedAt: null,
          managerId: entry.managerId,
        });
      });
    }

    it('still blocks direct self-management (unchanged behavior, preserved)', async () => {
      mockManagerChain({ 'emp-A': { managerId: null } });

      await expect(
        service.update('company-1', 'actor-1', 'emp-A', { managerId: 'emp-A' } as any, unscopedTestUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks a direct 2-cycle (A -> manager B, B -> manager A)', async () => {
      // emp-A is being updated to have emp-B as manager; emp-B's
      // existing manager is already emp-A — a direct cycle.
      mockManagerChain({
        'emp-A': { managerId: null },
        'emp-B': { managerId: 'emp-A' },
      });

      await expect(
        service.update('company-1', 'actor-1', 'emp-A', { managerId: 'emp-B' } as any, unscopedTestUser),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('blocks an indirect 3-link cycle (A -> B -> C -> A)', async () => {
      // emp-A being updated to report to emp-B; emp-B reports to
      // emp-C; emp-C already reports to emp-A. Assigning B as A's
      // manager would close the loop A -> B -> C -> A.
      mockManagerChain({
        'emp-A': { managerId: null },
        'emp-B': { managerId: 'emp-C' },
        'emp-C': { managerId: 'emp-A' },
      });

      await expect(
        service.update('company-1', 'actor-1', 'emp-A', { managerId: 'emp-B' } as any, unscopedTestUser),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('blocks a longer 5-link indirect cycle', async () => {
      mockManagerChain({
        'emp-A': { managerId: null },
        'emp-B': { managerId: 'emp-C' },
        'emp-C': { managerId: 'emp-D' },
        'emp-D': { managerId: 'emp-E' },
        'emp-E': { managerId: 'emp-A' },
      });

      await expect(
        service.update('company-1', 'actor-1', 'emp-A', { managerId: 'emp-B' } as any, unscopedTestUser),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('allows a valid, non-circular manager assignment', async () => {
      mockManagerChain({
        'emp-A': { managerId: null },
        'emp-B': { managerId: 'emp-C' },
        'emp-C': { managerId: null }, // top of the chain, no cycle back to A
      });
      prisma.employee.update.mockResolvedValue({ id: 'emp-A', managerId: 'emp-B' });

      const result = await service.update('company-1', 'actor-1', 'emp-A', { managerId: 'emp-B' } as any, unscopedTestUser);
      expect(result.managerId).toBe('emp-B');
    });

    it('allows assigning a manager with no existing manager at all (top of an org chart)', async () => {
      mockManagerChain({
        'emp-A': { managerId: null },
        'emp-B': { managerId: null },
      });
      prisma.employee.update.mockResolvedValue({ id: 'emp-A', managerId: 'emp-B' });

      const result = await service.update('company-1', 'actor-1', 'emp-A', { managerId: 'emp-B' } as any, unscopedTestUser);
      expect(result.managerId).toBe('emp-B');
    });

    it('still rejects a cross-company manager before cycle detection ever runs', async () => {
      // assertEmployeeBelongsToCompany returns null for a manager
      // outside the company — that 400 must fire before the walk.
      prisma.employee.findFirst.mockImplementation(({ where }: any) => {
        if (where.id === 'emp-A') {
          return Promise.resolve({ id: 'emp-A', companyId: 'company-1', status: 'active' });
        }
        return Promise.resolve(null); // emp-in-other-company not found in company-1
      });

      await expect(
        service.update('company-1', 'actor-1', 'emp-A', { managerId: 'emp-in-other-company' } as any, unscopedTestUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not loop forever on a pre-existing cycle that does not involve the employee being updated', async () => {
      // emp-X and emp-Y already form a cycle unrelated to emp-A
      // (shouldn't be reachable via the API post-fix, but the
      // walk must still terminate defensively rather than hang).
      mockManagerChain({
        'emp-A': { managerId: null },
        'emp-X': { managerId: 'emp-Y' },
        'emp-Y': { managerId: 'emp-X' },
      });
      prisma.employee.update.mockResolvedValue({ id: 'emp-A', managerId: 'emp-X' });

      const result = await service.update('company-1', 'actor-1', 'emp-A', { managerId: 'emp-X' } as any, unscopedTestUser);
      expect(result.managerId).toBe('emp-X'); // resolves, does not hang or throw
    });
  });

  describe('scoped/delegated admin — findAll and findOne narrow to the caller\'s department scope', () => {
    const scopedToDeptA: AuthContext = {
      ...unscopedTestUser,
      scopedPermissions: {
        'Administration:employees:view': [{ scopeType: 'department', scopeId: 'dept-A' }],
      },
    };
    const baseQuery = { page: 1, pageSize: 25 } as any;

    it('findAll filters to the scoped department when the caller asks for no specific department', async () => {
      prisma.employee.findMany.mockResolvedValue([]);
      prisma.employee.count.mockResolvedValue(0);

      await service.findAll('company-1', baseQuery, scopedToDeptA);

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ departmentId: { in: ['dept-A'] } }) }),
      );
    });

    it('findAll returns empty results (not an error, not someone else\'s department) when asked for a department outside the caller\'s scope', async () => {
      const result = await service.findAll('company-1', baseQuery, scopedToDeptA, 'dept-B');

      expect(result.items).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(prisma.employee.findMany).not.toHaveBeenCalled();
    });

    it('findAll honors an explicit departmentId that IS within the caller\'s scope', async () => {
      prisma.employee.findMany.mockResolvedValue([]);
      prisma.employee.count.mockResolvedValue(0);

      await service.findAll('company-1', baseQuery, scopedToDeptA, 'dept-A');

      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ departmentId: 'dept-A' }) }),
      );
    });

    it('findAll applies no department filter at all for an unscoped (full-access) caller', async () => {
      prisma.employee.findMany.mockResolvedValue([]);
      prisma.employee.count.mockResolvedValue(0);

      await service.findAll('company-1', baseQuery, unscopedTestUser);

      const whereArg = prisma.employee.findMany.mock.calls[0][0].where;
      expect(whereArg.departmentId).toBeUndefined();
    });

    it('findOne 404s (not 403s) for a real employee outside the caller\'s scoped department', async () => {
      prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', companyId: 'company-1', departmentId: 'dept-B' });

      await expect(service.findOne('company-1', 'emp-1', scopedToDeptA)).rejects.toThrow('Employee not found.');
    });

    it('findOne succeeds for an employee inside the caller\'s scoped department', async () => {
      prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1', companyId: 'company-1', departmentId: 'dept-A' });

      const result = await service.findOne('company-1', 'emp-1', scopedToDeptA);
      expect(result.id).toBe('emp-1');
    });
  });
});
