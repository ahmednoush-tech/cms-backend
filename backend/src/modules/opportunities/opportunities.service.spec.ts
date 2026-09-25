import { Test } from '@nestjs/testing';
import { UnprocessableEntityException } from '@nestjs/common';
import { OpportunitiesService } from './opportunities.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import { CustomersService } from '../customers/customers.service';
import { AutomationRuleEngineService } from '../automation-rules/automation-rule-engine.service';
import { CustomFieldValidationService } from '../custom-fields/custom-field-validation.service';

describe('OpportunitiesService', () => {
  let service: OpportunitiesService;
  let prisma: any;
  let customFieldValidation: CustomFieldValidationService;

  beforeEach(async () => {
    prisma = {
      opportunity: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OpportunitiesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ActivityLogService, useValue: { record: jest.fn() } },
        { provide: CustomersService, useValue: { assertCustomerBelongsToCompany: jest.fn() } },
        { provide: AutomationRuleEngineService, useValue: { onOpportunityCreated: jest.fn(), onOpportunityStageChanged: jest.fn() } },
        { provide: CustomFieldValidationService, useValue: { validateAndNormalize: jest.fn().mockResolvedValue({}) } },
      ],
    }).compile();

    service = moduleRef.get(OpportunitiesService);
    customFieldValidation = moduleRef.get(CustomFieldValidationService);
  });

  it('allows a valid stage transition (prospecting -> qualification)', async () => {
    prisma.opportunity.findFirst.mockResolvedValue({ id: 'opp-1', companyId: 'c1', stage: 'prospecting' });
    prisma.opportunity.update.mockResolvedValue({ id: 'opp-1', stage: 'qualification' });

    const result = await service.updateStage('c1', 'user-1', 'opp-1', { stage: 'qualification' });
    expect(result.stage).toBe('qualification');
  });

  it('rejects skipping stages (prospecting -> negotiation)', async () => {
    prisma.opportunity.findFirst.mockResolvedValue({ id: 'opp-1', companyId: 'c1', stage: 'prospecting' });

    await expect(
      service.updateStage('c1', 'user-1', 'opp-1', { stage: 'negotiation' }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejects any transition out of a terminal stage (lost -> qualification)', async () => {
    prisma.opportunity.findFirst.mockResolvedValue({ id: 'opp-1', companyId: 'c1', stage: 'lost' });

    await expect(
      service.updateStage('c1', 'user-1', 'opp-1', { stage: 'qualification' }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('allows reaching won from negotiation', async () => {
    prisma.opportunity.findFirst.mockResolvedValue({ id: 'opp-1', companyId: 'c1', stage: 'negotiation' });
    prisma.opportunity.update.mockResolvedValue({ id: 'opp-1', stage: 'won' });

    const result = await service.updateStage('c1', 'user-1', 'opp-1', { stage: 'won' });
    expect(result.stage).toBe('won');
  });

  // ----------------------------------------------------------
  // findAll — P1 filter regression (V1 Final System Audit §7/13)
  // ----------------------------------------------------------
  describe('findAll — filters reach the service', () => {
    beforeEach(() => {
      prisma.opportunity.findMany.mockResolvedValue([]);
      prisma.opportunity.count.mockResolvedValue(0);
    });

    it('applies customerId and stage filters alongside companyId', async () => {
      await service.findAll('company-A', {
        page: 1,
        pageSize: 20,
        customerId: 'cust-1',
        stage: 'proposal',
      } as any);

      const call = prisma.opportunity.findMany.mock.calls[0][0];
      expect(call.where.companyId).toBe('company-A');
      expect(call.where.customerId).toBe('cust-1');
      expect(call.where.stage).toBe('proposal');
      expect(call.where.deletedAt).toBeNull();
    });

    it('omits filter keys entirely when not supplied', async () => {
      await service.findAll('company-A', { page: 1, pageSize: 20 } as any);

      const call = prisma.opportunity.findMany.mock.calls[0][0];
      expect(call.where.companyId).toBe('company-A');
      expect('customerId' in call.where).toBe(false);
      expect('stage' in call.where).toBe(false);
    });
  });

  describe('customFields wiring', () => {
    it("create() validates customFields against entityType 'opportunity'", async () => {
      prisma.opportunity.create.mockResolvedValue({ id: 'opp-1', name: 'Big Deal', ownerId: 'user-1' });
      const validateSpy = jest.spyOn(customFieldValidation, 'validateAndNormalize');

      await service.create('company-1', 'user-1', { customerId: 'cust-1', name: 'Big Deal', customFields: { region: 'central' } } as any);

      expect(validateSpy).toHaveBeenCalledWith('company-1', 'opportunity', { region: 'central' });
    });

    it("update() passes the request's raw customFields AND the existing stored values as SEPARATE arguments", async () => {
      prisma.opportunity.findFirst.mockResolvedValue({ id: 'opp-1', customFields: { region: 'central', tier: 'gold' } });
      prisma.opportunity.update.mockResolvedValue({ id: 'opp-1' });
      const validateSpy = jest.spyOn(customFieldValidation, 'validateAndNormalize').mockResolvedValue({ region: 'east', tier: 'gold' });

      await service.update('company-1', 'user-1', 'opp-1', { customFields: { region: 'east' } } as any);

      expect(validateSpy).toHaveBeenCalledWith('company-1', 'opportunity', { region: 'east' }, { region: 'central', tier: 'gold' });
    });

    it('update() does not touch customFields at all when the request omits it entirely', async () => {
      prisma.opportunity.findFirst.mockResolvedValue({ id: 'opp-1', customFields: { region: 'central' } });
      prisma.opportunity.update.mockResolvedValue({ id: 'opp-1' });
      const validateSpy = jest.spyOn(customFieldValidation, 'validateAndNormalize');

      await service.update('company-1', 'user-1', 'opp-1', { name: 'Renamed Deal' } as any);

      expect(validateSpy).not.toHaveBeenCalled();
      const updateCall = prisma.opportunity.update.mock.calls[0][0];
      expect('customFields' in updateCall.data).toBe(false);
    });
  });
});
