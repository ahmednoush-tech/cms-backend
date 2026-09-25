import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CrmTimelineService } from './crm-timeline.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CrmTimelineService', () => {
  let service: CrmTimelineService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      customer: { findFirst: jest.fn() },
      lead: { findFirst: jest.fn() },
      interaction: { findMany: jest.fn() },
      activityLog: { findMany: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [CrmTimelineService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(CrmTimelineService);
  });

  describe('existence checks', () => {
    it('404s when the customer does not belong to the caller company', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);
      await expect(service.getTimeline('company-1', 'customer', 'cust-1')).rejects.toThrow(NotFoundException);
    });

    it('404s when the lead does not belong to the caller company', async () => {
      prisma.lead.findFirst.mockResolvedValue(null);
      await expect(service.getTimeline('company-1', 'lead', 'lead-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('scoping the query correctly by entity type', () => {
    it('filters interactions by customerId when entityType is customer', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.interaction.findMany.mockResolvedValue([]);
      prisma.activityLog.findMany.mockResolvedValue([]);

      await service.getTimeline('company-1', 'customer', 'cust-1');

      const interactionCall = prisma.interaction.findMany.mock.calls[0][0];
      expect(interactionCall.where.customerId).toBe('cust-1');
      expect('leadId' in interactionCall.where).toBe(false);
    });

    it('filters interactions by leadId when entityType is lead', async () => {
      prisma.lead.findFirst.mockResolvedValue({ id: 'lead-1' });
      prisma.interaction.findMany.mockResolvedValue([]);
      prisma.activityLog.findMany.mockResolvedValue([]);

      await service.getTimeline('company-1', 'lead', 'lead-1');

      const interactionCall = prisma.interaction.findMany.mock.calls[0][0];
      expect(interactionCall.where.leadId).toBe('lead-1');
      expect('customerId' in interactionCall.where).toBe(false);
    });

    it('scopes ActivityLog by BOTH entityType and entityId', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.interaction.findMany.mockResolvedValue([]);
      prisma.activityLog.findMany.mockResolvedValue([]);

      await service.getTimeline('company-1', 'customer', 'cust-1');

      const activityCall = prisma.activityLog.findMany.mock.calls[0][0];
      expect(activityCall.where.entityType).toBe('customer');
      expect(activityCall.where.entityId).toBe('cust-1');
    });
  });

  describe('merging and sorting', () => {
    it('merges interactions and activity log entries into one list, sorted newest first', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.interaction.findMany.mockResolvedValue([
        { id: 'int-1', type: 'call', subject: 'Follow-up call', notes: 'Went well', interactionDate: new Date('2026-06-01'), createdBy: 'user-1' },
      ]);
      prisma.activityLog.findMany.mockResolvedValue([
        { id: 'act-1', action: 'created', oldValues: null, newValues: null, createdAt: new Date('2026-06-05'), userId: 'user-1' },
      ]);

      const result = await service.getTimeline('company-1', 'customer', 'cust-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('act-1');
      expect(result[1].id).toBe('int-1');
    });

    it('tags each event with the correct source', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.interaction.findMany.mockResolvedValue([
        { id: 'int-1', type: 'email', subject: 'Sent quote', notes: null, interactionDate: new Date('2026-06-01'), createdBy: 'user-1' },
      ]);
      prisma.activityLog.findMany.mockResolvedValue([
        { id: 'act-1', action: 'created', oldValues: null, newValues: null, createdAt: new Date('2026-06-05'), userId: 'user-1' },
      ]);

      const result = await service.getTimeline('company-1', 'customer', 'cust-1');

      expect(result.find((e) => e.id === 'int-1')!.source).toBe('interaction');
      expect(result.find((e) => e.id === 'act-1')!.source).toBe('activity');
    });
  });

  describe('describing activity log entries', () => {
    it('shows "Changed from X to Y" when a status_changed entry has recognizable stage values', async () => {
      prisma.lead.findFirst.mockResolvedValue({ id: 'lead-1' });
      prisma.interaction.findMany.mockResolvedValue([]);
      prisma.activityLog.findMany.mockResolvedValue([
        { id: 'act-1', action: 'status_changed', oldValues: { stage: 'prospecting' }, newValues: { stage: 'qualification' }, createdAt: new Date(), userId: 'user-1' },
      ]);

      const result = await service.getTimeline('company-1', 'lead', 'lead-1');

      expect(result[0].title).toBe('Changed from "prospecting" to "qualification"');
    });

    it('falls back to a plain "Status changed" label when the JSON has no recognizable stage/status field', async () => {
      prisma.lead.findFirst.mockResolvedValue({ id: 'lead-1' });
      prisma.interaction.findMany.mockResolvedValue([]);
      prisma.activityLog.findMany.mockResolvedValue([
        { id: 'act-1', action: 'status_changed', oldValues: { somethingElse: 1 }, newValues: null, createdAt: new Date(), userId: 'user-1' },
      ]);

      const result = await service.getTimeline('company-1', 'lead', 'lead-1');

      expect(result[0].title).toBe('Status changed');
    });

    it('uses a plain honest label for "created" — never invents details from JSON it does not understand', async () => {
      prisma.lead.findFirst.mockResolvedValue({ id: 'lead-1' });
      prisma.interaction.findMany.mockResolvedValue([]);
      prisma.activityLog.findMany.mockResolvedValue([
        { id: 'act-1', action: 'created', oldValues: null, newValues: { anything: 'here' }, createdAt: new Date(), userId: 'user-1' },
      ]);

      const result = await service.getTimeline('company-1', 'lead', 'lead-1');

      expect(result[0].title).toBe('Record created');
    });
  });
});
