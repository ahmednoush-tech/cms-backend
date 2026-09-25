import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * One-to-one coverage of the Phase 2B verification checklist.
 * Each `it()` title intentionally mirrors a checklist bullet so
 * results can be matched line-for-line against the request.
 *
 * Run with: DATABASE_URL=<test db> npm run test:e2e
 * (see scripts/run-full-verification.sh for the full pipeline)
 */
describe('Phase 2B verification checklist (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function grantAllAdminPermissions(roleId: string) {
    const resources: Array<[string, string, string]> = [
      ['Administration', 'departments', 'view'],
      ['Administration', 'departments', 'create'],
      ['Administration', 'departments', 'edit'],
      ['Administration', 'departments', 'delete'],
      ['Administration', 'employees', 'view'],
      ['Administration', 'employees', 'create'],
      ['Administration', 'employees', 'edit'],
      ['Administration', 'employees', 'delete'],
      ['Administration', 'users', 'manage'],
    ];
    const perms = await Promise.all(
      resources.map(([module, resource, action]) =>
        prisma.permission.upsert({
          where: { module_resource_action: { module, resource, action } },
          create: { module, resource, action },
          update: {},
        }),
      ),
    );
    await Promise.all(
      perms.map((p) =>
        prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId, permissionId: p.id } },
          create: { roleId, permissionId: p.id },
          update: {},
        }),
      ),
    );
  }

  async function createTenant(label: string, permissionScope: 'full' | 'view-only' | 'none') {
    const company = await prisma.company.create({ data: { name: `${label} Co.`, status: 'active' } });
    const role = await prisma.role.create({ data: { companyId: company.id, name: `${label} Role` } });

    if (permissionScope === 'full') {
      await grantAllAdminPermissions(role.id);
    } else if (permissionScope === 'view-only') {
      const perm = await prisma.permission.upsert({
        where: { module_resource_action: { module: 'Administration', resource: 'departments', action: 'view' } },
        create: { module: 'Administration', resource: 'departments', action: 'view' },
        update: {},
      });
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
    }

    const passwordHash = await bcrypt.hash('TestPassword123!', 4);
    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        name: `${label} User`,
        email: `${label.toLowerCase().replace(/\s/g, '-')}@example.com`,
        passwordHash,
        status: 'active',
      },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

    const dept = await prisma.department.create({ data: { companyId: company.id, name: `${label} Dept` } });
    const employee = await prisma.employee.create({
      data: {
        companyId: company.id,
        departmentId: dept.id,
        employeeNumber: `EMP-${label.toUpperCase().replace(/\s/g, '')}-1`,
        firstName: label,
        lastName: 'Employee',
      },
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'TestPassword123!' });

    return { company, user, role, dept, employee, accessToken: login.body.data.accessToken as string };
  }

  // ----------------------------------------------------------
  // 6. Tenant isolation — Departments
  // ----------------------------------------------------------
  describe('6. Tenant isolation — Departments', () => {
    it('Company A user can read Company A departments', async () => {
      const a = await createTenant('Dept6A', 'full');
      const res = await request(app.getHttpServer())
        .get(`/api/v1/departments/${a.dept.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(a.dept.id);
    });

    it('Company A user cannot read Company B departments', async () => {
      const a = await createTenant('Dept6A2', 'full');
      const b = await createTenant('Dept6B2', 'full');
      const res = await request(app.getHttpServer())
        .get(`/api/v1/departments/${b.dept.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(404);
    });

    it('Company A user cannot update Company B departments', async () => {
      const a = await createTenant('Dept6A3', 'full');
      const b = await createTenant('Dept6B3', 'full');
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/departments/${b.dept.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ name: 'Hijacked' });
      expect(res.status).toBe(404);
      const stillOriginal = await prisma.department.findUnique({ where: { id: b.dept.id } });
      expect(stillOriginal?.name).toBe(b.dept.name);
    });

    it('Company A user cannot delete Company B departments', async () => {
      const a = await createTenant('Dept6A4', 'full');
      const b = await createTenant('Dept6B4', 'full');
      // b's department has an active employee too, but tenant check must fire first
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/departments/${b.dept.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(404);
      const stillThere = await prisma.department.findUnique({ where: { id: b.dept.id } });
      expect(stillThere?.deletedAt).toBeNull();
    });

    it('Company A user cannot create a department referencing a Company B manager', async () => {
      const a = await createTenant('Dept6A5', 'full');
      const b = await createTenant('Dept6B5', 'full');
      const res = await request(app.getHttpServer())
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ name: 'Cross-tenant dept', managerId: b.employee.id });
      expect(res.status).toBe(400);
    });
  });

  // ----------------------------------------------------------
  // 6. Tenant isolation — Employees
  // ----------------------------------------------------------
  describe('6. Tenant isolation — Employees', () => {
    it('Company A user can read Company A employees', async () => {
      const a = await createTenant('Emp6A', 'full');
      const res = await request(app.getHttpServer())
        .get(`/api/v1/employees/${a.employee.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(200);
    });

    it('Company A user cannot read Company B employees', async () => {
      const a = await createTenant('Emp6A2', 'full');
      const b = await createTenant('Emp6B2', 'full');
      const res = await request(app.getHttpServer())
        .get(`/api/v1/employees/${b.employee.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(404);
    });

    it('Company A user cannot update Company B employees', async () => {
      const a = await createTenant('Emp6A3', 'full');
      const b = await createTenant('Emp6B3', 'full');
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/employees/${b.employee.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ firstName: 'Hijacked' });
      expect(res.status).toBe(404);
    });

    it('Company A user cannot delete Company B employees', async () => {
      const a = await createTenant('Emp6A4', 'full');
      const b = await createTenant('Emp6B4', 'full');
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/employees/${b.employee.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(404);
    });

    it('Company A user cannot create an employee referencing Company B', async () => {
      const a = await createTenant('Emp6A5', 'full');
      const b = await createTenant('Emp6B5', 'full');
      const res = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ employeeNumber: 'EMP-X', firstName: 'X', lastName: 'Y', departmentId: b.dept.id });
      expect(res.status).toBe(400);
    });

    it('Company A user cannot assign a Company B manager', async () => {
      const a = await createTenant('Emp6A6', 'full');
      const b = await createTenant('Emp6B6', 'full');
      const res = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ employeeNumber: 'EMP-Y', firstName: 'X', lastName: 'Y', managerId: b.employee.id });
      expect(res.status).toBe(400);
    });

    it('Company A user cannot assign a Company B department', async () => {
      const a = await createTenant('Emp6A7', 'full');
      const b = await createTenant('Emp6B7', 'full');
      const res = await request(app.getHttpServer())
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ employeeNumber: 'EMP-Z', firstName: 'X', lastName: 'Y', departmentId: b.dept.id });
      expect(res.status).toBe(400);
    });
  });

  // ----------------------------------------------------------
  // 7. Authentication
  // ----------------------------------------------------------
  describe('7. Authentication', () => {
    it('valid login succeeds and returns a token pair', async () => {
      const a = await createTenant('Auth7Valid', 'full');
      expect(a.accessToken).toBeTruthy();
    });

    it('invalid password is rejected with 401', async () => {
      const a = await createTenant('Auth7Bad', 'full');
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: a.user.email, password: 'WrongPassword!' });
      expect(res.status).toBe(401);
    });

    it('inactive user cannot login', async () => {
      const a = await createTenant('Auth7Inactive', 'full');
      await prisma.user.update({ where: { id: a.user.id }, data: { status: 'inactive' } });
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: a.user.email, password: 'TestPassword123!' });
      expect(res.status).toBe(403);
    });

    it('locked user cannot login', async () => {
      const a = await createTenant('Auth7Locked', 'full');
      await prisma.user.update({ where: { id: a.user.id }, data: { status: 'locked' } });
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: a.user.email, password: 'TestPassword123!' });
      expect(res.status).toBe(403);
    });

    it('soft-deleted user cannot login', async () => {
      const a = await createTenant('Auth7Deleted', 'full');
      await prisma.user.update({ where: { id: a.user.id }, data: { deletedAt: new Date() } });
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: a.user.email, password: 'TestPassword123!' });
      expect(res.status).toBe(401);
    });

    it('refresh token rotation issues a new pair and invalidates the old refresh token', async () => {
      const a = await createTenant('Auth7Refresh', 'full');
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: a.user.email, password: 'TestPassword123!' });
      const oldRefreshToken = login.body.data.refreshToken;

      const refreshed = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: oldRefreshToken });
      expect(refreshed.status).toBe(200);
      expect(refreshed.body.data.accessToken).toBeTruthy();
      expect(refreshed.body.data.refreshToken).not.toBe(oldRefreshToken);

      // Replaying the old refresh token must now fail (rotation).
      const replay = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: oldRefreshToken });
      expect(replay.status).toBe(401);
    });

    it('/auth/me returns only the caller\'s own context', async () => {
      const a = await createTenant('Auth7Me', 'full');
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.sub).toBe(a.user.id);
      expect(res.body.data.companyId).toBe(a.company.id);
    });
  });

  // ----------------------------------------------------------
  // 8. RBAC
  // ----------------------------------------------------------
  describe('8. RBAC', () => {
    it('allowed permission → success', async () => {
      const a = await createTenant('Rbac8Allow', 'full');
      const res = await request(app.getHttpServer())
        .get('/api/v1/departments')
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(200);
    });

    it('missing permission → 403', async () => {
      const a = await createTenant('Rbac8Deny', 'view-only'); // has view, not create
      const res = await request(app.getHttpServer())
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ name: 'Should be blocked' });
      expect(res.status).toBe(403);
    });

    it('missing authentication → 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/departments');
      expect(res.status).toBe(401);
    });
  });

  // ----------------------------------------------------------
  // 9. Soft delete
  // ----------------------------------------------------------
  describe('9. Soft delete', () => {
    it('deleted records are excluded from normal list/get queries', async () => {
      const a = await createTenant('SoftDel9List', 'full');
      const extraDept = await prisma.department.create({
        data: { companyId: a.company.id, name: 'To Be Deleted' },
      });
      await prisma.department.update({ where: { id: extraDept.id }, data: { deletedAt: new Date() } });

      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/departments/${extraDept.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(getRes.status).toBe(404);

      const listRes = await request(app.getHttpServer())
        .get('/api/v1/departments')
        .set('Authorization', `Bearer ${a.accessToken}`);
      const ids = listRes.body.data.map((d: any) => d.id);
      expect(ids).not.toContain(extraDept.id);
    });

    it('a department with active employees cannot be soft-deleted', async () => {
      const a = await createTenant('SoftDel9Dept', 'full');
      // a.dept already has a.employee assigned to it (active)
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/departments/${a.dept.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(422);
    });

    it('a soft-deleted employee is not treated as active (excluded + status=terminated)', async () => {
      const a = await createTenant('SoftDel9Emp', 'full');
      const del = await request(app.getHttpServer())
        .delete(`/api/v1/employees/${a.employee.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(del.status).toBe(200);
      expect(del.body.data.status).toBe('terminated');

      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/employees/${a.employee.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(getRes.status).toBe(404);
    });
  });

  // ----------------------------------------------------------
  // 10. Duplicate-link protection
  // ----------------------------------------------------------
  describe('10. Duplicate-link protection', () => {
    it('duplicate employee/user relationship is rejected with 409', async () => {
      const a = await createTenant('Dup10', 'full');
      const secondEmployee = await prisma.employee.create({
        data: {
          companyId: a.company.id,
          employeeNumber: 'EMP-DUP-2',
          firstName: 'Second',
          lastName: 'Employee',
        },
      });

      // Link a.user to a.employee first (a.employee currently has no user)
      const firstLink = await request(app.getHttpServer())
        .post(`/api/v1/employees/${a.employee.id}/link-user`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ userId: a.user.id });
      expect(firstLink.status).toBe(201);

      // Attempt to link the SAME user to a different employee -> reject
      const duplicateLink = await request(app.getHttpServer())
        .post(`/api/v1/employees/${secondEmployee.id}/link-user`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ userId: a.user.id });
      expect(duplicateLink.status).toBe(409);
    });

    it('the database unique constraint on employees.user_id is actually enforced', async () => {
      const a = await createTenant('Dup10Db', 'full');
      const secondEmployee = await prisma.employee.create({
        data: {
          companyId: a.company.id,
          employeeNumber: 'EMP-DUP-DB-2',
          firstName: 'Second',
          lastName: 'Employee',
        },
      });
      await prisma.employee.update({ where: { id: a.employee.id }, data: { userId: a.user.id } });

      // Bypass the service layer entirely and hit Prisma/Postgres directly
      // to prove the constraint itself — not just app-level validation —
      // is what's actually stopping the duplicate.
      await expect(
        prisma.employee.update({ where: { id: secondEmployee.id }, data: { userId: a.user.id } }),
      ).rejects.toThrow();
    });
  });
});
