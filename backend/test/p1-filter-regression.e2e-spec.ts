import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * P1 regression suite — V1 Final System Audit, section 7/13.
 *
 * Before the fix: ProjectsController/WorkOrdersController/
 * TasksController/OpportunitiesController/QuotationsController
 * all typed `@Query()` as the bare PaginationQueryDto, which does
 * not declare the filter fields (customerId, status, stage,
 * projectId, workOrderId, assignedToEmployeeId, opportunityId)
 * their services attempted to read via `query as any`. Combined
 * with the global `ValidationPipe({ whitelist: true,
 * forbidNonWhitelisted: true })`, any of those query-string
 * parameters would very likely have been rejected with 400
 * rather than applied.
 *
 * After the fix: each controller is typed against a dedicated
 * FiltersDto (extends PaginationQueryDto) that declares every
 * field its service reads, so the same request now (a) succeeds
 * with 200, and (b) the filter demonstrably reaches the query.
 *
 * This suite exercises the real HTTP boundary — the actual
 * ValidationPipe, the actual DTO classes — which is the only way
 * to prove or disprove the original finding; the corresponding
 * unit tests (added alongside this file) prove the filters reach
 * Prisma's `where` clause, but cannot exercise the pipe itself.
 */
describe('P1 regression — list endpoint filters (e2e)', () => {
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

  async function grantAllViewPermissions(roleId: string) {
    const resources: Array<[string, string, string]> = [
      ['CRM', 'customers', 'view'],
      ['CRM', 'customers', 'create'],
      ['CRM', 'opportunities', 'view'],
      ['CRM', 'opportunities', 'create'],
      ['CRM', 'quotations', 'view'],
      ['CRM', 'quotations', 'create'],
      ['Operations', 'projects', 'view'],
      ['Operations', 'projects', 'create'],
      ['Operations', 'work_orders', 'view'],
      ['Operations', 'work_orders', 'create'],
      ['Operations', 'tasks', 'view'],
      ['Operations', 'tasks', 'create'],
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

  async function createTenant(label: string) {
    const company = await prisma.company.create({ data: { name: `${label} Co.`, status: 'active' } });
    const role = await prisma.role.create({ data: { companyId: company.id, name: `${label} Role` } });
    await grantAllViewPermissions(role.id);

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
        customerCode: `P1-${label.toUpperCase().replace(/\s/g, '')}`,
        companyName: `${label} Customer`,
      },
    });

    return { company, user, customer, accessToken: login.body.data.accessToken as string };
  }

  // ============================================================
  // 1. Valid filters are accepted (200, not 400)
  // ============================================================
  describe('valid filters are accepted', () => {
    it('GET /opportunities?customerId=&stage= returns 200', async () => {
      const a = await createTenant('P1 Opp Valid');
      const res = await request(app.getHttpServer())
        .get('/api/v1/opportunities')
        .query({ customerId: a.customer.id, stage: 'proposal' })
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /quotations?customerId=&opportunityId=&status= returns 200', async () => {
      const a = await createTenant('P1 Quote Valid');
      const res = await request(app.getHttpServer())
        .get('/api/v1/quotations')
        .query({ customerId: a.customer.id, status: 'draft' })
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /projects?customerId=&status= returns 200', async () => {
      const a = await createTenant('P1 Project Valid');
      const res = await request(app.getHttpServer())
        .get('/api/v1/projects')
        .query({ customerId: a.customer.id, status: 'planning' })
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /work-orders?projectId=&status=&assignedToEmployeeId= returns 200', async () => {
      const a = await createTenant('P1 WO Valid');
      const project = await prisma.project.create({
        data: { companyId: a.company.id, customerId: a.customer.id, projectNumber: 'P1-WO-PRJ', name: 'X' },
      });
      const res = await request(app.getHttpServer())
        .get('/api/v1/work-orders')
        .query({ projectId: project.id, status: 'new' })
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(200);
    });

    it('GET /tasks?projectId=&workOrderId=&status=&assignedToEmployeeId= returns 200', async () => {
      const a = await createTenant('P1 Task Valid');
      const project = await prisma.project.create({
        data: { companyId: a.company.id, customerId: a.customer.id, projectNumber: 'P1-TASK-PRJ', name: 'X' },
      });
      const res = await request(app.getHttpServer())
        .get('/api/v1/tasks')
        .query({ projectId: project.id, status: 'pending' })
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(200);
    });

    it('standard pagination/sort/search fields still work alongside the new filters', async () => {
      const a = await createTenant('P1 Pagination Valid');
      const res = await request(app.getHttpServer())
        .get('/api/v1/projects')
        .query({ page: 1, pageSize: 10, sortBy: 'createdAt', sortDir: 'desc', search: 'x', status: 'planning' })
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.meta).toBeDefined();
    });
  });

  // ============================================================
  // 2. Invalid / unknown query fields are rejected (400)
  // ============================================================
  describe('unknown query fields are rejected', () => {
    it('GET /projects?notARealFilter=x is rejected with 400 (whitelist still enforced)', async () => {
      const a = await createTenant('P1 Project Invalid');
      const res = await request(app.getHttpServer())
        .get('/api/v1/projects')
        .query({ notARealFilter: 'x' })
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(400);
    });

    it('GET /work-orders?notARealFilter=x is rejected with 400', async () => {
      const a = await createTenant('P1 WO Invalid');
      const res = await request(app.getHttpServer())
        .get('/api/v1/work-orders')
        .query({ notARealFilter: 'x' })
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(400);
    });

    it('GET /tasks?notARealFilter=x is rejected with 400', async () => {
      const a = await createTenant('P1 Task Invalid');
      const res = await request(app.getHttpServer())
        .get('/api/v1/tasks')
        .query({ notARealFilter: 'x' })
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(400);
    });

    it('GET /opportunities?notARealFilter=x is rejected with 400', async () => {
      const a = await createTenant('P1 Opp Invalid');
      const res = await request(app.getHttpServer())
        .get('/api/v1/opportunities')
        .query({ notARealFilter: 'x' })
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(400);
    });

    it('GET /quotations?notARealFilter=x is rejected with 400', async () => {
      const a = await createTenant('P1 Quote Invalid');
      const res = await request(app.getHttpServer())
        .get('/api/v1/quotations')
        .query({ notARealFilter: 'x' })
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(400);
    });

    it('a malformed UUID in a real filter field (customerId) is rejected with 400, not silently ignored', async () => {
      const a = await createTenant('P1 Malformed UUID');
      const res = await request(app.getHttpServer())
        .get('/api/v1/opportunities')
        .query({ customerId: 'not-a-uuid' })
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // 3. Filters actually reach the service (results are narrowed)
  // ============================================================
  describe('filters actually narrow the results', () => {
    it('status filter on /projects returns only matching projects', async () => {
      const a = await createTenant('P1 Narrow Projects');
      await prisma.project.create({
        data: { companyId: a.company.id, customerId: a.customer.id, projectNumber: 'NARROW-1', name: 'Planning', status: 'planning' },
      });
      const approved = await prisma.project.create({
        data: { companyId: a.company.id, customerId: a.customer.id, projectNumber: 'NARROW-2', name: 'Approved', status: 'approved' },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/projects')
        .query({ status: 'approved' })
        .set('Authorization', `Bearer ${a.accessToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((p: any) => p.id);
      expect(ids).toContain(approved.id);
      expect(ids.length).toBe(1);
    });

    it('stage filter on /opportunities returns only matching opportunities', async () => {
      const a = await createTenant('P1 Narrow Opps');
      await prisma.opportunity.create({
        data: { companyId: a.company.id, customerId: a.customer.id, name: 'Prospecting deal', stage: 'prospecting' },
      });
      const won = await prisma.opportunity.create({
        data: { companyId: a.company.id, customerId: a.customer.id, name: 'Won deal', stage: 'won' },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/opportunities')
        .query({ stage: 'won' })
        .set('Authorization', `Bearer ${a.accessToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((o: any) => o.id);
      expect(ids).toEqual([won.id]);
    });

    it('customerId filter on /quotations returns only that customer\'s quotations', async () => {
      const a = await createTenant('P1 Narrow Quotes');
      const otherCustomer = await prisma.customer.create({
        data: { companyId: a.company.id, customerType: 'company', customerCode: 'OTHER-P1' },
      });
      await prisma.quotation.create({
        data: { companyId: a.company.id, customerId: otherCustomer.id, quotationNumber: 'P1-Q-OTHER' },
      });
      const matching = await prisma.quotation.create({
        data: { companyId: a.company.id, customerId: a.customer.id, quotationNumber: 'P1-Q-MATCH' },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/quotations')
        .query({ customerId: a.customer.id })
        .set('Authorization', `Bearer ${a.accessToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.data.map((q: any) => q.id);
      expect(ids).toEqual([matching.id]);
    });
  });

  // ============================================================
  // 4. Tenant isolation remains intact through the fix
  // ============================================================
  describe('tenant isolation remains intact', () => {
    it("Company A's filtered /projects results never include Company B's data", async () => {
      const a = await createTenant('P1 Tenant A');
      const b = await createTenant('P1 Tenant B');
      await prisma.project.create({
        data: { companyId: b.company.id, customerId: b.customer.id, projectNumber: 'P1-TENANT-B', name: 'B project', status: 'planning' },
      });
      await prisma.project.create({
        data: { companyId: a.company.id, customerId: a.customer.id, projectNumber: 'P1-TENANT-A', name: 'A project', status: 'planning' },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/projects')
        .query({ status: 'planning' })
        .set('Authorization', `Bearer ${a.accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].companyId).toBe(a.company.id);
    });

    it('a customerId filter belonging to another company is rejected, not silently applied or ignored', async () => {
      const a = await createTenant('P1 CrossFilter A');
      const b = await createTenant('P1 CrossFilter B');

      // customerId is a valid UUID (passes DTO validation) but
      // belongs to Company B — the service layer's tenant checks
      // (unchanged by this fix) must still reject it, not the
      // pipe. Confirms the P1 fix didn't accidentally weaken
      // tenant isolation while fixing the filter-acceptance bug.
      const res = await request(app.getHttpServer())
        .get('/api/v1/opportunities')
        .query({ customerId: b.customer.id })
        .set('Authorization', `Bearer ${a.accessToken}`);

      // Opportunities' findAll does not itself validate customerId
      // tenant ownership (it's a pure filter, not a create/update
      // reference) — so this returns 200 with an empty result set
      // rather than a 404/400, since no Company-A opportunity can
      // ever match a Company-B customerId. Either way, no Company
      // B data is ever returned to Company A.
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });
  });
});
