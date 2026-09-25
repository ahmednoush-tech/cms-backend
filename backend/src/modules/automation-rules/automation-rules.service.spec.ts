import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { AutomationRulesService } from './automation-rules.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AutomationRulesService', () => {
  let service: AutomationRulesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      automationRule: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn(), delete: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [AutomationRulesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(AutomationRulesService);
  });

  describe('create', () => {
    it('rejects a stage_changed rule with no triggerToStage', async () => {
      await expect(
        service.create('company-1', 'user-1', {
          name: 'Rule',
          triggerEntityType: 'opportunity',
          triggerEvent: 'stage_changed',
          notificationTitle: 'Title',
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects a created rule that also sets a triggerToStage', async () => {
      await expect(
        service.create('company-1', 'user-1', {
          name: 'Rule',
          triggerEntityType: 'lead',
          triggerEvent: 'created',
          triggerToStage: 'proposal',
          notificationTitle: 'Title',
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('accepts a valid stage_changed rule and stores the stage', async () => {
      prisma.automationRule.create.mockResolvedValue({ id: 'rule-1' });

      await service.create('company-1', 'user-1', {
        name: 'Rule',
        triggerEntityType: 'opportunity',
        triggerEvent: 'stage_changed',
        triggerToStage: 'proposal',
        notificationTitle: 'Title',
      });

      const call = prisma.automationRule.create.mock.calls[0][0];
      expect(call.data.triggerToStage).toBe('proposal');
      expect(call.data.createdBy).toBe('user-1');
    });

    it('defaults isActive to true when not specified', async () => {
      prisma.automationRule.create.mockResolvedValue({ id: 'rule-1' });

      await service.create('company-1', 'user-1', {
        name: 'Rule',
        triggerEntityType: 'lead',
        triggerEvent: 'created',
        notificationTitle: 'Title',
      });

      expect(prisma.automationRule.create.mock.calls[0][0].data.isActive).toBe(true);
    });
  });

  describe('update — the partial-update consistency merge', () => {
    const existingStageRule = {
      id: 'rule-1',
      companyId: 'company-1',
      triggerEvent: 'stage_changed',
      triggerToStage: 'proposal',
    };
    const existingCreatedRule = {
      id: 'rule-2',
      companyId: 'company-1',
      triggerEvent: 'created',
      triggerToStage: null,
    };

    it('404s when the rule does not belong to the caller company', async () => {
      prisma.automationRule.findFirst.mockResolvedValue(null);
      await expect(service.update('company-1', 'rule-1', { name: 'New name' })).rejects.toThrow(NotFoundException);
    });

    it('allows updating just the name on a stage_changed rule WITHOUT resupplying triggerToStage', async () => {
      prisma.automationRule.findFirst.mockResolvedValue(existingStageRule);
      prisma.automationRule.update.mockResolvedValue({ ...existingStageRule, name: 'Renamed' });

      await service.update('company-1', 'rule-1', { name: 'Renamed' });

      const call = prisma.automationRule.update.mock.calls[0][0];
      expect(call.data.triggerToStage).toBe('proposal');
    });

    it('rejects switching an existing stage_changed rule to "created" — since the DTO has no way to explicitly clear triggerToStage, it is inherited from the existing row and correctly fails the "created must have no stage" check', async () => {
      prisma.automationRule.findFirst.mockResolvedValue(existingStageRule);

      await expect(service.update('company-1', 'rule-1', { triggerEvent: 'created' })).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects switching an existing created rule to stage_changed without providing a stage', async () => {
      prisma.automationRule.findFirst.mockResolvedValue(existingCreatedRule);

      await expect(service.update('company-1', 'rule-2', { triggerEvent: 'stage_changed' })).rejects.toThrow(UnprocessableEntityException);
    });

    it('accepts switching to stage_changed when a stage is provided in the same request', async () => {
      prisma.automationRule.findFirst.mockResolvedValue(existingCreatedRule);
      prisma.automationRule.update.mockResolvedValue({});

      await service.update('company-1', 'rule-2', { triggerEvent: 'stage_changed', triggerToStage: 'negotiation' });

      const call = prisma.automationRule.update.mock.calls[0][0];
      expect(call.data.triggerToStage).toBe('negotiation');
    });
  });

  describe('remove', () => {
    it('404s when the rule does not exist', async () => {
      prisma.automationRule.findFirst.mockResolvedValue(null);
      await expect(service.remove('company-1', 'rule-1')).rejects.toThrow(NotFoundException);
    });

    it('deletes an existing rule', async () => {
      prisma.automationRule.findFirst.mockResolvedValue({ id: 'rule-1' });
      prisma.automationRule.delete.mockResolvedValue({});

      await service.remove('company-1', 'rule-1');

      expect(prisma.automationRule.delete).toHaveBeenCalledWith({ where: { id: 'rule-1' } });
    });
  });
});
