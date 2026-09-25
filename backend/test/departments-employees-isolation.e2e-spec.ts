import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Extends the Phase 2A security suite to cover the two new
 * Phase 2B resources: Departments and Employees. Same tenant-
 * isolation guarantee as before, now proven end-to-end through
 * the new controllers.
 */
describe('Departments & Employees tenant isolation (e2e)', () => {
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

  async function createAdminWithFullAccess(label: string) {
    const company = await prisma.company.create({ data: { name: `${label} Co.`, status: 'active' } });
    const role = await prisma.role.create({ data: { companyId: company.id, name: 'Super Admin' } });

    const perms = await Promise.all(
      [
        ['Administration', 'departments', 'view'],
        ['Administration', 'departments', 'create'],
        ['Administration', 'employees', 'view'],
        ['Administration', 'employees', 'create'],
      ].map(([module, resource, action]) =>
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
          where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
          create: { roleId: role.id, permissionId: p.id },
          update: {},
        }),
      ),
    );

    const passwordHash = await bcrypt.hash('TestPassword123!', 4);
    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        name: `${label} Admin`,
        email: `${label.toLowerCase()}-dept-admin@example.com`,
        passwordHash,
        status: 'active',
      },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'TestPassword123!' });

    return { company, accessToken: login.body.data.accessToken };
  }

  it('Company A cannot fetch a department belonging to Company B', async () => {
    const companyA = await createAdminWithFullAccess('DeptTenantA');
    const companyB = await createAdminWithFullAccess('DeptTenantB');

    const deptB = await prisma.department.create({
      data: { companyId: companyB.company.id, name: 'Finance (B)' },
    });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/departments/${deptB.id}`)
      .set('Authorization', `Bearer ${companyA.accessToken}`);

    expect(response.status).toBe(404);
  });

  it('Company A cannot fetch an employee belonging to Company B', async () => {
    const companyA = await createAdminWithFullAccess('EmpTenantA');
    const companyB = await createAdminWithFullAccess('EmpTenantB');

    const employeeB = await prisma.employee.create({
      data: {
        companyId: companyB.company.id,
        employeeNumber: 'EMP-B-001',
        firstName: 'Company B',
        lastName: 'Employee',
      },
    });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/employees/${employeeB.id}`)
      .set('Authorization', `Bearer ${companyA.accessToken}`);

    expect(response.status).toBe(404);
  });

  it('rejects creating a department with a managerId from another tenant', async () => {
    const companyA = await createAdminWithFullAccess('CrossTenantA');
    const companyB = await createAdminWithFullAccess('CrossTenantB');

    const managerInB = await prisma.employee.create({
      data: {
        companyId: companyB.company.id,
        employeeNumber: 'EMP-B-MGR',
        firstName: 'Cross',
        lastName: 'Tenant',
      },
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${companyA.accessToken}`)
      .send({ name: 'Suspicious Dept', managerId: managerInB.id });

    expect(response.status).toBe(400);
  });
});
