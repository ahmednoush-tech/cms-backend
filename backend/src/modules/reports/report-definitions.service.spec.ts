import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ReportDefinitionsService } from './report-definitions.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ReportDefinitionsService', () => {
  let service: ReportDefinitionsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { reportDefinition: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [ReportDefinitionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ReportDefinitionsService);
  });

  describe('create — registry validation (the actual security boundary)', () => {
    it('rejects an entityType that does not exist in the registry at all', async () => {
      const dto = { name: 'x', entityType: 'users', groupByField: 'anything', aggregateType: 'count' as const };
      await expect(service.create('company-1', 'user-1', dto)).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.reportDefinition.create).not.toHaveBeenCalled();
    });

    it("rejects a groupByField not in that entity's allowed list — this is what actually prevents an arbitrary column name from ever reaching a query", async () => {
      const dto = { name: 'x', entityType: 'lead', groupByField: 'passwordHash', aggregateType: 'count' as const };
      await expect(service.create('company-1', 'user-1', dto)).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.reportDefinition.create).not.toHaveBeenCalled();
    });

    it('rejects aggregateType "sum" without an aggregateField', async () => {
      const dto = { name: 'x', entityType: 'opportunity', groupByField: 'stage', aggregateType: 'sum' as const };
      await expect(service.create('company-1', 'user-1', dto)).rejects.toThrow(UnprocessableEntityException);
    });

    it("rejects aggregateType \"sum\" with an aggregateField not in that entity's sum-eligible list", async () => {
      const dto = { name: 'x', entityType: 'opportunity', groupByField: 'stage', aggregateType: 'sum' as const, aggregateField: 'id' };
      await expect(service.create('company-1', 'user-1', dto)).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects aggregateType "count" WITH an aggregateField set (nothing to sum)', async () => {
      const dto = { name: 'x', entityType: 'lead', groupByField: 'status', aggregateType: 'count' as const, aggregateField: 'value' };
      await expect(service.create('company-1', 'user-1', dto)).rejects.toThrow(UnprocessableEntityException);
    });

    it("rejects a filter field not in that entity's allowed filter list", async () => {
      const dto = {
        name: 'x',
        entityType: 'lead',
        groupByField: 'status',
        aggregateType: 'count' as const,
        filters: [{ field: 'notARealField', operator: 'eq' as const, value: 'x' }],
      };
      await expect(service.create('company-1', 'user-1', dto)).rejects.toThrow(UnprocessableEntityException);
    });

    it('accepts a fully valid definition and persists it', async () => {
      prisma.reportDefinition.create.mockResolvedValue({ id: 'report-1' });
      const dto = { name: 'Opps by stage', entityType: 'opportunity', groupByField: 'stage', aggregateType: 'sum' as const, aggregateField: 'value' };

      await service.create('company-1', 'user-1', dto);

      const call = prisma.reportDefinition.create.mock.calls[0][0];
      expect(call.data.companyId).toBe('company-1');
      expect(call.data.createdBy).toBe('user-1');
      expect(call.data.entityType).toBe('opportunity');
    });
  });

  describe('update', () => {
    it('404s before attempting to update a report from another company', async () => {
      prisma.reportDefinition.findFirst.mockResolvedValue(null);
      await expect(service.update('company-1', 'report-1', { name: 'New Name' })).rejects.toThrow(NotFoundException);
      expect(prisma.reportDefinition.update).not.toHaveBeenCalled();
    });

    it('re-validates using the EXISTING stored values when a rename-only update omits every other field', async () => {
      prisma.reportDefinition.findFirst.mockResolvedValue({
        id: 'report-1',
        entityType: 'opportunity',
        groupByField: 'stage',
        aggregateType: 'sum',
        aggregateField: 'value',
        filters: [],
      });
      prisma.reportDefinition.update.mockResolvedValue({ id: 'report-1', name: 'New Name' });

      await expect(service.update('company-1', 'report-1', { name: 'New Name' })).resolves.toBeDefined();
      expect(prisma.reportDefinition.update).toHaveBeenCalled();
    });

    it('rejects an update that changes groupByField to an invalid one for the (unchanged) entityType', async () => {
      prisma.reportDefinition.findFirst.mockResolvedValue({
        id: 'report-1',
        entityType: 'lead',
        groupByField: 'status',
        aggregateType: 'count',
        aggregateField: null,
        filters: [],
      });

      await expect(service.update('company-1', 'report-1', { groupByField: 'passwordHash' })).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.reportDefinition.update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('soft-deletes rather than hard-deleting', async () => {
      prisma.reportDefinition.findFirst.mockResolvedValue({ id: 'report-1' });
      prisma.reportDefinition.update.mockResolvedValue({ id: 'report-1', deletedAt: new Date() });

      await service.remove('company-1', 'report-1');

      const call = prisma.reportDefinition.update.mock.calls[0][0];
      expect(call.data.deletedAt).toBeInstanceOf(Date);
    });
  });
});
