import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Phase 2C (Customers, Contacts, Customer Users, Leads,
 * Conversion, Opportunities) verification. Same conventions as
 * the Phase 2B checklist spec: test names describe the exact
 * guarantee being proven, run against a real PostgreSQL 16
 * instance (see .github/workflows/phase2b-verification.yml —
 * extend that job's e2e glob to pick this file up too, it
 * already runs `npm run test:e2e` which includes every
 * *.e2e-spec.ts file under test/).
 */
describe('Phase 2C CRM (e2e)', () => {
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

  async function grantAllCrmPermissions(roleId: string) {
    const resources: Array<[string, string, string]> = [
      ['CRM', 'customers', 'view'],
      ['CRM', 'customers', 'create'],
      ['CRM', 'customers', 'edit'],
      ['CRM', 'customers', 'delete'],
      ['CRM', 'leads', 'view'],
      ['CRM', 'leads', 'create'],
      ['CRM', 'leads', 'edit'],
      ['CRM', 'leads', 'delete'],
      ['CRM', 'opportunities', 'view'],
      ['CRM', 'opportunities', 'create'],
      ['CRM', 'opportunities', 'edit'],
      ['CRM', 'opportunities', 'delete'],
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
    await grantAllCrmPermissions(role.id);

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

    return { company, user, accessToken: login.body.data.accessToken as string };
  }

  // ----------------------------------------------------------
  // Customers — tenant isolation
  // ----------------------------------------------------------
  describe('Customers tenant isolation', () => {
    it('Company A cannot read a Company B customer', async () => {
      const a = await createTenant('Cust A');
      const b = await createTenant('Cust B');
      const custB = await prisma.customer.create({
        data: { companyId: b.company.id, customerType: 'company', customerCode: 'B-0001', companyName: 'B Co' },
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/customers/${custB.id}`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(404);
    });

    it('duplicate customerCode within the same company is rejected with 409', async () => {
      const a = await createTenant('Cust Dup');
      await prisma.customer.create({
        data: { companyId: a.company.id, customerType: 'company', customerCode: 'DUP-01', companyName: 'X' },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/customers')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ customerType: 'company', companyName: 'Y', customerCode: 'DUP-01' });
      expect(res.status).toBe(409);
    });
  });

  // ----------------------------------------------------------
  // Customer Users — duplicate portal link protection
  // ----------------------------------------------------------
  describe('Customer portal access', () => {
    it('creating a portal login and linking it works end to end', async () => {
      const a = await createTenant('Portal A');
      const customer = await prisma.customer.create({
        data: { companyId: a.company.id, customerType: 'company', customerCode: 'PORTAL-1', companyName: 'Portal Co' },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/customers/${customer.id}/portal-users`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ name: 'Portal Person', email: 'portal-person@example.com', password: 'TestPassword123!' });

      expect(res.status).toBe(201);
      expect(res.body.data.customerId).toBe(customer.id);

      // Logging in as that new portal user should yield isCustomerUser=true
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'portal-person@example.com', password: 'TestPassword123!' });
      expect(login.body.data.user.isCustomerUser).toBe(true);
      expect(login.body.data.user.customerId).toBe(customer.id);
    });

    it('linking the same user to the same customer twice is rejected with 409', async () => {
      const a = await createTenant('Portal Dup');
      const customer = await prisma.customer.create({
        data: { companyId: a.company.id, customerType: 'company', customerCode: 'PORTAL-DUP', companyName: 'X' },
      });
      const portalUser = await prisma.user.create({
        data: {
          companyId: a.company.id,
          name: 'Dup Portal',
          email: 'dup-portal@example.com',
          passwordHash: await bcrypt.hash('x', 4),
          status: 'active',
        },
      });

      const first = await request(app.getHttpServer())
        .post(`/api/v1/customers/${customer.id}/portal-users/link-existing`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ userId: portalUser.id });
      expect(first.status).toBe(201);

      const duplicate = await request(app.getHttpServer())
        .post(`/api/v1/customers/${customer.id}/portal-users/link-existing`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ userId: portalUser.id });
      expect(duplicate.status).toBe(409);
    });
  });

  // ----------------------------------------------------------
  // Leads — status workflow transitions
  // ----------------------------------------------------------
  describe('Lead workflow transitions', () => {
    it('a valid transition succeeds (new -> contacted)', async () => {
      const a = await createTenant('Lead Valid');
      const lead = await prisma.lead.create({ data: { companyId: a.company.id, name: 'Test Lead' } });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/leads/${lead.id}/status`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ status: 'contacted' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('contacted');
    });

    it('an invalid transition is rejected with 422 (new -> won)', async () => {
      const a = await createTenant('Lead Invalid');
      const lead = await prisma.lead.create({ data: { companyId: a.company.id, name: 'Test Lead 2' } });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/leads/${lead.id}/status`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ status: 'won' });
      expect(res.status).toBe(422);
    });
  });

  // ----------------------------------------------------------
  // Lead conversion
  // ----------------------------------------------------------
  describe('Lead conversion', () => {
    it('converts a qualified lead into a new customer + contact, preserving lead history', async () => {
      const a = await createTenant('Convert A');
      const lead = await prisma.lead.create({
        data: {
          companyId: a.company.id,
          name: 'Convert Me',
          email: 'convert@example.com',
          status: 'qualified',
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/leads/${lead.id}/convert`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ customerType: 'individual', customerCode: 'CONV-0001' });

      expect(res.status).toBe(201);
      expect(res.body.data.customerId).toBeTruthy();

      const reloadedLead = await prisma.lead.findUnique({ where: { id: lead.id } });
      expect(reloadedLead?.customerId).toBe(res.body.data.customerId);
      expect(reloadedLead?.convertedAt).not.toBeNull();
      expect(reloadedLead?.status).toBe('won');
      expect(reloadedLead?.deletedAt).toBeNull(); // lead row preserved, never deleted

      const contacts = await prisma.customerContact.findMany({
        where: { customerId: res.body.data.customerId },
      });
      expect(contacts.length).toBe(1);
    });

    it('rejects converting a lead still in "new" status', async () => {
      const a = await createTenant('Convert Reject');
      const lead = await prisma.lead.create({ data: { companyId: a.company.id, name: 'Too Early' } });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/leads/${lead.id}/convert`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ customerType: 'individual', customerCode: 'CONV-REJECT' });

      expect(res.status).toBe(400);
    });

    it('rejects converting an already-converted lead a second time', async () => {
      const a = await createTenant('Convert Twice');
      const lead = await prisma.lead.create({
        data: { companyId: a.company.id, name: 'Twice', status: 'qualified' },
      });

      const first = await request(app.getHttpServer())
        .post(`/api/v1/leads/${lead.id}/convert`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ customerType: 'individual', customerCode: 'CONV-TWICE-1' });
      expect(first.status).toBe(201);

      const second = await request(app.getHttpServer())
        .post(`/api/v1/leads/${lead.id}/convert`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ customerType: 'individual', customerCode: 'CONV-TWICE-2' });
      expect(second.status).toBe(409);
    });

    it('duplicate-customer safeguard: two leads sharing an email convert to the SAME customer, not two', async () => {
      const a = await createTenant('Convert Dedup');
      const sharedEmail = 'shared-contact@example.com';

      const leadOne = await prisma.lead.create({
        data: {
          companyId: a.company.id,
          name: 'First Contact',
          email: sharedEmail,
          status: 'qualified',
        },
      });
      const leadTwo = await prisma.lead.create({
        data: {
          companyId: a.company.id,
          name: 'Second Contact',
          email: sharedEmail,
          status: 'qualified',
        },
      });

      const firstConvert = await request(app.getHttpServer())
        .post(`/api/v1/leads/${leadOne.id}/convert`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ customerType: 'individual', customerCode: 'DEDUP-0001' });
      expect(firstConvert.status).toBe(201);
      const firstCustomerId = firstConvert.body.data.customerId;

      // Second lead has the same email and provides NO
      // customerType/customerCode at all — proves auto-matching
      // finds the existing customer without needing fallback data.
      const secondConvert = await request(app.getHttpServer())
        .post(`/api/v1/leads/${leadTwo.id}/convert`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({});
      expect(secondConvert.status).toBe(201);

      expect(secondConvert.body.data.customerId).toBe(firstCustomerId);
      expect(secondConvert.body.data.customerWasCreated).toBe(false);

      const allCustomersWithEmail = await prisma.customer.findMany({
        where: { companyId: a.company.id, email: sharedEmail },
      });
      expect(allCustomersWithEmail.length).toBe(1); // exactly one, never two

      const contactsUnderCustomer = await prisma.customerContact.findMany({
        where: { customerId: firstCustomerId },
      });
      expect(contactsUnderCustomer.length).toBe(1); // second conversion reused the contact too
    });

    it('an explicit existingCustomerId always wins over auto-matching', async () => {
      const a = await createTenant('Convert Explicit');
      const customerA = await prisma.customer.create({
        data: { companyId: a.company.id, customerType: 'individual', customerCode: 'EXPLICIT-A' },
      });
      const customerB = await prisma.customer.create({
        data: { companyId: a.company.id, customerType: 'individual', customerCode: 'EXPLICIT-B' },
      });
      const lead = await prisma.lead.create({
        data: {
          companyId: a.company.id,
          name: 'Explicit Pick',
          email: 'no-match-needed@example.com',
          status: 'qualified',
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/leads/${lead.id}/convert`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ existingCustomerId: customerB.id });

      expect(res.status).toBe(201);
      expect(res.body.data.customerId).toBe(customerB.id);
      expect(res.body.data.customerId).not.toBe(customerA.id);
    });
  });

  // ----------------------------------------------------------
  // Opportunities — stage workflow + tenant isolation
  // ----------------------------------------------------------
  describe('Opportunities', () => {
    it('an invalid stage transition is rejected with 422 (prospecting -> won)', async () => {
      const a = await createTenant('Opp Invalid');
      const customer = await prisma.customer.create({
        data: { companyId: a.company.id, customerType: 'company', customerCode: 'OPP-1', companyName: 'X' },
      });
      const opp = await prisma.opportunity.create({
        data: { companyId: a.company.id, customerId: customer.id, name: 'Deal' },
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/opportunities/${opp.id}/stage`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ stage: 'won' });
      expect(res.status).toBe(422);
    });

    it('cannot create an opportunity referencing a Company B customer', async () => {
      const a = await createTenant('Opp Cross A');
      const b = await createTenant('Opp Cross B');
      const custB = await prisma.customer.create({
        data: { companyId: b.company.id, customerType: 'company', customerCode: 'OPP-B-1', companyName: 'B' },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/opportunities')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ customerId: custB.id, name: 'Cross-tenant deal' });
      expect(res.status).toBe(404);
    });
  });
});
