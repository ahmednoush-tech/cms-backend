import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type TimelineEntityType = 'customer' | 'lead';

export interface TimelineEvent {
  id: string;
  source: 'interaction' | 'activity';
  date: string;
  title: string;
  description: string | null;
  interactionType: string | null;
  createdByUserId: string | null;
}

/**
 * DELIBERATE SCOPE: this timeline shows events tied DIRECTLY to
 * the given customer or lead's own record — Interactions filed
 * against it, and ActivityLog entries for entityType/entityId
 * matching it exactly. It does NOT cascade into a customer's
 * linked Opportunities and pull in THEIR activity — that would be
 * a genuinely useful V2, but merging across entity types safely
 * was left out to keep this feature's first version honest about
 * what it actually shows.
 */
@Injectable()
export class CrmTimelineService {
  constructor(private prisma: PrismaService) {}

  async getTimeline(companyId: string, entityType: TimelineEntityType, entityId: string): Promise<TimelineEvent[]> {
    if (entityType === 'customer') {
      const customer = await this.prisma.customer.findFirst({ where: { id: entityId, companyId, deletedAt: null } });
      if (!customer) throw new NotFoundException('Customer not found.');
    } else {
      const lead = await this.prisma.lead.findFirst({ where: { id: entityId, companyId, deletedAt: null } });
      if (!lead) throw new NotFoundException('Lead not found.');
    }

    const interactionWhere = entityType === 'customer' ? { customerId: entityId } : { leadId: entityId };
    const [interactions, activityLogs] = await Promise.all([
      this.prisma.interaction.findMany({
        where: { companyId, deletedAt: null, ...interactionWhere },
        select: { id: true, type: true, subject: true, notes: true, interactionDate: true, createdBy: true },
      }),
      this.prisma.activityLog.findMany({
        where: { companyId, entityType, entityId },
        select: { id: true, action: true, oldValues: true, newValues: true, createdAt: true, userId: true },
      }),
    ]);

    const interactionEvents: TimelineEvent[] = interactions.map((i) => ({
      id: i.id,
      source: 'interaction',
      date: i.interactionDate.toISOString(),
      title: i.subject,
      description: i.notes,
      interactionType: i.type,
      createdByUserId: i.createdBy,
    }));

    const activityEvents: TimelineEvent[] = activityLogs.map((a) => ({
      id: a.id,
      source: 'activity',
      date: a.createdAt.toISOString(),
      title: this.describeActivity(a.action, a.oldValues, a.newValues),
      description: null,
      interactionType: null,
      createdByUserId: a.userId,
    }));

    return [...interactionEvents, ...activityEvents].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * Only 'status_changed' gets special treatment (showing the
   * old→new value when the logged JSON contains a recognizable
   * status/stage field) — every other action gets a plain, honest
   * label rather than a guessed summary of arbitrary JSON.
   */
  private describeActivity(action: string, oldValues: unknown, newValues: unknown): string {
    if (action === 'status_changed') {
      const oldStage = this.extractStageOrStatus(oldValues);
      const newStage = this.extractStageOrStatus(newValues);
      if (oldStage && newStage) return `Changed from "${oldStage}" to "${newStage}"`;
    }
    const labels: Record<string, string> = {
      created: 'Record created',
      updated: 'Record updated',
      deleted: 'Record deleted',
      status_changed: 'Status changed',
      converted: 'Converted',
    };
    return labels[action] ?? action;
  }

  private extractStageOrStatus(values: unknown): string | null {
    if (!values || typeof values !== 'object') return null;
    const obj = values as Record<string, unknown>;
    const value = obj.stage ?? obj.status;
    return typeof value === 'string' ? value : null;
  }
}
