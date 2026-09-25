import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PerformanceEvaluationsService } from './performance-evaluations.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PerformanceEvaluationsService', () => {
  let service: PerformanceEvaluationsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      performanceCycle: { findFirst: jest.fn() },
      employee: { findFirst: jest.fn() },
      performanceEvaluation: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      performanceCriterion: { findMany: jest.fn() },
      performanceEvaluationScore: { deleteMany: jest.fn(), createMany: jest.fn() },
      $transaction: jest.fn((fn) => fn(prisma)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [PerformanceEvaluationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(PerformanceEvaluationsService);
  });

  describe('create', () => {
    const validDto = { cycleId: 'cycle-1', employeeId: 'emp-1', scores: [{ criterionId: 'crit-1', score: 4 }] };

    it('rejects creating an evaluation against a closed cycle', async () => {
      prisma.performanceCycle.findFirst.mockResolvedValue({ id: 'cycle-1', status: 'closed' });
      await expect(service.create('company-1', 'evaluator-1', validDto as any)).rejects.toThrow(UnprocessableEntityException);
    });

    it('404s when the cycle does not exist', async () => {
      prisma.performanceCycle.findFirst.mockResolvedValue(null);
      await expect(service.create('company-1', 'evaluator-1', validDto as any)).rejects.toThrow(NotFoundException);
    });

    it('404s when the employee does not exist', async () => {
      prisma.performanceCycle.findFirst.mockResolvedValue({ id: 'cycle-1', status: 'open' });
      prisma.employee.findFirst.mockResolvedValue(null);
      await expect(service.create('company-1', 'evaluator-1', validDto as any)).rejects.toThrow(NotFoundException);
    });

    it('rejects a duplicate evaluation for the same cycle+employee', async () => {
      prisma.performanceCycle.findFirst.mockResolvedValue({ id: 'cycle-1', status: 'open' });
      prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
      prisma.performanceEvaluation.findUnique.mockResolvedValue({ id: 'existing-eval' });
      await expect(service.create('company-1', 'evaluator-1', validDto as any)).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects a score referencing an unknown or inactive criterion', async () => {
      prisma.performanceCycle.findFirst.mockResolvedValue({ id: 'cycle-1', status: 'open' });
      prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
      prisma.performanceEvaluation.findUnique.mockResolvedValue(null);
      prisma.performanceCriterion.findMany.mockResolvedValue([]);
      await expect(service.create('company-1', 'evaluator-1', validDto as any)).rejects.toThrow(UnprocessableEntityException);
    });

    it('creates in draft status with the given scores when everything is valid', async () => {
      prisma.performanceCycle.findFirst.mockResolvedValue({ id: 'cycle-1', status: 'open' });
      prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
      prisma.performanceEvaluation.findUnique.mockResolvedValue(null);
      prisma.performanceCriterion.findMany.mockResolvedValue([{ id: 'crit-1' }]);
      prisma.performanceEvaluation.create.mockResolvedValue({ id: 'new-eval', status: 'draft' });

      await service.create('company-1', 'evaluator-1', validDto as any);

      const call = prisma.performanceEvaluation.create.mock.calls[0][0];
      expect(call.data.status).toBe('draft');
      expect(call.data.evaluatorId).toBe('evaluator-1');
    });

    it('does not require every criterion to be scored at create time (partial draft is allowed)', async () => {
      prisma.performanceCycle.findFirst.mockResolvedValue({ id: 'cycle-1', status: 'open' });
      prisma.employee.findFirst.mockResolvedValue({ id: 'emp-1' });
      prisma.performanceEvaluation.findUnique.mockResolvedValue(null);
      prisma.performanceCriterion.findMany.mockResolvedValue([{ id: 'crit-1' }]);
      prisma.performanceEvaluation.create.mockResolvedValue({ id: 'new-eval' });

      await expect(service.create('company-1', 'evaluator-1', { ...validDto, scores: [] } as any)).resolves.toBeDefined();
    });
  });

  describe('update', () => {
    it('rejects editing an already-finalized evaluation', async () => {
      prisma.performanceEvaluation.findFirst.mockResolvedValue({ id: 'eval-1', status: 'finalized', scores: [] });
      await expect(service.update('company-1', 'eval-1', { overallComments: 'x' })).rejects.toThrow(UnprocessableEntityException);
    });

    it('REPLACES the score set entirely (delete then recreate), not a merge', async () => {
      prisma.performanceEvaluation.findFirst.mockResolvedValue({ id: 'eval-1', status: 'draft', scores: [{ criterionId: 'crit-old' }] });
      prisma.performanceCriterion.findMany.mockResolvedValue([{ id: 'crit-new' }]);
      prisma.performanceEvaluation.update.mockResolvedValue({ id: 'eval-1' });

      await service.update('company-1', 'eval-1', { scores: [{ criterionId: 'crit-new', score: 3 }] });

      expect(prisma.performanceEvaluationScore.deleteMany).toHaveBeenCalledWith({ where: { evaluationId: 'eval-1' } });
      expect(prisma.performanceEvaluationScore.createMany).toHaveBeenCalledWith({
        data: [{ evaluationId: 'eval-1', criterionId: 'crit-new', score: 3, comments: undefined }],
      });
    });

    it('leaves scores untouched entirely when the update omits them', async () => {
      prisma.performanceEvaluation.findFirst.mockResolvedValue({ id: 'eval-1', status: 'draft', scores: [{ criterionId: 'crit-1' }] });
      prisma.performanceEvaluation.update.mockResolvedValue({ id: 'eval-1' });

      await service.update('company-1', 'eval-1', { overallComments: 'just updating comments' });

      expect(prisma.performanceEvaluationScore.deleteMany).not.toHaveBeenCalled();
      expect(prisma.performanceEvaluationScore.createMany).not.toHaveBeenCalled();
    });
  });

  describe('finalize', () => {
    it('rejects finalizing an already-finalized evaluation', async () => {
      prisma.performanceEvaluation.findFirst.mockResolvedValue({ id: 'eval-1', status: 'finalized', scores: [] });
      await expect(service.finalize('company-1', 'eval-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects finalizing when the company has zero active criteria defined (the NaN-rating bug this guards against)', async () => {
      prisma.performanceEvaluation.findFirst.mockResolvedValue({ id: 'eval-1', status: 'draft', scores: [] });
      prisma.performanceCriterion.findMany.mockResolvedValue([]);
      await expect(service.finalize('company-1', 'eval-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects finalizing when some active criteria remain unscored', async () => {
      prisma.performanceEvaluation.findFirst.mockResolvedValue({ id: 'eval-1', status: 'draft', scores: [{ criterionId: 'crit-1', score: 4 }] });
      prisma.performanceCriterion.findMany.mockResolvedValue([{ id: 'crit-1' }, { id: 'crit-2' }]);
      await expect(service.finalize('company-1', 'eval-1')).rejects.toThrow(BadRequestException);
    });

    it('computes the correct unweighted average and sets status to finalized', async () => {
      prisma.performanceEvaluation.findFirst.mockResolvedValue({
        id: 'eval-1',
        status: 'draft',
        scores: [
          { criterionId: 'crit-1', score: 4 },
          { criterionId: 'crit-2', score: 5 },
        ],
      });
      prisma.performanceCriterion.findMany.mockResolvedValue([{ id: 'crit-1' }, { id: 'crit-2' }]);
      prisma.performanceEvaluation.update.mockResolvedValue({ id: 'eval-1', status: 'finalized' });

      await service.finalize('company-1', 'eval-1');

      const call = prisma.performanceEvaluation.update.mock.calls[0][0];
      expect(call.data.status).toBe('finalized');
      expect(call.data.overallRating).toBe(4.5);
      expect(call.data.finalizedAt).toBeInstanceOf(Date);
    });
  });
});
