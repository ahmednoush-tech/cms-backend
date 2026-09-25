import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InteractionsService } from './interactions.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('InteractionsService', () => {
  let service: InteractionsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      customer: { findFirst: jest.fn() },
      lead: { findFirst: jest.fn() },
      opportunity: { findFirst: jest.fn() },
      interaction: { create: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [InteractionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(InteractionsService);
  });

  describe('create', () => {
    it('rejects an interaction with NONE of customerId/leadId/opportunityId set', async () => {
      await expect(
        service.create('company-1', 'user-1', { type: 'call', subject: 'Follow up', interactionDate: '2026-06-01' } as any),
      ).rejects.toThrow(UnprocessableEntityException);

      expect(prisma.interaction.create).not.toHaveBeenCalled();
    });

    it('404s when the referenced customer does not belong to the caller company', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.create('company-1', 'user-1', { customerId: 'other-company-customer', type: 'call', subject: 'x', interactionDate: '2026-06-01' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('404s when the referenced lead does not belong to the caller company', async () => {
      prisma.lead.findFirst.mockResolvedValue(null);

      await expect(
        service.create('company-1', 'user-1', { leadId: 'other-company-lead', type: 'call', subject: 'x', interactionDate: '2026-06-01' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('404s when the referenced opportunity does not belong to the caller company', async () => {
      prisma.opportunity.findFirst.mockResolvedValue(null);

      await expect(
        service.create('company-1', 'user-1', { opportunityId: 'other-company-opp', type: 'call', subject: 'x', interactionDate: '2026-06-01' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows an interaction with only ONE of the three links set', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.interaction.create.mockResolvedValue({ id: 'int-1' });

      await expect(
        service.create('company-1', 'user-1', { customerId: 'cust-1', type: 'meeting', subject: 'Kickoff', interactionDate: '2026-06-01' } as any),
      ).resolves.toBeDefined();
    });

    it('allows an interaction linked to all three at once', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.lead.findFirst.mockResolvedValue({ id: 'lead-1' });
      prisma.opportunity.findFirst.mockResolvedValue({ id: 'opp-1' });
      prisma.interaction.create.mockResolvedValue({ id: 'int-1' });

      await service.create('company-1', 'user-1', {
        customerId: 'cust-1', leadId: 'lead-1', opportunityId: 'opp-1',
        type: 'call', subject: 'x', interactionDate: '2026-06-01',
      } as any);

      const call = prisma.interaction.create.mock.calls[0][0];
      expect(call.data.customerId).toBe('cust-1');
      expect(call.data.leadId).toBe('lead-1');
      expect(call.data.opportunityId).toBe('opp-1');
    });

    it('stamps createdBy with the acting user', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.interaction.create.mockResolvedValue({ id: 'int-1' });

      await service.create('company-1', 'user-42', { customerId: 'cust-1', type: 'note', subject: 'x', interactionDate: '2026-06-01' } as any);

      expect(prisma.interaction.create.mock.calls[0][0].data.createdBy).toBe('user-42');
    });
  });

  describe('findAllForCustomer / findAllForLead / findAllForOpportunity', () => {
    it('404s when the parent customer does not exist in the caller company', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);
      await expect(service.findAllForCustomer('company-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('404s when the parent lead does not exist in the caller company', async () => {
      prisma.lead.findFirst.mockResolvedValue(null);
      await expect(service.findAllForLead('company-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('404s when the parent opportunity does not exist in the caller company', async () => {
      prisma.opportunity.findFirst.mockResolvedValue(null);
      await expect(service.findAllForOpportunity('company-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('orders results by interactionDate descending', async () => {
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.interaction.findMany.mockResolvedValue([]);

      await service.findAllForCustomer('company-1', 'cust-1');

      expect(prisma.interaction.findMany.mock.calls[0][0].orderBy).toEqual({ interactionDate: 'desc' });
    });
  });

  describe('update', () => {
    it('404s when the interaction does not exist in the caller company', async () => {
      prisma.interaction.findFirst.mockResolvedValue(null);
      await expect(service.update('company-1', 'missing', { subject: 'x' } as any)).rejects.toThrow(NotFoundException);
    });

    it('never includes customerId/leadId/opportunityId in the update payload, even if present on the DTO', async () => {
      prisma.interaction.findFirst.mockResolvedValue({ id: 'int-1' });
      prisma.interaction.update.mockResolvedValue({ id: 'int-1' });

      await service.update('company-1', 'int-1', { subject: 'Updated', customerId: 'someone-elses-customer' } as any);

      const call = prisma.interaction.update.mock.calls[0][0];
      expect(call.data.customerId).toBeUndefined();
      expect(call.data.subject).toBe('Updated');
    });
  });

  describe('softDelete', () => {
    it('404s when the interaction does not exist in the caller company', async () => {
      prisma.interaction.findFirst.mockResolvedValue(null);
      await expect(service.softDelete('company-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('sets deletedAt rather than removing the row', async () => {
      prisma.interaction.findFirst.mockResolvedValue({ id: 'int-1' });
      prisma.interaction.update.mockResolvedValue({ id: 'int-1', deletedAt: new Date() });

      await service.softDelete('company-1', 'int-1');

      const call = prisma.interaction.update.mock.calls[0][0];
      expect(call.data.deletedAt).toBeInstanceOf(Date);
    });
  });
});
