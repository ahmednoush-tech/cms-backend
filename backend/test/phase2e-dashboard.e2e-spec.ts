import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Phase 2E — Dashboard (e2e)', () => {
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

  async function createUser(companyId: string, label: string, perms: Array<[string, string, string]>) {
    const role = await prisma.role.create({ data: { companyId, name: `${label} Role` } });
    await grantPermissions(role.id, perms);
    const passwordHash = await bcrypt.hash('TestPassword123!', 4);
    const user = await prisma.user.create({
      data: {
        companyId,
        name: label,
        email: `${label.toLowerCase().replace(/\s/g, '-')}@example.com`,
        passwordHash,
        status: 'active',
      },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'TestPassword123!' });
    return { user, accessToken: login.body.data.accessToken as string };
  }

  const CRM_VIEW: Array<[string, string, string]> = [['CRM', 'customers', 'view']];
  const OPS_VIEW: Array<[string, string, string]> = [['Operations', 'projects', 'view']];

  let seedCallCounter = 0;

  async function seedCompanyData(companyId: string) {
    // customerCode must be unique per (companyId, customerCode) — some
    // tests deliberately call this twice for the SAME companyId (e.g.
    // "B has double the data of A"), so a code derived from companyId
    // alone would collide on the second call. A per-call counter keeps
    // every call's code unique regardless of how many times a given
    // companyId is seeded.
    const seedSuffix = (seedCallCounter++).toString(36);
    const customer = await prisma.customer.create({
      data: { companyId, customerType: 'company', customerCode: `DASH-${companyId.slice(0, 6)}-${seedSuffix}`, companyName: 'Dash Co' },
    });
    await prisma.lead.create({ data: { companyId, name: 'Lead 1', status: 'new' } });
    await prisma.lead.create({ data: { companyId, name: 'Lead 2', status: 'contacted' } });
    const oppWon = await prisma.opportunity.create({
      data: { companyId, customerId: customer.id, name: 'Won deal', stage: 'won', value: '10000' },
    });
    const oppLost = await prisma.opportunity.create({
      data: { companyId, customerId: customer.id, name: 'Lost deal', stage: 'lost', value: '5000' },
    });
    const oppOpen = await prisma.opportunity.create({
      data: { companyId, customerId: customer.id, name: 'Open deal', stage: 'proposal', value: '20000' },
    });
    const employee = await prisma.employee.create({
      data: { companyId, employeeNumber: `DASH-EMP-${companyId.slice(0, 6)}-${seedSuffix}`, firstName: 'Dash', lastName: 'Tech', status: 'active' },
    });
    const project = await prisma.project.create({
      data: { companyId, customerId: customer.id, projectNumber: `DASH-PRJ-${companyId.slice(0, 6)}-${seedSuffix}`, name: 'Dash Project', status: 'in_progress' },
    });
    const workOrder = await prisma.workOrder.create({
      data: {
        companyId,
        projectId: project.id,
        customerId: customer.id,
        workOrderNumber: `DASH-WO-${companyId.slice(0, 6)}-${seedSuffix}`,
        title: 'Dash WO',
        status: 'in_progress',
        assignedToEmployeeId: employee.id,
      },
    });
    await prisma.task.create({
      data: { companyId, projectId: project.id, title: 'Dash Task', status: 'pending', assignedToEmployeeId: employee.id },
    });

    return { customer, employee, project, workOrder, oppWon, oppLost, oppOpen };
  }

  // ============================================================
  // RBAC model: partial vs full vs none
  // ============================================================
  describe('RBAC access model', () => {
    it('a user with CRM view only sees CRM keys on /summary and gets 200; Operations keys are absent, not zero', async () => {
      const company = await prisma.company.create({ data: { name: 'Dash RBAC CRM', status: 'active' } });
      await seedCompanyData(company.id);
      const { accessToken } = await createUser(company.id, 'CrmOnly', CRM_VIEW);

      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/summary')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('totalCustomers');
      expect(res.body.data).not.toHaveProperty('activeProjects');
    });

    it('a user with Operations view only sees Operations keys on /summary; CRM keys absent', async () => {
      const company = await prisma.company.create({ data: { name: 'Dash RBAC Ops', status: 'active' } });
      await seedCompanyData(company.id);
      const { accessToken } = await createUser(company.id, 'OpsOnly', OPS_VIEW);

      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/summary')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('activeProjects');
      expect(res.body.data).not.toHaveProperty('totalCustomers');
    });

    it('a user with both sees the full /summary', async () => {
      const company = await prisma.company.create({ data: { name: 'Dash RBAC Full', status: 'active' } });
      await seedCompanyData(company.id);
      const { accessToken } = await createUser(company.id, 'FullAccess', [...CRM_VIEW, ...OPS_VIEW]);

      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/summary')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('totalCustomers');
      expect(res.body.data).toHaveProperty('activeProjects');
    });

    it('a user with neither CRM nor Operations view access gets 403 on /summary', async () => {
      const company = await prisma.company.create({ data: { name: 'Dash RBAC None', status: 'active' } });
      const { accessToken } = await createUser(company.id, 'NoAccess', []);

      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/summary')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(403);
    });

    it('CRM-only user gets 403 on /operations and /workload', async () => {
      const company = await prisma.company.create({ data: { name: 'Dash RBAC CrmBlocked', status: 'active' } });
      const { accessToken } = await createUser(company.id, 'CrmBlocked', CRM_VIEW);

      const opsRes = await request(app.getHttpServer())
        .get('/api/v1/dashboard/operations')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(opsRes.status).toBe(403);

      const workloadRes = await request(app.getHttpServer())
        .get('/api/v1/dashboard/workload')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(workloadRes.status).toBe(403);
    });

    it('Operations-only user gets 403 on /sales', async () => {
      const company = await prisma.company.create({ data: { name: 'Dash RBAC OpsBlocked', status: 'active' } });
      const { accessToken } = await createUser(company.id, 'OpsBlocked', OPS_VIEW);

      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/sales')
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(403);
    });

    it('missing authentication returns 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/dashboard/summary');
      expect(res.status).toBe(401);
    });

    it('a customer-portal identity is rejected from every Dashboard route (internal-only)', async () => {
      const company = await prisma.company.create({ data: { name: 'Dash RBAC Portal', status: 'active' } });
      const customer = await prisma.customer.create({
        data: { companyId: company.id, customerType: 'company', customerCode: 'PORTAL-DASH' },
      });
      const passwordHash = await bcrypt.hash('TestPassword123!', 4);
      const portalUser = await prisma.user.create({
        data: { companyId: company.id, name: 'Portal', email: 'dash-portal@example.com', passwordHash, status: 'active' },
      });
      await prisma.customerUser.create({
        data: { companyId: company.id, customerId: customer.id, userId: portalUser.id, status: 'active' },
      });
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: portalUser.email, password: 'TestPassword123!' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/summary')
        .set('Authorization', `Bearer ${login.body.data.accessToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ============================================================
  // Tenant isolation
  // ============================================================
  describe('tenant isolation', () => {
    it("Company A's KPIs never include Company B's data", async () => {
      const companyA = await prisma.company.create({ data: { name: 'Dash Iso A', status: 'active' } });
      const companyB = await prisma.company.create({ data: { name: 'Dash Iso B', status: 'active' } });
      await seedCompanyData(companyA.id);
      await seedCompanyData(companyB.id);
      await seedCompanyData(companyB.id); // B has double the data of A

      const { accessToken } = await createUser(companyA.id, 'IsoUser', [...CRM_VIEW, ...OPS_VIEW]);
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/summary')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalCustomers).toBe(1); // only A's single customer, not A+B's three
    });

    it('rejects a cross-company customerId filter', async () => {
      const companyA = await prisma.company.create({ data: { name: 'Dash FilterIso A', status: 'active' } });
      const companyB = await prisma.company.create({ data: { name: 'Dash FilterIso B', status: 'active' } });
      const { customer: customerB } = await seedCompanyData(companyB.id);
      const { accessToken } = await createUser(companyA.id, 'FilterIsoUser', CRM_VIEW);

      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard/sales')
        .query({ customerId: customerB.id })
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(404);
    });
  });

  // ============================================================
  // Zero-filled status breakdowns
  // ============================================================
  it('status breakdowns are zero-filled for every valid enum value, not just populated ones', async () => {
    const company = await prisma.company.create({ data: { name: 'Dash ZeroFill', status: 'active' } });
    await seedCompanyData(company.id); // only creates a 'new' and 'contacted' lead
    const { accessToken } = await createUser(company.id, 'ZeroFillUser', CRM_VIEW);

    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard/sales')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.body.data.leadsByStatus).toEqual({
      new: 1,
      contacted: 1,
      qualified: 0,
      proposal: 0,
      won: 0,
      lost: 0,
    });
  });

  // ============================================================
  // Conversion rate
  // ============================================================
  it('conversion rate reflects won/(won+lost) from seeded data', async () => {
    const company = await prisma.company.create({ data: { name: 'Dash Conversion', status: 'active' } });
    await seedCompanyData(company.id); // 1 won, 1 lost, 1 open
    const { accessToken } = await createUser(company.id, 'ConversionUser', CRM_VIEW);

    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard/sales')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.body.data.conversionRate).toBe(0.5);
  });

  // ============================================================
  // Workload — no double counting
  // ============================================================
  it('workload keeps the three concepts separate and correctly summed', async () => {
    const company = await prisma.company.create({ data: { name: 'Dash Workload', status: 'active' } });
    const { employee } = await seedCompanyData(company.id); // 1 open task + 1 open work order for this employee
    const { accessToken } = await createUser(company.id, 'WorkloadUser', OPS_VIEW);

    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard/workload')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.body.data.openTasksByEmployee[employee.id]).toBe(1);
    expect(res.body.data.openWorkOrdersByEmployee[employee.id]).toBe(1);
    expect(res.body.data.totalOpenAssignmentsByEmployee[employee.id]).toBe(2);
  });

  // ============================================================
  // Empty datasets
  // ============================================================
  it('a freshly created company with zero of everything returns valid zero/empty shapes, never 500', async () => {
    const company = await prisma.company.create({ data: { name: 'Dash Empty', status: 'active' } });
    const { accessToken } = await createUser(company.id, 'EmptyUser', [...CRM_VIEW, ...OPS_VIEW]);

    const summary = await request(app.getHttpServer())
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(summary.status).toBe(200);
    expect(summary.body.data.totalCustomers).toBe(0);
    expect(summary.body.data.pipelineValue).toBe('0.00');

    const sales = await request(app.getHttpServer())
      .get('/api/v1/dashboard/sales')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(sales.status).toBe(200);
    expect(sales.body.data.leadsByStatus).toEqual({ new: 0, contacted: 0, qualified: 0, proposal: 0, won: 0, lost: 0 });
    expect(sales.body.data.conversionRate).toBe(0);

    const workload = await request(app.getHttpServer())
      .get('/api/v1/dashboard/workload')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(workload.status).toBe(200);
    expect(workload.body.data.openTasksByEmployee).toEqual({});
  });

  // ============================================================
  // Date range filter
  // ============================================================
  it('date range filter narrows New Leads to leads created within the window', async () => {
    const company = await prisma.company.create({ data: { name: 'Dash DateRange', status: 'active' } });
    const { accessToken } = await createUser(company.id, 'DateRangeUser', CRM_VIEW);

    await prisma.lead.create({ data: { companyId: company.id, name: 'Old Lead', createdAt: new Date('2020-01-01') } });
    await prisma.lead.create({ data: { companyId: company.id, name: 'Recent Lead', createdAt: new Date() } });

    const res = await request(app.getHttpServer())
      .get('/api/v1/dashboard/summary')
      .query({ dateFrom: '2026-01-01', dateTo: '2026-12-31' })
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.body.data.newLeads).toBe(1); // only the recent one, not the 2020 one
  });
});
