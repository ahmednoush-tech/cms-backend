import { Test } from '@nestjs/testing';
import { UnprocessableEntityException } from '@nestjs/common';
import { ReportRunnerService } from './report-runner.service';
import { ReportDefinitionsService } from './report-definitions.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ReportRunnerService', () => {
  let service: ReportRunnerService;
  let prisma: any;
  let reportDefinitionsService: any;

  beforeEach(async () => {
    prisma = { lead: { groupBy: jest.fn() }, opportunity: { groupBy: jest.fn() } };
    reportDefinitionsService = { findOne: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportRunnerService,
        { provide: PrismaService, useValue: prisma },
        { provide: ReportDefinitionsService, useValue: reportDefinitionsService },
      ],
    }).compile();

    service = moduleRef.get(ReportRunnerService);
  });

  describe('run (saved report)', () => {
    it('re-validates the SAVED definition against the registry at run time, not just at save time', async () => {
      reportDefinitionsService.findOne.mockResolvedValue({
        entityType: 'lead',
        groupByField: 'notARealFieldAnymore',
        aggregateType: 'count',
        aggregateField: null,
        filters: [],
      });

      await expect(service.run('company-1', 'report-1')).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.lead.groupBy).not.toHaveBeenCalled();
    });

    it("delegates to the correct entity's own groupBy call, scoped to the caller company", async () => {
      reportDefinitionsService.findOne.mockResolvedValue({
        entityType: 'lead',
        groupByField: 'status',
        aggregateType: 'count',
        aggregateField: null,
        filters: [],
      });
      prisma.lead.groupBy.mockResolvedValue([
        { status: 'new', _count: 5 },
        { status: 'won', _count: 2 },
      ]);

      const result = await service.run('company-1', 'report-1');

      const call = prisma.lead.groupBy.mock.calls[0][0];
      expect(call.where.companyId).toBe('company-1');
      expect(result).toEqual([
        { label: 'new', value: 5 },
        { label: 'won', value: 2 },
      ]);
    });
  });

  describe('runAdHoc (preview before saving)', () => {
    it('rejects an unregistered entityType without ever touching the database', async () => {
      const dto = { name: 'x', entityType: 'not_a_real_entity', groupByField: 'x', aggregateType: 'count' as const };
      await expect(service.runAdHoc('company-1', dto)).rejects.toThrow(UnprocessableEntityException);
    });

    it('applies string-equality filters exactly as given, using only the validated field name', async () => {
      prisma.lead.groupBy.mockResolvedValue([]);
      const dto = {
        name: 'x',
        entityType: 'lead',
        groupByField: 'status',
        aggregateType: 'count' as const,
        filters: [{ field: 'source', operator: 'eq' as const, value: 'website' }],
      };

      await service.runAdHoc('company-1', dto);

      const call = prisma.lead.groupBy.mock.calls[0][0];
      expect(call.where.source).toBe('website');
    });
  });
});
