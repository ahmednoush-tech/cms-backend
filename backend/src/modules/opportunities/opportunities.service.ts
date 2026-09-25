import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityLogService } from '../../common/services/activity-log.service';
import {
  OPPORTUNITY_TRANSITIONS,
  WorkflowTransitionValidator,
} from '../../common/services/workflow-transition.validator';
import { CustomersService } from '../customers/customers.service';
import {
  CreateOpportunityDto,
  UpdateOpportunityDto,
  UpdateOpportunityStageDto,
} from './dto/opportunity.dto';
import { PaginationQueryDto, buildMeta } from '../../common/dto/pagination-query.dto';
import { OpportunityFiltersDto } from './dto/opportunity-filters.dto';
import { AutomationRuleEngineService } from '../automation-rules/automation-rule-engine.service';
import { CustomFieldValidationService } from '../custom-fields/custom-field-validation.service';

@Injectable()
export class OpportunitiesService {
  constructor(
    private prisma: PrismaService,
    private activityLog: ActivityLogService,
    private customersService: CustomersService,
    private automationRuleEngine: AutomationRuleEngineService,
    private customFieldValidation: CustomFieldValidationService,
  ) {}

  async create(companyId: string, actorUserId: string, dto: CreateOpportunityDto) {
    await this.customersService.assertCustomerBelongsToCompany(companyId, dto.customerId);
    const customFields = await this.customFieldValidation.validateAndNormalize(companyId, 'opportunity', dto.customFields);

    const opportunity = await this.prisma.opportunity.create({
      data: {
        companyId,
        customerId: dto.customerId,
        name: dto.name,
        description: dto.description,
        value: dto.value,
        currency: dto.currency,
        probability: dto.probability,
        expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : undefined,
        ownerId: dto.ownerId ?? actorUserId,
        customFields: customFields as Prisma.InputJsonValue,
      },
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'created',
      entityType: 'opportunity',
      entityId: opportunity.id,
      newValues: opportunity,
    });

    await this.automationRuleEngine.onOpportunityCreated(companyId, { id: opportunity.id, name: opportunity.name, ownerId: opportunity.ownerId });

    return opportunity;
  }

  async findAll(companyId: string, query: OpportunityFiltersDto) {
    const { page, pageSize, search, sortBy, sortDir, customerId, stage } = query;
    const where = {
      companyId,
      deletedAt: null,
      ...(customerId ? { customerId } : {}),
      ...(stage ? { stage } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.opportunity.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sortBy ?? 'createdAt']: sortDir },
      }),
      this.prisma.opportunity.count({ where }),
    ]);

    return { items, meta: buildMeta(page, pageSize, total) };
  }

  async findOne(companyId: string, id: string) {
    const opportunity = await this.prisma.opportunity.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { customer: true, quotations: true },
    });
    if (!opportunity) throw new NotFoundException('Opportunity not found.');
    return opportunity;
  }

  /**
   * customFields validation now merges internally (see
   * CustomFieldValidationService's own comment) — passing
   * dto.customFields and before.customFields SEPARATELY (not
   * pre-merged) lets a required field already missing from BEFORE
   * this update, and not part of THIS request, avoid blocking an
   * otherwise unrelated update.
   */
  async update(companyId: string, actorUserId: string, id: string, dto: UpdateOpportunityDto) {
    const before = await this.findOne(companyId, id);

    let customFields: Record<string, unknown> | undefined;
    if (dto.customFields !== undefined) {
      customFields = await this.customFieldValidation.validateAndNormalize(
        companyId,
        'opportunity',
        dto.customFields,
        before.customFields as Record<string, unknown>,
      );
    }

    const updated = await this.prisma.opportunity.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        value: dto.value,
        currency: dto.currency,
        probability: dto.probability,
        expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : undefined,
        ownerId: dto.ownerId,
        ...(customFields !== undefined ? { customFields: customFields as Prisma.InputJsonValue } : {}),
      },
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'updated',
      entityType: 'opportunity',
      entityId: id,
      oldValues: before,
      newValues: updated,
    });

    return updated;
  }

  async updateStage(
    companyId: string,
    actorUserId: string,
    id: string,
    dto: UpdateOpportunityStageDto,
  ) {
    const before = await this.findOne(companyId, id);

    WorkflowTransitionValidator.assertValidTransition(
      'opportunity',
      OPPORTUNITY_TRANSITIONS,
      before.stage,
      dto.stage,
    );

    const updated = await this.prisma.opportunity.update({
      where: { id },
      data: { stage: dto.stage },
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'status_changed',
      entityType: 'opportunity',
      entityId: id,
      oldValues: { stage: before.stage },
      newValues: { stage: updated.stage },
    });

    await this.automationRuleEngine.onOpportunityStageChanged(
      companyId,
      { id: updated.id, name: updated.name, ownerId: updated.ownerId },
      updated.stage,
    );

    return updated;
  }

  async softDelete(companyId: string, actorUserId: string, id: string) {
    const before = await this.findOne(companyId, id);
    const deleted = await this.prisma.opportunity.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.activityLog.record({
      companyId,
      userId: actorUserId,
      action: 'deleted',
      entityType: 'opportunity',
      entityId: id,
      oldValues: before,
    });

    return deleted;
  }
}
