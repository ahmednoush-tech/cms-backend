import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { LeadsService } from './leads.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { AutomationRuleEngineService } from '../automation-rules/automation-rule-engine.service';
import { CustomFieldValidationService } from '../custom-fields/custom-field-validation.service';

describe('LeadsService', () => {
  let service: LeadsService;
  let prisma: any;
  let customFieldValidation: CustomFieldValidationService;

  /**
   * Mimics Prisma's interactive transaction: the callback receives
   * `prisma` itself as the tx client, since all mocked methods
   * live directly on `prisma` in these tests. This lets us assert
   * against the same mock functions whether they're called via
   * `prisma.x` or `tx.x` inside the transaction callback.
   */
  function mockTransaction(prismaMock: any) {
    return jest.fn((arg) => {
      if (typeof arg === 'function') return arg(prismaMock);
      return Promise.all(arg);
    });
  }

  beforeEach(async () => {
    prisma = {
      lead: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      customer: { create: jest.fn(), findFirst: jest.fn() },
      customerContact: { create: jest.fn(), findFirst: jest.fn() },
      opportunity: { create: jest.fn() },
    };
    prisma.$transaction = mockTransaction(prisma);

    const moduleRef = await Test.createTestingModule({
      providers: [
        LeadsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActivityLogService, useValue: { record: jest.fn() } },
        { provide: AutomationRuleEngineService, useValue: { onLeadCreated: jest.fn() } },
        { provide: CustomFieldValidationService, useValue: { validateAndNormalize: jest.fn().mockResolvedValue({}) } },
      ],
    }).compile();

    service = moduleRef.get(LeadsService);
    customFieldValidation = moduleRef.get(CustomFieldValidationService);
  });

  describe('updateStatus', () => {
    it('allows a valid transition (new -> contacted)', async () => {
      prisma.lead.findFirst.mockResolvedValue({ id: 'lead-1', companyId: 'c1', status: 'new' });
      prisma.lead.update.mockResolvedValue({ id: 'lead-1', status: 'contacted' });

      const result = await service.updateStatus('c1', 'user-1', 'lead-1', { status: 'contacted' });
      expect(result.status).toBe('contacted');
    });

    it('rejects an invalid transition (new -> won, skipping stages)', async () => {
      prisma.lead.findFirst.mockResolvedValue({ id: 'lead-1', companyId: 'c1', status: 'new' });

      await expect(
        service.updateStatus('c1', 'user-1', 'lead-1', { status: 'won' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects any transition out of a terminal state (won -> anything)', async () => {
      prisma.lead.findFirst.mockResolvedValue({ id: 'lead-1', companyId: 'c1', status: 'won' });

      await expect(
        service.updateStatus('c1', 'user-1', 'lead-1', { status: 'contacted' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('convert — invalid vs. valid source status', () => {
    const baseLead = {
      id: 'lead-1',
      companyId: 'c1',
      name: 'Faisal',
      email: 'f@example.com',
      phone: '123',
      companyName: 'Acme',
      ownerId: 'owner-1',
      customerId: null,
      convertedAt: null,
    };

    it.each(['new', 'contacted', 'lost'])(
      'rejects conversion from an ineligible status: %s',
      async (status) => {
        prisma.lead.findFirst.mockResolvedValue({ ...baseLead, status });

        await expect(
          service.convert('c1', 'user-1', 'lead-1', { customerType: 'company', customerCode: 'C1' }),
        ).rejects.toThrow(BadRequestException);
      },
    );

    it.each(['qualified', 'proposal', 'won'])(
      'allows conversion from an eligible status: %s',
      async (status) => {
        prisma.lead.findFirst.mockResolvedValue({ ...baseLead, status });
        prisma.customer.findFirst.mockResolvedValue(null); // no auto-match
        prisma.customerContact.findFirst.mockResolvedValue(null);
        prisma.customer.create.mockResolvedValue({ id: 'new-cust' });
        prisma.customerContact.create.mockResolvedValue({ id: 'contact-1' });
        prisma.lead.update.mockResolvedValue({ ...baseLead, status: 'won', customerId: 'new-cust' });

        const result = await service.convert('c1', 'user-1', 'lead-1', {
          customerType: 'company',
          customerCode: 'C1',
        });
        expect(result.customerId).toBe('new-cust');
      },
    );
  });

  describe('convert — duplicate-customer safeguard', () => {
    const qualifiedLead = {
      id: 'lead-1',
      companyId: 'c1',
      status: 'qualified',
      name: 'Faisal',
      email: 'f@example.com',
      phone: '123',
      companyName: 'Acme',
      ownerId: 'owner-1',
      customerId: null,
      convertedAt: null,
    };

    it('creates a new customer when no match exists', async () => {
      prisma.lead.findFirst.mockResolvedValue(qualifiedLead);
      prisma.customer.findFirst.mockResolvedValue(null);
      prisma.customerContact.findFirst.mockResolvedValue(null);
      prisma.customer.create.mockResolvedValue({ id: 'brand-new-cust' });
      prisma.customerContact.create.mockResolvedValue({ id: 'contact-1' });
      prisma.lead.update.mockResolvedValue({ ...qualifiedLead, status: 'won', customerId: 'brand-new-cust' });

      const result = await service.convert('c1', 'user-1', 'lead-1', {
        customerType: 'company',
        customerCode: 'CUST-NEW',
      });

      expect(prisma.customer.create).toHaveBeenCalledTimes(1);
      expect(result.customerWasCreated).toBe(true);
      expect(result.customerId).toBe('brand-new-cust');
    });

    it('reuses an existing customer matched by email instead of creating a duplicate', async () => {
      prisma.lead.findFirst.mockResolvedValue(qualifiedLead);
      prisma.customer.findFirst.mockResolvedValue({ id: 'existing-by-email', email: 'f@example.com' });
      prisma.customerContact.findFirst.mockResolvedValue(null);
      prisma.customerContact.create.mockResolvedValue({ id: 'contact-2' });
      prisma.lead.update.mockResolvedValue({ ...qualifiedLead, status: 'won', customerId: 'existing-by-email' });

      // No customerType/customerCode supplied at all — proves they
      // are NOT required when a match is found.
      const result = await service.convert('c1', 'user-1', 'lead-1', {});

      expect(prisma.customer.create).not.toHaveBeenCalled();
      expect(result.customerWasCreated).toBe(false);
      expect(result.customerId).toBe('existing-by-email');
    });

    it('does not create a duplicate contact if one already exists under the matched customer', async () => {
      prisma.lead.findFirst.mockResolvedValue(qualifiedLead);
      prisma.customer.findFirst.mockResolvedValue({ id: 'existing-cust', email: 'f@example.com' });
      prisma.customerContact.findFirst.mockResolvedValue({ id: 'already-there', email: 'f@example.com' });
      prisma.lead.update.mockResolvedValue({ ...qualifiedLead, status: 'won', customerId: 'existing-cust' });

      const result = await service.convert('c1', 'user-1', 'lead-1', {});

      expect(prisma.customerContact.create).not.toHaveBeenCalled();
      expect(result.contactWasCreated).toBe(false);
      expect(result.contact).toEqual({ id: 'already-there', email: 'f@example.com' });
    });

    it('respects an explicit existingCustomerId over auto-matching', async () => {
      prisma.lead.findFirst.mockResolvedValue(qualifiedLead);
      prisma.customer.findFirst.mockResolvedValue({ id: 'explicit-cust', companyId: 'c1' });
      prisma.customerContact.findFirst.mockResolvedValue(null);
      prisma.customerContact.create.mockResolvedValue({ id: 'contact-3' });
      prisma.lead.update.mockResolvedValue({ ...qualifiedLead, status: 'won', customerId: 'explicit-cust' });

      const result = await service.convert('c1', 'user-1', 'lead-1', {
        existingCustomerId: 'explicit-cust',
      });

      expect(prisma.customer.create).not.toHaveBeenCalled();
      expect(result.customerId).toBe('explicit-cust');
    });

    it('rejects a new-customer request with no match and missing customerType/customerCode', async () => {
      prisma.lead.findFirst.mockResolvedValue(qualifiedLead);
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(service.convert('c1', 'user-1', 'lead-1', {})).rejects.toThrow(BadRequestException);
    });
  });

  describe('convert — idempotency', () => {
    it('rejects a second conversion attempt with 409 and creates nothing new', async () => {
      prisma.lead.findFirst.mockResolvedValue({
        id: 'lead-1',
        companyId: 'c1',
        status: 'won',
        customerId: 'already-converted-cust',
        convertedAt: new Date('2026-01-01'),
      });

      await expect(
        service.convert('c1', 'user-1', 'lead-1', { customerType: 'company', customerCode: 'X' }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.customer.create).not.toHaveBeenCalled();
      expect(prisma.customerContact.create).not.toHaveBeenCalled();
      expect(prisma.opportunity.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('convert — transactional rollback', () => {
    const qualifiedLead = {
      id: 'lead-1',
      companyId: 'c1',
      status: 'qualified',
      name: 'Faisal',
      email: 'f@example.com',
      phone: '123',
      companyName: 'Acme',
      ownerId: 'owner-1',
      customerId: null,
      convertedAt: null,
    };

    it('propagates a failure from a later step (opportunity creation) so nothing is treated as committed', async () => {
      prisma.lead.findFirst.mockResolvedValue(qualifiedLead);
      prisma.customer.findFirst.mockResolvedValue(null);
      prisma.customerContact.findFirst.mockResolvedValue(null);
      prisma.customer.create.mockResolvedValue({ id: 'cust-rollback' });
      prisma.customerContact.create.mockResolvedValue({ id: 'contact-rollback' });
      prisma.opportunity.create.mockRejectedValue(new Error('DB constraint violation'));

      // Because $transaction here just invokes the callback directly
      // (mimicking Prisma's real behavior of propagating a thrown
      // error and rolling back), the whole convert() call must reject
      // rather than resolve with partial results.
      await expect(
        service.convert('c1', 'user-1', 'lead-1', {
          customerType: 'company',
          customerCode: 'CUST-RB',
          createOpportunity: true,
          opportunityName: 'Deal',
        }),
      ).rejects.toThrow('DB constraint violation');

      // lead.update (the final step) must never have been reached
      expect(prisma.lead.update).not.toHaveBeenCalled();
    });

    it('propagates a failure from the customer-creation step before any contact is touched', async () => {
      prisma.lead.findFirst.mockResolvedValue(qualifiedLead);
      prisma.customer.findFirst.mockResolvedValue(null);
      prisma.customer.create.mockRejectedValue(new Error('duplicate customerCode'));

      await expect(
        service.convert('c1', 'user-1', 'lead-1', { customerType: 'company', customerCode: 'DUPLICATE' }),
      ).rejects.toThrow('duplicate customerCode');

      expect(prisma.customerContact.create).not.toHaveBeenCalled();
      expect(prisma.lead.update).not.toHaveBeenCalled();
    });
  });

  describe('convert — opportunity option', () => {
    it('rejects createOpportunity without opportunityName', async () => {
      prisma.lead.findFirst.mockResolvedValue({
        id: 'lead-1',
        companyId: 'c1',
        status: 'qualified',
        customerId: null,
        convertedAt: null,
      });

      await expect(
        service.convert('c1', 'user-1', 'lead-1', {
          customerType: 'company',
          customerCode: 'CUST-0101',
          createOpportunity: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates an opportunity linked to the lead when requested', async () => {
      const lead = {
        id: 'lead-1',
        companyId: 'c1',
        status: 'won',
        name: 'Faisal',
        email: 'f@example.com',
        phone: '123',
        ownerId: 'owner-1',
        customerId: null,
        convertedAt: null,
      };
      prisma.lead.findFirst.mockResolvedValue(lead);
      prisma.customer.findFirst.mockResolvedValue(null);
      prisma.customerContact.findFirst.mockResolvedValue(null);
      prisma.customer.create.mockResolvedValue({ id: 'cust-opp' });
      prisma.customerContact.create.mockResolvedValue({ id: 'contact-opp' });
      prisma.opportunity.create.mockResolvedValue({ id: 'opp-1', leadId: 'lead-1' });
      prisma.lead.update.mockResolvedValue({ ...lead, customerId: 'cust-opp' });

      const result = await service.convert('c1', 'user-1', 'lead-1', {
        customerType: 'individual',
        customerCode: 'CUST-OPP',
        createOpportunity: true,
        opportunityName: 'New deal',
      });

      expect(prisma.opportunity.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ leadId: 'lead-1' }) }),
      );
      expect(result.opportunity).toEqual({ id: 'opp-1', leadId: 'lead-1' });
    });
  });

  describe('customFields wiring', () => {
    it('create() passes the raw customFields input through validation before saving', async () => {
      prisma.lead.create.mockResolvedValue({ id: 'lead-1', name: 'Acme', ownerId: 'user-1', customFields: { budget: 5000 } });
      const validateSpy = jest.spyOn(customFieldValidation, 'validateAndNormalize').mockResolvedValue({ budget: 5000 });

      await service.create('company-1', 'user-1', { name: 'Acme', customFields: { budget: '5000' } } as any);

      expect(validateSpy).toHaveBeenCalledWith('company-1', 'lead', { budget: '5000' });
      const createCall = prisma.lead.create.mock.calls[0][0];
      expect(createCall.data.customFields).toEqual({ budget: 5000 });
    });

    it('create() lets a validation rejection propagate (an invalid custom field blocks the whole create)', async () => {
      jest.spyOn(customFieldValidation, 'validateAndNormalize').mockRejectedValue(new Error('invalid custom field'));

      await expect(service.create('company-1', 'user-1', { name: 'Acme', customFields: { budget: 'not-a-number' } } as any)).rejects.toThrow(
        'invalid custom field',
      );
      expect(prisma.lead.create).not.toHaveBeenCalled();
    });

    it("update() passes the request's raw customFields AND the existing stored values as SEPARATE arguments — the service itself merges them now, so it can tell 'touched now' apart from 'inherited'", async () => {
      prisma.lead.findFirst.mockResolvedValue({ id: 'lead-1', customFields: { budget: 5000, region: 'Riyadh' } });
      prisma.lead.update.mockResolvedValue({ id: 'lead-1' });
      const validateSpy = jest
        .spyOn(customFieldValidation, 'validateAndNormalize')
        .mockResolvedValue({ budget: 8000, region: 'Riyadh' });

      await service.update('company-1', 'user-1', 'lead-1', { customFields: { budget: 8000 } } as any);

      expect(validateSpy).toHaveBeenCalledWith('company-1', 'lead', { budget: 8000 }, { budget: 5000, region: 'Riyadh' });
    });

    it('update() does not touch customFields at all when the request omits it entirely', async () => {
      prisma.lead.findFirst.mockResolvedValue({ id: 'lead-1', customFields: { budget: 5000 } });
      prisma.lead.update.mockResolvedValue({ id: 'lead-1' });
      const validateSpy = jest.spyOn(customFieldValidation, 'validateAndNormalize');

      await service.update('company-1', 'user-1', 'lead-1', { name: 'New Name' } as any);

      expect(validateSpy).not.toHaveBeenCalled();
      const updateCall = prisma.lead.update.mock.calls[0][0];
      expect('customFields' in updateCall.data).toBe(false);
    });
  });
});
