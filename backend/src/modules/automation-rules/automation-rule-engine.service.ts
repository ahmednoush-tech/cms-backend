import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

interface TriggerEntity {
  id: string;
  name: string;
  ownerId: string | null;
}

/**
 * Runs SYNCHRONOUSLY, in-process, called directly from
 * LeadsService.create() and OpportunitiesService.updateStage() —
 * there is no event bus or message queue here. This mirrors
 * exactly how ActivityLogService is already called from those same
 * methods: a direct function call embedded in the existing write
 * path, not a separate asynchronous system.
 *
 * The only action this executes is notifying the record's owner —
 * see migration 076's comment for why "create a task" was
 * considered and rejected (Task requires a project or work order,
 * which Leads/Opportunities don't have).
 */
@Injectable()
export class AutomationRuleEngineService {
  private readonly logger = new Logger(AutomationRuleEngineService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async onLeadCreated(companyId: string, lead: TriggerEntity): Promise<void> {
    await this.evaluateAndRun(companyId, 'lead', 'created', lead, null);
  }

  async onOpportunityCreated(companyId: string, opportunity: TriggerEntity): Promise<void> {
    await this.evaluateAndRun(companyId, 'opportunity', 'created', opportunity, null);
  }

  async onOpportunityStageChanged(companyId: string, opportunity: TriggerEntity, toStage: string): Promise<void> {
    await this.evaluateAndRun(companyId, 'opportunity', 'stage_changed', opportunity, toStage);
  }

  private async evaluateAndRun(
    companyId: string,
    entityType: 'lead' | 'opportunity',
    event: 'created' | 'stage_changed',
    entity: TriggerEntity,
    toStage: string | null,
  ): Promise<void> {
    const rules = await this.prisma.automationRule.findMany({
      where: {
        companyId,
        isActive: true,
        triggerEntityType: entityType,
        triggerEvent: event,
        ...(event === 'stage_changed' ? { triggerToStage: toStage } : {}),
      },
    });

    if (rules.length === 0) return;

    if (!entity.ownerId) {
      this.logger.warn(`${rules.length} automation rule(s) matched for ${entityType} ${entity.id}, but it has no owner to notify — skipped.`);
      return;
    }

    for (const rule of rules) {
      await this.notifications.create({
        companyId,
        userId: entity.ownerId,
        type: 'automation_rule',
        title: this.applyTemplate(rule.notificationTitle, entity),
        message: rule.notificationMessage ? this.applyTemplate(rule.notificationMessage, entity) : null,
        entityType,
        entityId: entity.id,
      });
    }
  }

  /** The only placeholder supported is {{name}} — the triggering Lead/Opportunity's own name field. */
  private applyTemplate(template: string, entity: TriggerEntity): string {
    return template.replace(/\{\{name\}\}/g, entity.name);
  }
}
