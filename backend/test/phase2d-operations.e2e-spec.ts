import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Phase 2D — Operations (e2e)', () => {
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

  async function grantAllOperationsPermissions(roleId: string) {
    const resources: Array<[string, string, string]> = [
      ['CRM', 'customers', 'view'],
      ['CRM', 'customers', 'create'],
      ['Operations', 'projects', 'view'],
      ['Operations', 'projects', 'create'],
      ['Operations', 'projects', 'edit'],
      ['Operations', 'projects', 'delete'],
      ['Operations', 'projects', 'assign'],
      ['Operations', 'work_orders', 'view'],
      ['Operations', 'work_orders', 'create'],
      ['Operations', 'work_orders', 'edit'],
      ['Operations', 'work_orders', 'delete'],
      ['Operations', 'work_orders', 'assign'],
      ['Operations', 'tasks', 'view'],
      ['Operations', 'tasks', 'create'],
      ['Operations', 'tasks', 'edit'],
      ['Operations', 'tasks', 'delete'],
      ['Operations', 'tasks', 'assign'],
      ['Operations', 'project_members', 'view'],
      ['Operations', 'project_members', 'manage'],
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
    await grantAllOperationsPermissions(role.id);

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
        companyName: `${label} Customer`,
        customerCode: `${label.toUpperCase().replace(/\s/g, '')}-CUST`,
      },
    });

    const activeEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeNumber: `${label.toUpperCase().replace(/\s/g, '')}-EMP-1`,
        firstName: label,
        lastName: 'Technician',
        status: 'active',
      },
    });

    const terminatedEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeNumber: `${label.toUpperCase().replace(/\s/g, '')}-EMP-2`,
        firstName: label,
        lastName: 'FormerEmployee',
        status: 'terminated',
        deletedAt: new Date(),
      },
    });

    return { company, user, customer, activeEmployee, terminatedEmployee, accessToken: login.body.data.accessToken as string };
  }

  async function createProject(a: Awaited<ReturnType<typeof createTenant>>, overrides: Record<string, unknown> = {}) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ customerId: a.customer.id, name: 'Test Project', ...overrides });
    return res.body.data;
  }

  // ============================================================
  // Tenant isolation / cross-company references
  // ============================================================
  describe('tenant isolation', () => {
    it('Company A cannot read a Company B project', async () => {
      const a = await createTenant('OpsIsoA');
      const b = await createTenant('OpsIsoB');
      const projectB = await createProject(b);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${projectB.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(404);
    });

    it('Company A cannot create a work order under a Company B project', async () => {
      const a = await createTenant('OpsIsoWoA');
      const b = await createTenant('OpsIsoWoB');
      const projectB = await createProject(b);

      const res = await request(app.getHttpServer())
        .post('/api/v1/work-orders')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ projectId: projectB.id, title: 'Should fail' });
      expect(res.status).toBe(404);
    });

    it('Company A cannot assign a Company B employee to a Company A work order', async () => {
      const a = await createTenant('OpsIsoAssignA');
      const b = await createTenant('OpsIsoAssignB');
      const projectA = await createProject(a);
      const woRes = await request(app.getHttpServer())
        .post('/api/v1/work-orders')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ projectId: projectA.id, title: 'WO' });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/work-orders/${woRes.body.data.id}/assign`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ employeeId: b.activeEmployee.id });
      expect(res.status).toBe(400);
    });

    it('Company A cannot add a Company B employee as a project member', async () => {
      const a = await createTenant('OpsIsoMemberA');
      const b = await createTenant('OpsIsoMemberB');
      const projectA = await createProject(a);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${projectA.id}/members`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ employeeId: b.activeEmployee.id, role: 'technician' });
      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // Project/customer/quotation consistency + critical decision
  // ============================================================
  describe('project/customer/quotation consistency', () => {
    it('allows a manually-created project with no quotation (critical design decision)', async () => {
      const a = await createTenant('OpsManual');
      const res = await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ customerId: a.customer.id, name: 'Manual Project' });
      expect(res.status).toBe(201);
      expect(res.body.data.quotationId).toBeNull();
    });

    it('rejects a project referencing a non-accepted quotation', async () => {
      const a = await createTenant('OpsQuoteDraft');
      const quotation = await prisma.quotation.create({
        data: { companyId: a.company.id, customerId: a.customer.id, quotationNumber: 'QTN-TEST-1', status: 'draft' },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ customerId: a.customer.id, name: 'X', quotationId: quotation.id });
      expect(res.status).toBe(400);
    });

    it('accepts a project referencing an accepted quotation for the same customer', async () => {
      const a = await createTenant('OpsQuoteAccepted');
      const quotation = await prisma.quotation.create({
        data: { companyId: a.company.id, customerId: a.customer.id, quotationNumber: 'QTN-TEST-2', status: 'accepted' },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ customerId: a.customer.id, name: 'X', quotationId: quotation.id });
      expect(res.status).toBe(201);
    });

    it('rejects a quotation belonging to a different customer than the project', async () => {
      const a = await createTenant('OpsQuoteCustMismatch');
      const otherCustomer = await prisma.customer.create({
        data: { companyId: a.company.id, customerType: 'company', customerCode: 'OTHER-1' },
      });
      const quotation = await prisma.quotation.create({
        data: { companyId: a.company.id, customerId: otherCustomer.id, quotationNumber: 'QTN-TEST-3', status: 'accepted' },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ customerId: a.customer.id, name: 'X', quotationId: quotation.id });
      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // Work order customer derivation (never client-supplied)
  // ============================================================
  it('work order customer_id always matches the parent project, regardless of anything else', async () => {
    const a = await createTenant('OpsWoCustomer');
    const project = await createProject(a);

    const res = await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ projectId: project.id, title: 'WO' });

    expect(res.status).toBe(201);
    expect(res.body.data.customerId).toBe(a.customer.id);
  });

  // ============================================================
  // Task/project/work-order consistency + auto-derivation
  // ============================================================
  describe('task parent consistency', () => {
    it('requires at least one of projectId/workOrderId', async () => {
      const a = await createTenant('OpsTaskNoParent');
      const res = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ title: 'Orphan task' });
      expect(res.status).toBe(400);
    });

    it('auto-derives projectId from workOrderId when only the latter is supplied', async () => {
      const a = await createTenant('OpsTaskDerive');
      const project = await createProject(a);
      const woRes = await request(app.getHttpServer())
        .post('/api/v1/work-orders')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ projectId: project.id, title: 'WO' });

      const taskRes = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ workOrderId: woRes.body.data.id, title: 'Derived task' });

      expect(taskRes.status).toBe(201);
      expect(taskRes.body.data.projectId).toBe(project.id);
    });

    it('rejects a task whose projectId and workOrderId point to different projects', async () => {
      const a = await createTenant('OpsTaskMismatch');
      const projectOne = await createProject(a, { name: 'Project One' });
      const projectTwo = await createProject(a, { name: 'Project Two' });
      const woRes = await request(app.getHttpServer())
        .post('/api/v1/work-orders')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ projectId: projectOne.id, title: 'WO' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ workOrderId: woRes.body.data.id, projectId: projectTwo.id, title: 'Inconsistent' });
      expect(res.status).toBe(400);
    });
  });

  // ============================================================
  // Duplicate project membership
  // ============================================================
  it('rejects adding the same employee to a project twice (409)', async () => {
    const a = await createTenant('OpsDupMember');
    const project = await createProject(a);

    const first = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/members`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ employeeId: a.activeEmployee.id, role: 'technician' });
    expect(first.status).toBe(201);

    const duplicate = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/members`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ employeeId: a.activeEmployee.id, role: 'coordinator' });
    expect(duplicate.status).toBe(409);
  });

  it('project manager is auto-synced into project_members without creating a duplicate', async () => {
    const a = await createTenant('OpsPmSync');
    const project = await createProject(a, { projectManagerId: a.activeEmployee.id });

    const members = await request(app.getHttpServer())
      .get(`/api/v1/projects/${project.id}/members`)
      .set('Authorization', `Bearer ${a.accessToken}`);

    const managerEntries = members.body.data.filter((m: any) => m.employeeId === a.activeEmployee.id);
    expect(managerEntries.length).toBe(1);
    expect(managerEntries[0].role).toBe('manager');
  });

  // ============================================================
  // Inactive/terminated employee assignment rejection
  // ============================================================
  it('rejects assigning a terminated employee to a work order', async () => {
    const a = await createTenant('OpsTerminated');
    const project = await createProject(a);
    const woRes = await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ projectId: project.id, title: 'WO' });

    const res = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${woRes.body.data.id}/assign`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ employeeId: a.terminatedEmployee.id });
    expect(res.status).toBe(400);
  });

  // ============================================================
  // Invalid workflow transitions
  // ============================================================
  describe('invalid workflow transitions', () => {
    it('rejects project planning -> in_progress (skipping approved)', async () => {
      const a = await createTenant('OpsProjSkip');
      const project = await createProject(a);
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/projects/${project.id}/status`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ status: 'in_progress' });
      expect(res.status).toBe(422);
    });

    it('rejects work order new -> in_progress (skipping assigned)', async () => {
      const a = await createTenant('OpsWoSkip');
      const project = await createProject(a);
      const woRes = await request(app.getHttpServer())
        .post('/api/v1/work-orders')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ projectId: project.id, title: 'WO' });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/work-orders/${woRes.body.data.id}/status`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ status: 'in_progress' });
      expect(res.status).toBe(422);
    });

    it('rejects task pending -> completed (skipping in_progress)', async () => {
      const a = await createTenant('OpsTaskSkip');
      const project = await createProject(a);
      const taskRes = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ projectId: project.id, title: 'Task' });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${taskRes.body.data.id}/status`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ status: 'completed' });
      expect(res.status).toBe(422);
    });
  });

  // ============================================================
  // Completion gating — strict, no override
  // ============================================================
  describe('completion gating (strict, no override)', () => {
    it('blocks completing a work order with an open task, then allows it once cleared', async () => {
      const a = await createTenant('OpsWoGate');
      const project = await createProject(a);
      const woRes = await request(app.getHttpServer())
        .post('/api/v1/work-orders')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ projectId: project.id, title: 'WO' });
      const workOrderId = woRes.body.data.id;

      await request(app.getHttpServer())
        .patch(`/api/v1/work-orders/${workOrderId}/status`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ status: 'assigned' });
      await request(app.getHttpServer())
        .patch(`/api/v1/work-orders/${workOrderId}/status`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ status: 'in_progress' });

      const taskRes = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ workOrderId, title: 'Blocking task' });

      const blockedComplete = await request(app.getHttpServer())
        .patch(`/api/v1/work-orders/${workOrderId}/status`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ status: 'completed' });
      expect(blockedComplete.status).toBe(422);

      // No force/override flag exists — confirm it's simply rejected outright
      const forceAttempt = await request(app.getHttpServer())
        .patch(`/api/v1/work-orders/${workOrderId}/status`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ status: 'completed', force: true });
      expect(forceAttempt.status).toBe(400); // whitelist rejects the unknown `force` field entirely

      // Clear the task, then completion succeeds
      await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${taskRes.body.data.id}/status`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ status: 'in_progress' });
      await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${taskRes.body.data.id}/status`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ status: 'completed' });

      const successfulComplete = await request(app.getHttpServer())
        .patch(`/api/v1/work-orders/${workOrderId}/status`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ status: 'completed' });
      expect(successfulComplete.status).toBe(200);
    });

    it('blocks completing a project with an open work order', async () => {
      const a = await createTenant('OpsProjGate');
      const project = await createProject(a);
      await request(app.getHttpServer())
        .post('/api/v1/work-orders')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ projectId: project.id, title: 'Open WO' });

      await request(app.getHttpServer())
        .patch(`/api/v1/projects/${project.id}/status`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ status: 'approved' });
      await request(app.getHttpServer())
        .patch(`/api/v1/projects/${project.id}/status`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ status: 'in_progress' });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/projects/${project.id}/status`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ status: 'completed' });
      expect(res.status).toBe(422);
    });
  });

  // ============================================================
  // Soft delete
  // ============================================================
  describe('soft delete', () => {
    it('deleted projects are excluded from normal queries', async () => {
      const a = await createTenant('OpsProjDelete');
      const project = await createProject(a);

      const del = await request(app.getHttpServer())
        .delete(`/api/v1/projects/${project.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(del.status).toBe(200);

      const get = await request(app.getHttpServer())
        .get(`/api/v1/projects/${project.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(get.status).toBe(404);
    });

    it('a project that is no longer "planning" cannot be deleted', async () => {
      const a = await createTenant('OpsProjDeleteBlocked');
      const project = await createProject(a);
      await request(app.getHttpServer())
        .patch(`/api/v1/projects/${project.id}/status`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ status: 'approved' });

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/projects/${project.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(422);
    });
  });

  // ============================================================
  // Reassignment
  // ============================================================
  it('allows reassigning a work order to a different active employee', async () => {
    const a = await createTenant('OpsReassign');
    const project = await createProject(a);
    const secondEmployee = await prisma.employee.create({
      data: { companyId: a.company.id, employeeNumber: 'REASSIGN-2', firstName: 'Second', lastName: 'Tech', status: 'active' },
    });
    const woRes = await request(app.getHttpServer())
      .post('/api/v1/work-orders')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ projectId: project.id, title: 'WO', assignedToEmployeeId: a.activeEmployee.id });

    await request(app.getHttpServer())
      .patch(`/api/v1/work-orders/${woRes.body.data.id}/status`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ status: 'in_progress' });

    const reassign = await request(app.getHttpServer())
      .post(`/api/v1/work-orders/${woRes.body.data.id}/assign`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ employeeId: secondEmployee.id });

    expect(reassign.status).toBe(201);
    expect(reassign.body.data.assignedToEmployeeId).toBe(secondEmployee.id);
    expect(reassign.body.data.status).toBe('in_progress'); // unchanged by reassignment
  });

  // ============================================================
  // RBAC
  // ============================================================
  describe('RBAC', () => {
    it('missing authentication returns 401', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/projects');
      expect(res.status).toBe(401);
    });

    it('missing permission returns 403', async () => {
      const company = await prisma.company.create({ data: { name: 'NoOpsPerm Co.', status: 'active' } });
      const role = await prisma.role.create({ data: { companyId: company.id, name: 'ViewOnly' } });
      const perm = await prisma.permission.upsert({
        where: { module_resource_action: { module: 'Operations', resource: 'projects', action: 'view' } },
        create: { module: 'Operations', resource: 'projects', action: 'view' },
        update: {},
      });
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
      const passwordHash = await bcrypt.hash('TestPassword123!', 4);
      const user = await prisma.user.create({
        data: { companyId: company.id, name: 'NoPerm', email: 'no-ops-perm@example.com', passwordHash, status: 'active' },
      });
      await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: 'TestPassword123!' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${login.body.data.accessToken}`)
        .send({ customerId: 'irrelevant', name: 'Should be blocked' });
      expect(res.status).toBe(403);
    });

    it('a customer-portal identity is rejected from Operations routes (internal-only)', async () => {
      const a = await createTenant('OpsPortalBlock');
      const passwordHash = await bcrypt.hash('TestPassword123!', 4);
      const portalUser = await prisma.user.create({
        data: { companyId: a.company.id, name: 'Portal', email: 'ops-portal@example.com', passwordHash, status: 'active' },
      });
      await prisma.customerUser.create({
        data: { companyId: a.company.id, customerId: a.customer.id, userId: portalUser.id, status: 'active' },
      });
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: portalUser.email, password: 'TestPassword123!' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${login.body.data.accessToken}`);
      expect(res.status).toBe(403);
    });
  });
});
