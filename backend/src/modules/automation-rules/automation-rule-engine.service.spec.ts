import { Test } from '@nestjs/testing';
import { AutomationRuleEngineService } from './automation-rule-engine.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { notificationsServiceBackedBy } from '../notifications/testing/notifications-test-adapter';

describe('AutomationRuleEngineService', () => {
  let service: AutomationRuleEngineService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      automationRule: { findMany: jest.fn() },
      notification: { create: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [AutomationRuleEngineService, { provide: PrismaService, useValue: prisma }, { provide: NotificationsService, useValue: notificationsServiceBackedBy(prisma) }],
    }).compile();

    service = moduleRef.get(AutomationRuleEngineService);
  });

  describe('onLeadCreated', () => {
    it('does nothing when no active rules match', async () => {
      prisma.automationRule.findMany.mockResolvedValue([]);

      await service.onLeadCreated('company-1', { id: 'lead-1', name: 'Acme Corp', ownerId: 'user-1' });

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('queries only active rules for the lead/created combination — never stage_changed or opportunity rules', async () => {
      prisma.automationRule.findMany.mockResolvedValue([]);

      await service.onLeadCreated('company-1', { id: 'lead-1', name: 'Acme Corp', ownerId: 'user-1' });

      const call = prisma.automationRule.findMany.mock.calls[0][0];
      expect(call.where.companyId).toBe('company-1');
      expect(call.where.isActive).toBe(true);
      expect(call.where.triggerEntityType).toBe('lead');
      expect(call.where.triggerEvent).toBe('created');
      expect('triggerToStage' in call.where).toBe(false);
    });

    it('skips notifying entirely when the lead has no owner', async () => {
      prisma.automationRule.findMany.mockResolvedValue([{ id: 'rule-1', notificationTitle: 'New lead: {{name}}', notificationMessage: null }]);

      await service.onLeadCreated('company-1', { id: 'lead-1', name: 'Acme Corp', ownerId: null });

      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('creates a notification for the owner with {{name}} substituted in both title and message', async () => {
      prisma.automationRule.findMany.mockResolvedValue([
        { id: 'rule-1', notificationTitle: 'New lead: {{name}}', notificationMessage: 'Please follow up with {{name}} soon.' },
      ]);

      await service.onLeadCreated('company-1', { id: 'lead-1', name: 'Acme Corp', ownerId: 'user-1' });

      const createCall = prisma.notification.create.mock.calls[0][0];
      expect(createCall.data.userId).toBe('user-1');
      expect(createCall.data.title).toBe('New lead: Acme Corp');
      expect(createCall.data.message).toBe('Please follow up with Acme Corp soon.');
      expect(createCall.data.entityType).toBe('lead');
      expect(createCall.data.entityId).toBe('lead-1');
    });

    it('creates one notification per matching rule when multiple rules match the same trigger', async () => {
      prisma.automationRule.findMany.mockResolvedValue([
        { id: 'rule-1', notificationTitle: 'Rule 1: {{name}}', notificationMessage: null },
        { id: 'rule-2', notificationTitle: 'Rule 2: {{name}}', notificationMessage: null },
      ]);

      await service.onLeadCreated('company-1', { id: 'lead-1', name: 'Acme Corp', ownerId: 'user-1' });

      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    });

    it('leaves message null when the rule has no notificationMessage template', async () => {
      prisma.automationRule.findMany.mockResolvedValue([{ id: 'rule-1', notificationTitle: 'New lead: {{name}}', notificationMessage: null }]);

      await service.onLeadCreated('company-1', { id: 'lead-1', name: 'Acme Corp', ownerId: 'user-1' });

      const createCall = prisma.notification.create.mock.calls[0][0];
      expect(createCall.data.message).toBeNull();
    });
  });

  describe('onOpportunityStageChanged', () => {
    it('filters by the SPECIFIC target stage, not just entityType+event', async () => {
      prisma.automationRule.findMany.mockResolvedValue([]);

      await service.onOpportunityStageChanged('company-1', { id: 'opp-1', name: 'Big Deal', ownerId: 'user-1' }, 'proposal');

      const call = prisma.automationRule.findMany.mock.calls[0][0];
      expect(call.where.triggerEntityType).toBe('opportunity');
      expect(call.where.triggerEvent).toBe('stage_changed');
      expect(call.where.triggerToStage).toBe('proposal');
    });

    it('passes the exact stage through to the query filter for a different stage too', async () => {
      prisma.automationRule.findMany.mockResolvedValue([]);

      await service.onOpportunityStageChanged('company-1', { id: 'opp-1', name: 'Big Deal', ownerId: 'user-1' }, 'negotiation');

      const call = prisma.automationRule.findMany.mock.calls[0][0];
      expect(call.where.triggerToStage).toBe('negotiation');
    });
  });

  describe('onOpportunityCreated', () => {
    it('queries opportunity/created rules, with no stage filter at all', async () => {
      prisma.automationRule.findMany.mockResolvedValue([]);

      await service.onOpportunityCreated('company-1', { id: 'opp-1', name: 'Big Deal', ownerId: 'user-1' });

      const call = prisma.automationRule.findMany.mock.calls[0][0];
      expect(call.where.triggerEntityType).toBe('opportunity');
      expect(call.where.triggerEvent).toBe('created');
      expect('triggerToStage' in call.where).toBe(false);
    });
  });
});
