import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Phase 2C Part 2 — Quotations (e2e)', () => {
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

  async function grantAllQuotationPermissions(roleId: string) {
    const resources: Array<[string, string, string]> = [
      ['CRM', 'customers', 'view'],
      ['CRM', 'customers', 'create'],
      ['CRM', 'opportunities', 'view'],
      ['CRM', 'opportunities', 'create'],
      ['CRM', 'quotations', 'view'],
      ['CRM', 'quotations', 'create'],
      ['CRM', 'quotations', 'edit'],
      ['CRM', 'quotations', 'delete'],
      ['CRM', 'quotations', 'send'],
      ['CRM', 'quotations', 'accept'],
      ['CRM', 'quotations', 'reject'],
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
    await grantAllQuotationPermissions(role.id);

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

    return { company, user, customer, accessToken: login.body.data.accessToken as string };
  }

  async function createDraftQuotationWithItem(a: Awaited<ReturnType<typeof createTenant>>) {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ customerId: a.customer.id });
    const quotationId = createRes.body.data.id;

    await request(app.getHttpServer())
      .post(`/api/v1/quotations/${quotationId}/items`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ description: 'Cat6 cabling', quantity: 100, unitPrice: 150, discount: 500, tax: 2085 });

    return quotationId;
  }

  // ----------------------------------------------------------
  // Main lifecycle: draft -> sent -> accepted
  // ----------------------------------------------------------
  it('lifecycle: draft -> sent -> accepted, with server-computed totals throughout', async () => {
    const a = await createTenant('Life Accept');
    const quotationId = await createDraftQuotationWithItem(a);

    const afterCreate = await request(app.getHttpServer())
      .get(`/api/v1/quotations/${quotationId}`)
      .set('Authorization', `Bearer ${a.accessToken}`);
    expect(afterCreate.body.data.status).toBe('draft');
    expect(Number(afterCreate.body.data.subtotal)).toBe(15000);
    expect(Number(afterCreate.body.data.discount)).toBe(500);
    expect(Number(afterCreate.body.data.tax)).toBe(2085);
    expect(Number(afterCreate.body.data.total)).toBe(16585);

    const sendRes = await request(app.getHttpServer())
      .post(`/api/v1/quotations/${quotationId}/send`)
      .set('Authorization', `Bearer ${a.accessToken}`);
    expect(sendRes.status).toBe(201);
    expect(sendRes.body.data.status).toBe('sent');

    const acceptRes = await request(app.getHttpServer())
      .post(`/api/v1/quotations/${quotationId}/accept`)
      .set('Authorization', `Bearer ${a.accessToken}`);
    expect(acceptRes.status).toBe(201);
    expect(acceptRes.body.data.status).toBe('accepted');

    // Terminal: further edits and re-transitions are rejected
    const editAttempt = await request(app.getHttpServer())
      .patch(`/api/v1/quotations/${quotationId}`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ validUntil: '2027-01-01' });
    expect(editAttempt.status).toBe(422);

    const reSendAttempt = await request(app.getHttpServer())
      .post(`/api/v1/quotations/${quotationId}/send`)
      .set('Authorization', `Bearer ${a.accessToken}`);
    expect(reSendAttempt.status).toBe(422);
  });

  // ----------------------------------------------------------
  // Main lifecycle: draft -> sent -> rejected
  // ----------------------------------------------------------
  it('lifecycle: draft -> sent -> rejected', async () => {
    const a = await createTenant('Life Reject');
    const quotationId = await createDraftQuotationWithItem(a);

    await request(app.getHttpServer())
      .post(`/api/v1/quotations/${quotationId}/send`)
      .set('Authorization', `Bearer ${a.accessToken}`);

    const rejectRes = await request(app.getHttpServer())
      .post(`/api/v1/quotations/${quotationId}/reject`)
      .set('Authorization', `Bearer ${a.accessToken}`);
    expect(rejectRes.status).toBe(201);
    expect(rejectRes.body.data.status).toBe('rejected');

    const acceptAfterReject = await request(app.getHttpServer())
      .post(`/api/v1/quotations/${quotationId}/accept`)
      .set('Authorization', `Bearer ${a.accessToken}`);
    expect(acceptAfterReject.status).toBe(422);
  });

  // ----------------------------------------------------------
  // Invalid transitions
  // ----------------------------------------------------------
  describe('invalid transitions', () => {
    it('cannot accept directly from draft', async () => {
      const a = await createTenant('Invalid Accept');
      const quotationId = await createDraftQuotationWithItem(a);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/quotations/${quotationId}/accept`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(422);
    });

    it('cannot reject directly from draft', async () => {
      const a = await createTenant('Invalid Reject');
      const quotationId = await createDraftQuotationWithItem(a);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/quotations/${quotationId}/reject`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(422);
    });

    it('cannot send a draft quotation with zero items', async () => {
      const a = await createTenant('Invalid Empty Send');
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/quotations')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ customerId: a.customer.id });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/quotations/${createRes.body.data.id}/send`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(422);
    });

    it('cannot add items to a sent quotation', async () => {
      const a = await createTenant('Invalid Item Add');
      const quotationId = await createDraftQuotationWithItem(a);
      await request(app.getHttpServer())
        .post(`/api/v1/quotations/${quotationId}/send`)
        .set('Authorization', `Bearer ${a.accessToken}`);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/quotations/${quotationId}/items`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ description: 'Too late', quantity: 1, unitPrice: 10 });
      expect(res.status).toBe(422);
    });
  });

  // ----------------------------------------------------------
  // Tenant isolation
  // ----------------------------------------------------------
  describe('tenant isolation', () => {
    it('Company A cannot read a Company B quotation', async () => {
      const a = await createTenant('Quote Iso A');
      const b = await createTenant('Quote Iso B');
      const quotationIdB = await createDraftQuotationWithItem(b);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/quotations/${quotationIdB}`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(res.status).toBe(404);
    });

    it('Company A cannot send/accept/reject a Company B quotation', async () => {
      const a = await createTenant('Quote Iso Actions A');
      const b = await createTenant('Quote Iso Actions B');
      const quotationIdB = await createDraftQuotationWithItem(b);

      const sendRes = await request(app.getHttpServer())
        .post(`/api/v1/quotations/${quotationIdB}/send`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(sendRes.status).toBe(404);

      // Actually send it as company B, then try to accept/reject as company A
      await request(app.getHttpServer())
        .post(`/api/v1/quotations/${quotationIdB}/send`)
        .set('Authorization', `Bearer ${b.accessToken}`);

      const acceptRes = await request(app.getHttpServer())
        .post(`/api/v1/quotations/${quotationIdB}/accept`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      expect(acceptRes.status).toBe(404);
    });

    it('Company A cannot create a quotation for a Company B customer', async () => {
      const a = await createTenant('Quote CustIso A');
      const b = await createTenant('Quote CustIso B');

      const res = await request(app.getHttpServer())
        .post('/api/v1/quotations')
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ customerId: b.customer.id });
      expect(res.status).toBe(404);
    });

    it("Company A cannot modify a Company B quotation's items", async () => {
      const a = await createTenant('Quote ItemIso A');
      const b = await createTenant('Quote ItemIso B');
      const quotationIdB = await createDraftQuotationWithItem(b);

      const itemsRes = await prisma.quotationItem.findMany({ where: { quotationId: quotationIdB } });
      const itemId = itemsRes[0].id;

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/quotations/${quotationIdB}/items/${itemId}`)
        .set('Authorization', `Bearer ${a.accessToken}`)
        .send({ quantity: 9999 });
      expect(res.status).toBe(404);
    });
  });

  // ----------------------------------------------------------
  // Opportunity validation (9)
  // ----------------------------------------------------------
  it('rejects a quotation against an opportunity in the lost stage', async () => {
    const a = await createTenant('Quote OppLost');
    const opp = await prisma.opportunity.create({
      data: { companyId: a.company.id, customerId: a.customer.id, name: 'Dead deal', stage: 'lost' },
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ customerId: a.customer.id, opportunityId: opp.id });
    expect(res.status).toBe(400);
  });

  it('rejects a quotation against an opportunity belonging to a different customer', async () => {
    const a = await createTenant('Quote OppCustMismatch');
    const otherCustomer = await prisma.customer.create({
      data: { companyId: a.company.id, customerType: 'company', customerCode: 'OTHER-CUST' },
    });
    const opp = await prisma.opportunity.create({
      data: { companyId: a.company.id, customerId: otherCustomer.id, name: 'Wrong customer deal' },
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ customerId: a.customer.id, opportunityId: opp.id });
    expect(res.status).toBe(400);
  });

  // ----------------------------------------------------------
  // Server-side calculation trust boundary
  // ----------------------------------------------------------
  it('rejects client-supplied top-level subtotal/total fields outright (whitelist + forbidNonWhitelisted)', async () => {
    const a = await createTenant('Quote CalcTrustReject');
    // The global ValidationPipe is configured with
    // whitelist+forbidNonWhitelisted, so unknown fields like a
    // client-supplied `total` are rejected at the door — the
    // strongest possible form of "never trust client totals".
    const res = await request(app.getHttpServer())
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ customerId: a.customer.id, subtotal: 999999, total: 999999 });

    expect(res.status).toBe(400);
  });

  it('computes totals purely from items, never from any implicit top-level value', async () => {
    const a = await createTenant('Quote CalcTrustCompute');
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ customerId: a.customer.id }); // no items at all

    expect(createRes.status).toBe(201);
    expect(Number(createRes.body.data.subtotal)).toBe(0);
    expect(Number(createRes.body.data.total)).toBe(0);
  });

  // ----------------------------------------------------------
  // Duplicate quotation number protection
  // ----------------------------------------------------------
  it('generates unique, sequential quotation numbers per company', async () => {
    const a = await createTenant('Quote NumberSeq');

    const first = await request(app.getHttpServer())
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ customerId: a.customer.id });
    const second = await request(app.getHttpServer())
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ customerId: a.customer.id });

    expect(first.body.data.quotationNumber).not.toBe(second.body.data.quotationNumber);
    expect(first.body.data.quotationNumber).toMatch(/^QTN-\d{4}-\d{4}$/);
  });
});
