import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Phase 2F — V1 Hardening / P2 Fixes regression suite.
 * Covers, at the HTTP level, all four fixes from this phase:
 *   1. Customer Contacts / Customer Users activity logging
 *   2. Accepted quotation -> at most one project
 *   3. Customer soft-delete blocked by active projects
 *   4. Employee manager cycle detection
 */
describe('Phase 2F — P2 fixes (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function grantPermissions(roleId: string, perms: Array<[string, string, string]>) {
    const created = await Promise.all(
      perms.map(([module, resource, action]) =>
        prisma.permission.upsert({
          where: { module_resource_action: { module, resource, action } },
          create: { module, resource, action },
          update: {},
        }),
      ),
    );
    await Promise.all(
      created.map((p) =>
        prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId, permissionId: p.id } },
          create: { roleId, permissionId: p.id },
          update: {},
        }),
      ),
    );
  }

  const CRM_FULL: Array<[string, string, string]> = [
    ['CRM', 'customers', 'view'],
    ['CRM', 'customers', 'create'],
    ['CRM', 'customers', 'edit'],
    ['CRM', 'customers', 'delete'],
    ['CRM', 'quotations', 'view'],
    ['CRM', 'quotations', 'create'],
  ];
  const OPS_FULL: Array<[string, string, string]> = [
    ['Operations', 'projects', 'view'],
    ['Operations', 'projects', 'create'],
    ['Operations', 'projects', 'edit'],
    ['Operations', 'projects', 'delete'],
  ];
  const ADMIN_EMPLOYEES: Array<[string, string, string]> = [
    ['Administration', 'employees', 'view'],
    ['Administration', 'employees', 'create'],
    ['Administration', 'employees', 'edit'],
  ];

  async function createTenant(label: string, perms: Array<[string, string, string]>) {
    const company = await prisma.company.create({ data: { name: `${label} Co.`, status: 'active' } });
    const role = await prisma.role.create({ data: { companyId: company.id, name: `${label} Role` } });
    await grantPermissions(role.id, perms);

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

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'TestPassword123!' });

    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerType: 'company',
        customerCode: `P2F-${label.toUpperCase().replace(/\s/g, '')}`,
        companyName: `${label} Customer`,
      },
    });

    return { company, user, customer, accessToken: login.body.data.accessToken as string };
  }

  // ============================================================
  // 1. Customer Contacts / Customer Users activity logging
  // ============================================================
  describe('Customer Contacts / Customer Users activity logging', () => {
    it('creating a contact writes an activity_logs row under entityType "customer"', async () => {
      const a = await createTenant('P2F Contact Log', CRM_FULL);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/${a.customer.id}/contacts`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ name: 'Logged Contact' });
      expect(res.status).toBe(201);

      const logs = await prisma.activityLog.findMany({
        where: { companyId: a.company.id, entityType: 'customer', entityId: a.customer.id, action: 'contact_added' },
      });
      expect(logs.length).toBe(1);
    });

    it('updating and removing a contact each write their own activity_logs row', async () => {
      const a = await createTenant('P2F Contact Log Upd', CRM_FULL);
      const createRes = await request(app.getHttpServer())
        .post(`/api/v1/customers/${a.customer.id}/contacts`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ name: 'To Update' });
      const contactId = createRes.body.data.id;

      await request(app.getHttpServer())
        .patch(`/api/v1/customers/${a.customer.id}/contacts/${contactId}`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ name: 'Updated Name' });

      await request(app.getHttpServer())
        .delete(`/api/v1/customers/${a.customer.id}/contacts/${contactId}`)
        .set('Authorization', `Bearer ${a.accessToken}`);

      const actions = (
        await prisma.activityLog.findMany({
          where: { companyId: a.company.id, entityType: 'customer', entityId: a.customer.id },
          orderBy: { createdAt: 'asc' },
        })
      ).map((l) => l.action);

      expect(actions).toContain('contact_added');
      expect(actions).toContain('contact_updated');
      expect(actions).toContain('contact_removed');
    });

    it('creating a portal user writes an activity_logs row', async () => {
      const a = await createTenant('P2F Portal Log', CRM_FULL);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/${a.customer.id}/portal-users`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ name: 'Portal', email: 'p2f-portal@example.com', password: 'TestPassword123!' });
      expect(res.status).toBe(201);

      const logs = await prisma.activityLog.findMany({
        where: {
          companyId: a.company.id,
          entityType: 'customer',
          entityId: a.customer.id,
          action: 'portal_user_created',
        },
      });
      expect(logs.length).toBe(1);
    });

    it('revoking portal access writes an activity_logs row', async () => {
      const a = await createTenant('P2F Portal Revoke Log', CRM_FULL);
      const createRes = await request(app.getHttpServer())
        .post(`/api/v1/customers/${a.customer.id}/portal-users`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ name: 'Portal', email: 'p2f-revoke@example.com', password: 'TestPassword123!' });

      await request(app.getHttpServer())
        .delete(`/api/v1/customers/${a.customer.id}/portal-users/${createRes.body.data.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`);

      const logs = await prisma.activityLog.findMany({
        where: {
          companyId: a.company.id,
          entityType: 'customer',
          entityId: a.customer.id,
          action: 'portal_user_revoked',
        },
      });
      expect(logs.length).toBe(1);
    });

    it('activity logs from one company are never visible when queried under another tenant scope', async () => {
      const a = await createTenant('P2F Log Tenant A', CRM_FULL);
      const b = await createTenant('P2F Log Tenant B', CRM_FULL);

      await request(app.getHttpServer())
        .post(`/api/v1/customers/${a.customer.id}/contacts`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ name: 'A Contact' });

      const bLogs = await prisma.activityLog.findMany({ where: { companyId: b.company.id, action: 'contact_added' } });
      expect(bLogs.length).toBe(0);
    });
  });

  // ============================================================
  // 2. Accepted quotation -> at most one project
  // ============================================================
  describe('accepted quotation cannot be linked to more than one project', () => {
    it('the first project link succeeds; a second attempt is rejected with 409', async () => {
      const a = await createTenant('P2F Quote Dup', [...CRM_FULL, ...OPS_FULL]);
      const quotation = await prisma.quotation.create({
        data: {
          companyId: a.company.id,
          customerId: a.customer.id,
          quotationNumber: 'P2F-Q-DUP',
          status: 'accepted',
        },
      });

      const first = await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ customerId: a.customer.id, name: 'First Project', quotationId: quotation.id });
      expect(first.status).toBe(201);

      const second = await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ customerId: a.customer.id, name: 'Second Project', quotationId: quotation.id });
      expect(second.status).toBe(409);
    });

    it('linking a fresh accepted quotation to a project still succeeds normally', async () => {
      const a = await createTenant('P2F Quote Fresh', [...CRM_FULL, ...OPS_FULL]);
      const quotation = await prisma.quotation.create({
        data: {
          companyId: a.company.id,
          customerId: a.customer.id,
          quotationNumber: 'P2F-Q-FRESH',
          status: 'accepted',
        },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ customerId: a.customer.id, name: 'Fresh Project', quotationId: quotation.id });
      expect(res.status).toBe(201);
      expect(res.body.data.quotationId).toBe(quotation.id);
    });

    it('a soft-deleted project holding a quotation link does not block reuse of that quotation', async () => {
      const a = await createTenant('P2F Quote Deleted Proj', [...CRM_FULL, ...OPS_FULL]);
      const quotation = await prisma.quotation.create({
        data: {
          companyId: a.company.id,
          customerId: a.customer.id,
          quotationNumber: 'P2F-Q-DELETED',
          status: 'accepted',
        },
      });
      const firstProject = await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ customerId: a.customer.id, name: 'To Be Deleted', quotationId: quotation.id });

      const del = await request(app.getHttpServer())
        .delete(`/api/v1/projects/${firstProject.body.data.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(del.status).toBe(200);

      const second = await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ customerId: a.customer.id, name: 'Reuse After Delete', quotationId: quotation.id });
      expect(second.status).toBe(201);
    });
  });

  // ============================================================
  // 3. Customer soft-delete blocked by active projects
  // ============================================================
  describe('customer soft-delete blocked by active projects', () => {
    it('cannot delete a customer with an in_progress project', async () => {
      const a = await createTenant('P2F Cust Del Blocked', [...CRM_FULL, ...OPS_FULL]);
      const project = await prisma.project.create({
        data: {
          companyId: a.company.id,
          customerId: a.customer.id,
          projectNumber: 'P2F-CUST-BLOCK',
          name: 'Active Work',
          status: 'in_progress',
        },
      });

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/customers/${a.customer.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(422);

      const stillThere = await prisma.customer.findUnique({ where: { id: a.customer.id } });
      expect(stillThere?.deletedAt).toBeNull();
      expect((await prisma.project.findUnique({ where: { id: project.id } }))?.deletedAt).toBeNull();
    });

    it('can delete a customer whose only projects are completed/cancelled', async () => {
      const a = await createTenant('P2F Cust Del Allowed', [...CRM_FULL, ...OPS_FULL]);
      await prisma.project.create({
        data: {
          companyId: a.company.id,
          customerId: a.customer.id,
          projectNumber: 'P2F-CUST-DONE',
          name: 'Finished Work',
          status: 'completed',
        },
      });
      await prisma.project.create({
        data: {
          companyId: a.company.id,
          customerId: a.customer.id,
          projectNumber: 'P2F-CUST-CANCELLED',
          name: 'Abandoned Work',
          status: 'cancelled',
        },
      });

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/customers/${a.customer.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(200);
    });

    it('can delete a customer with no projects at all', async () => {
      const a = await createTenant('P2F Cust Del NoProj', CRM_FULL);
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/customers/${a.customer.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(200);
    });

    it.each(['planning', 'approved', 'on_hold'])(
      'blocks deletion for a %s-status project too, not just in_progress',
      async (status) => {
        const a = await createTenant(`P2F Cust Del ${status}`, [...CRM_FULL, ...OPS_FULL]);
        await prisma.project.create({
          data: {
            companyId: a.company.id,
            customerId: a.customer.id,
            projectNumber: `P2F-CUST-${status.toUpperCase()}`,
            name: 'X',
            status,
          },
        });

        const res = await request(app.getHttpServer())
          .delete(`/api/v1/customers/${a.customer.id}`)
          .set('Authorization', `Bearer ${a.accessToken}`);
        expect(res.status).toBe(422);
      },
    );

    it('Company A cannot have its customer-delete blocked by a Company B project (tenant isolation)', async () => {
      const a = await createTenant('P2F Cust Del TenantA', CRM_FULL);
      const b = await createTenant('P2F Cust Del TenantB', OPS_FULL);
      await prisma.project.create({
        data: {
          companyId: b.company.id,
          customerId: b.customer.id,
          projectNumber: 'P2F-CUST-TENANT-B',
          name: 'B project',
          status: 'in_progress',
        },
      });

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/customers/${a.customer.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(200);
    });
  });

  // ============================================================
  // 4. Employee manager cycle detection
  // ============================================================
  describe('employee manager cycle detection', () => {
    async function createEmployee(companyId: string, employeeNumber: string) {
      return prisma.employee.create({
        data: { companyId, employeeNumber, firstName: 'X', lastName: employeeNumber, status: 'active' },
      });
    }

    it('still blocks direct self-management', async () => {
      const a = await createTenant('P2F Mgr Self', ADMIN_EMPLOYEES);
      const emp = await createEmployee(a.company.id, 'P2F-SELF');

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/employees/${emp.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ managerId: emp.id });
      expect(res.status).toBe(400);
    });

    it('blocks a direct 2-cycle (A -> B, then B -> A)', async () => {
      const a = await createTenant('P2F Mgr Direct Cycle', ADMIN_EMPLOYEES);
      const empA = await createEmployee(a.company.id, 'P2F-CYCLE-A');
      const empB = await createEmployee(a.company.id, 'P2F-CYCLE-B');

      const step1 = await request(app.getHttpServer())
        .patch(`/api/v1/employees/${empA.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ managerId: empB.id });
      expect(step1.status).toBe(200);

      const step2 = await request(app.getHttpServer())
        .patch(`/api/v1/employees/${empB.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ managerId: empA.id });
      expect(step2.status).toBe(422);
    });

    it('blocks an indirect 3-link cycle (A -> B -> C -> A)', async () => {
      const a = await createTenant('P2F Mgr Indirect Cycle', ADMIN_EMPLOYEES);
      const empA = await createEmployee(a.company.id, 'P2F-3CYCLE-A');
      const empB = await createEmployee(a.company.id, 'P2F-3CYCLE-B');
      const empC = await createEmployee(a.company.id, 'P2F-3CYCLE-C');

      await request(app.getHttpServer())
        .patch(`/api/v1/employees/${empB.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ managerId: empC.id });
      await request(app.getHttpServer())
        .patch(`/api/v1/employees/${empC.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ managerId: empA.id });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/employees/${empA.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ managerId: empB.id });
      expect(res.status).toBe(422);
    });

    it('allows a valid, non-circular management chain', async () => {
      const a = await createTenant('P2F Mgr Valid Chain', ADMIN_EMPLOYEES);
      const empA = await createEmployee(a.company.id, 'P2F-VALID-A');
      const empB = await createEmployee(a.company.id, 'P2F-VALID-B');
      const empC = await createEmployee(a.company.id, 'P2F-VALID-C');

      await request(app.getHttpServer())
        .patch(`/api/v1/employees/${empB.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ managerId: empC.id });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/employees/${empA.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ managerId: empB.id });
      expect(res.status).toBe(200);
    });

    it('still rejects a cross-company manager assignment (preserved, unrelated to cycle logic)', async () => {
      const a = await createTenant('P2F Mgr CrossCo A', ADMIN_EMPLOYEES);
      const b = await createTenant('P2F Mgr CrossCo B', ADMIN_EMPLOYEES);
      const empA = await createEmployee(a.company.id, 'P2F-CROSSCO-A');
      const empBOther = await createEmployee(b.company.id, 'P2F-CROSSCO-B');

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/employees/${empA.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ managerId: empBOther.id });
      expect(res.status).toBe(400);
    });
  });
});
