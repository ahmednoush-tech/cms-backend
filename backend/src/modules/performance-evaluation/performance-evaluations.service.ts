import { Injectable, BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePerformanceEvaluationDto, UpdatePerformanceEvaluationDto } from './dto/performance-evaluation.dto';

@Injectable()
export class PerformanceEvaluationsService {
  constructor(private prisma: PrismaService) {}

  async findAllForEmployee(companyId: string, employeeId: string) {
    return this.prisma.performanceEvaluation.findMany({
      where: { companyId, employeeId },
      include: { cycle: true, evaluator: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllForCycle(companyId: string, cycleId: string) {
    return this.prisma.performanceEvaluation.findMany({
      where: { companyId, cycleId },
      include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const evaluation = await this.prisma.performanceEvaluation.findFirst({
      where: { id, companyId },
      include: {
        cycle: true,
        employee: { select: { id: true, firstName: true, lastName: true } },
        evaluator: { select: { id: true, name: true } },
        scores: { include: { criterion: true } },
      },
    });
    if (!evaluation) throw new NotFoundException('Performance evaluation not found.');
    return evaluation;
  }

  /**
   * Validates every scored criterionId actually belongs to this
   * company and is still active — a stale or cross-company
   * criterion id must never silently attach to an evaluation.
   */
  private async assertValidCriteria(companyId: string, criterionIds: string[]) {
    if (criterionIds.length === 0) return;
    const found = await this.prisma.performanceCriterion.findMany({
      where: { id: { in: criterionIds }, companyId, deletedAt: null },
      select: { id: true },
    });
    const foundIds = new Set(found.map((c) => c.id));
    const missing = criterionIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new UnprocessableEntityException(`Unknown or inactive criterion id(s): ${missing.join(', ')}`);
    }
  }

  async create(companyId: string, evaluatorId: string, dto: CreatePerformanceEvaluationDto) {
    const cycle = await this.prisma.performanceCycle.findFirst({ where: { id: dto.cycleId, companyId } });
    if (!cycle) throw new NotFoundException('Performance cycle not found.');
    if (cycle.status !== 'open') {
      throw new UnprocessableEntityException('Cannot create an evaluation against a closed cycle.');
    }

    const employee = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId, deletedAt: null } });
    if (!employee) throw new NotFoundException('Employee not found.');

    const existing = await this.prisma.performanceEvaluation.findUnique({
      where: { cycleId_employeeId: { cycleId: dto.cycleId, employeeId: dto.employeeId } },
    });
    if (existing) {
      throw new UnprocessableEntityException('An evaluation for this employee already exists for this cycle.');
    }

    await this.assertValidCriteria(companyId, dto.scores.map((s) => s.criterionId));

    return this.prisma.performanceEvaluation.create({
      data: {
        companyId,
        cycleId: dto.cycleId,
        employeeId: dto.employeeId,
        evaluatorId,
        overallComments: dto.overallComments,
        status: 'draft',
        scores: { create: dto.scores.map((s) => ({ criterionId: s.criterionId, score: s.score, comments: s.comments })) },
      },
      include: { scores: true },
    });
  }

  /**
   * REPLACES the full score set (delete-then-recreate inside a
   * transaction), rather than merging field-by-field — a
   * performance review is edited as a whole document while in
   * draft (a manager revising their assessment), not as
   * independently-patched individual fields the way a CRM record's
   * custom fields are. Only permitted while status is 'draft' —
   * once finalized, an evaluation is a fixed historical record.
   */
  async update(companyId: string, id: string, dto: UpdatePerformanceEvaluationDto) {
    const evaluation = await this.findOne(companyId, id);
    if (evaluation.status !== 'draft') {
      throw new UnprocessableEntityException('Cannot edit an evaluation that has already been finalized.');
    }

    if (dto.scores) {
      await this.assertValidCriteria(companyId, dto.scores.map((s) => s.criterionId));
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.scores) {
        await tx.performanceEvaluationScore.deleteMany({ where: { evaluationId: id } });
        await tx.performanceEvaluationScore.createMany({
          data: dto.scores.map((s) => ({ evaluationId: id, criterionId: s.criterionId, score: s.score, comments: s.comments })),
        });
      }
      return tx.performanceEvaluation.update({
        where: { id },
        data: { overallComments: dto.overallComments },
        include: { scores: true },
      });
    });
  }

  /**
   * Requires EVERY currently-active company criterion to have a
   * score recorded — an evaluation that only rated some dimensions
   * is not yet a complete review. overallRating is computed here,
   * ONCE, as a snapshot (unweighted average, rounded to 2 decimal
   * places) — see migration 087's comment for why this never gets
   * recalculated later even if criteria subsequently change.
   */
  async finalize(companyId: string, id: string) {
    const evaluation = await this.findOne(companyId, id);
    if (evaluation.status !== 'draft') {
      throw new UnprocessableEntityException('This evaluation has already been finalized.');
    }

    const activeCriteria = await this.prisma.performanceCriterion.findMany({ where: { companyId, deletedAt: null }, select: { id: true } });
    if (activeCriteria.length === 0) {
      throw new BadRequestException('Cannot finalize — this company has no active performance criteria defined yet.');
    }
    const scoredCriterionIds = new Set(evaluation.scores.map((s) => s.criterionId));
    const missing = activeCriteria.filter((c) => !scoredCriterionIds.has(c.id));
    if (missing.length > 0) {
      throw new BadRequestException(`Cannot finalize — ${missing.length} active criterion/criteria have not been scored yet.`);
    }

    const average = evaluation.scores.reduce((sum, s) => sum + s.score, 0) / evaluation.scores.length;

    return this.prisma.performanceEvaluation.update({
      where: { id },
      data: { status: 'finalized', finalizedAt: new Date(), overallRating: Math.round(average * 100) / 100 },
    });
  }
}
