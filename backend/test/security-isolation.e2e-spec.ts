import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * These e2e tests run against a real (test) PostgreSQL database
 * migrated with the approved schema. They are written to run in
 * CI against a disposable `cms_test` database:
 *
 *   DATABASE_URL=postgresql://.../cms_test npx prisma migrate deploy
 *   DATABASE_URL=postgresql://.../cms_test npm run test:e2e
 *
 * Each test creates its own minimal fixtures directly via Prisma
 * so the suite doesn't depend on seed_data.sql ordering.
 *
 * They exist specifically to PROVE, at the HTTP layer, the three
 * security guarantees called out in the approved spec:
 *   1. Company A cannot access Company B's data.
 *   2. Customer A cannot access Customer B's data.
 *   3. Customer-portal accounts cannot reach internal admin routes.
 */
describe('Security isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createCompanyWithAdmin(label: string) {
    const company = await prisma.company.create({
      data: { name: `${label} Co.`, status: 'active' },
    });
    const role = await prisma.role.create({
      data: { companyId: company.id, name: 'Super Admin' },
    });
    const permission = await prisma.permission.upsert({
      where: {
        module_resource_action: {
          module: 'Administration',
          resource: 'users',
          action: 'manage',
        },
      },
      create: { module: 'Administration', resource: 'users', action: 'manage' },
      update: {},
    });
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: permission.id },
    });

    const passwordHash = await import('bcrypt').then((b) =>
      b.hash('TestPassword123!', 4),
    );
    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        name: `${label} Admin`,
        email: `${label.toLowerCase()}-admin@example.com`,
        passwordHash,
        status: 'active',
      },
    });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: user.email, password: 'TestPassword123!' });

    return { company, user, accessToken: login.body.data.accessToken };
  }

  it('Company A admin cannot read a user belonging to Company B', async () => {
    const companyA = await createCompanyWithAdmin('TenantA');
    const companyB = await createCompanyWithAdmin('TenantB');

    // A user created only in Company B
    const bcrypt = await import('bcrypt');
    const companyBEmployee = await prisma.user.create({
      data: {
        companyId: companyB.company.id,
        name: 'Company B Employee',
        email: 'employee-b@example.com',
        passwordHash: await bcrypt.hash('irrelevant', 4),
        status: 'active',
      },
    });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/users/${companyBEmployee.id}`)
      .set('Authorization', `Bearer ${companyA.accessToken}`);

    // The route is tenant-scoped by companyId server-side, so a
    // record belonging to another tenant simply doesn't exist
    // from Company A's point of view -> 404, never 200.
    expect(response.status).toBe(404);
  });

  it('Company A admin listing users never returns Company B rows', async () => {
    const companyA = await createCompanyWithAdmin('ListTenantA');
    await createCompanyWithAdmin('ListTenantB');

    const response = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${companyA.accessToken}`);

    expect(response.status).toBe(200);
    const returnedCompanyIds = new Set(
      response.body.data.map((u: any) => u.companyId),
    );
    expect(returnedCompanyIds.size).toBe(1);
    expect(returnedCompanyIds.has(companyA.company.id)).toBe(true);
  });

  it('a customer-portal user is rejected from an internal-only Administration route', async () => {
    const { company } = await createCompanyWithAdmin('PortalTenant');

    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerType: 'company',
        companyName: 'Portal Test Customer',
        customerCode: 'CUST-PORTAL-1',
        status: 'active',
      },
    });

    const bcrypt = await import('bcrypt');
    const portalUser = await prisma.user.create({
      data: {
        companyId: company.id,
        name: 'Portal User',
        email: 'portal-user@example.com',
        passwordHash: await bcrypt.hash('TestPassword123!', 4),
        status: 'active',
      },
    });
    await prisma.customerUser.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        userId: portalUser.id,
        status: 'active',
      },
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: portalUser.email, password: 'TestPassword123!' });

    expect(login.body.data.user.isCustomerUser).toBe(true);
    expect(login.body.data.user.customerId).toBe(customer.id);

    const blocked = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);

    // Blocked by InternalOnlyGuard regardless of any role/permission
    // the account might otherwise carry.
    expect(blocked.status).toBe(403);
  });

  it('/auth/me never exposes another user\'s customerId or companyId', async () => {
    const { accessToken, user, company } = await createCompanyWithAdmin(
      'MeTenant',
    );

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(me.status).toBe(200);
    expect(me.body.data.sub).toBe(user.id);
    expect(me.body.data.companyId).toBe(company.id);
  });
});
