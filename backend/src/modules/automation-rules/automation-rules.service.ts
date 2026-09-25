import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto';
import { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto';

@Injectable()
export class AutomationRulesService {
  constructor(private prisma: PrismaService) {}

  async create(companyId: string, actorUserId: string, dto: CreateAutomationRuleDto) {
    this.assertStageConsistency(dto.triggerEvent, dto.triggerToStage);

    return this.prisma.automationRule.create({
      data: {
        companyId,
        name: dto.name,
        isActive: dto.isActive ?? true,
        triggerEntityType: dto.triggerEntityType,
        triggerEvent: dto.triggerEvent,
        triggerToStage: dto.triggerEvent === 'stage_changed' ? dto.triggerToStage : null,
        notificationTitle: dto.notificationTitle,
        notificationMessage: dto.notificationMessage,
        createdBy: actorUserId,
      },
    });
  }

  async findAll(companyId: string) {
    return this.prisma.automationRule.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  }

  async findOne(companyId: string, id: string) {
    const rule = await this.prisma.automationRule.findFirst({ where: { id, companyId } });
    if (!rule) throw new NotFoundException('Automation rule not found.');
    return rule;
  }

  /**
   * Re-derives the EFFECTIVE triggerEvent/triggerToStage (existing
   * value merged with whatever this request changes) before
   * validating consistency — a request that only changes `name`
   * must still be checked against whatever event/stage the rule
   * ALREADY has stored, not just what's in this one request.
   *
   * KNOWN LIMITATION: switching an existing 'stage_changed' rule
   * to 'created' is not possible through this endpoint — the DTO
   * has no way to explicitly say "clear triggerToStage" (only
   * `undefined`/omitted is expressible, which this merge correctly
   * treats as "leave it as whatever is already stored", not as a
   * request to null it out). To change a rule's trigger type this
   * drastically, delete it and create a new one instead.
   */
  async update(companyId: string, id: string, dto: UpdateAutomationRuleDto) {
    const existing = await this.findOne(companyId, id);

    const effectiveEvent = dto.triggerEvent ?? existing.triggerEvent;
    const effectiveStage = dto.triggerToStage !== undefined ? dto.triggerToStage : existing.triggerToStage;
    this.assertStageConsistency(effectiveEvent as 'created' | 'stage_changed', effectiveStage ?? undefined);

    return this.prisma.automationRule.update({
      where: { id },
      data: {
        ...dto,
        triggerToStage: effectiveEvent === 'stage_changed' ? effectiveStage : null,
      },
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    await this.prisma.automationRule.delete({ where: { id } });
  }

  private assertStageConsistency(triggerEvent: 'created' | 'stage_changed', triggerToStage: string | undefined): void {
    if (triggerEvent === 'stage_changed' && !triggerToStage) {
      throw new UnprocessableEntityException('triggerToStage is required when triggerEvent is "stage_changed".');
    }
    if (triggerEvent === 'created' && triggerToStage) {
      throw new UnprocessableEntityException('triggerToStage must not be set when triggerEvent is "created".');
    }
  }
}
