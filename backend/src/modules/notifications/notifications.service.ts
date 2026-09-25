import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { onCommit } from '../../prisma/tenant-context';
import { buildMeta } from '../../common/dto/pagination-query.dto';
import { NotificationBusService, NotificationPayload } from './notification-bus.service';

export interface CreateNotificationInput {
  companyId: string;
  userId: string;
  type: string;
  title: string;
  message?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}

const PAYLOAD_SELECT = {
  id: true, type: true, title: true, message: true,
  entityType: true, entityId: true, isRead: true, createdAt: true,
} as const;

/**
 * THE way to create a notification anywhere in the backend — every
 * module that used to call prisma.notification.create() directly
 * now calls create() here instead, which is what makes a
 * notification show up in the user's browser instantly rather than
 * only on the next page load.
 *
 * Every read/update method is scoped to BOTH companyId and the
 * caller's own userId: notifications are personal — there is no
 * permission that lets one user read another user's notifications,
 * not even an admin.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private bus: NotificationBusService,
  ) {}

  async create(input: CreateNotificationInput): Promise<NotificationPayload> {
    const notification = await this.prisma.notification.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      },
      select: PAYLOAD_SELECT,
    });
    // Pushed only after the surrounding request/job transaction has
    // committed — see onCommit(). If the action that triggered this
    // notification fails and rolls back, nobody is ever told about it.
    onCommit(() => this.bus.publish(input.userId, notification));
    return notification;
  }

  async list(companyId: string, userId: string, query: { page: number; pageSize: number; unreadOnly?: boolean }) {
    const where = { companyId, userId, ...(query.unreadOnly ? { isRead: false } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: PAYLOAD_SELECT,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, meta: buildMeta(query.page, query.pageSize, total) };
  }

  async unreadCount(companyId: string, userId: string): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({ where: { companyId, userId, isRead: false } });
    return { count };
  }

  /**
   * Silently ignores ids that aren't this user's (or don't exist)
   * rather than 404ing — the WHERE clause simply never matches
   * them, so there is no way to use this endpoint to probe whether
   * someone else's notification id exists.
   */
  async markRead(companyId: string, userId: string, ids: string[]): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { companyId, userId, id: { in: ids }, isRead: false },
      data: { isRead: true },
    });
    if (result.count > 0) {
      onCommit(() => this.bus.publishReadState(userId, { ids }));
    }
    return { updated: result.count };
  }

  async markAllRead(companyId: string, userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { companyId, userId, isRead: false },
      data: { isRead: true },
    });
    if (result.count > 0) {
      onCommit(() => this.bus.publishReadState(userId, { all: true }));
    }
    return { updated: result.count };
  }
}
