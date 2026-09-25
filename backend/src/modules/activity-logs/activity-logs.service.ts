import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationQueryDto, buildMeta } from '../../common/dto/pagination-query.dto';
import { maskForViewer } from '../../common/audit/audit-redaction';
import { toCsv } from '../../common/utils/csv.util';

export interface ActivityLogFilters {
  entityType?: string;
  action?: string;
  /** The actor — who performed the action. */
  userId?: string;
  /** One specific record's full history (use with entityType). */
  entityId?: string;
  /** Inclusive. A bare date (YYYY-MM-DD) means the start of that day. */
  from?: string;
  /** Inclusive. A bare date (YYYY-MM-DD) means the END of that day. */
  to?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Hard cap on a single export, so one click can't pull an unbounded table into memory. */
export const EXPORT_MAX_ROWS = 5000;

/**
 * Read-only access to the audit trail.
 *
 * EVERY row returned goes through maskForViewer() first: pay fields
 * are hidden unless the viewer holds Payroll:runs:view, identity
 * fields unless they hold Administration:employees:view, and secrets
 * are always hidden. That applies to rows written long before this
 * masking existed — which really do contain full salaries, Iqama
 * numbers and quotation share-link tokens — so having the
 * "view activity log" permission no longer quietly grants access to
 * data that other permissions are meant to protect.
 */
@Injectable()
export class ActivityLogsService {
  constructor(private prisma: PrismaService) {}

  private buildWhere(companyId: string, f: ActivityLogFilters): Prisma.ActivityLogWhereInput {
    for (const [name, value] of [['userId', f.userId], ['entityId', f.entityId]] as const) {
      if (value && !UUID_RE.test(value)) throw new BadRequestException(`${name} must be a UUID.`);
    }
    const createdAt: Prisma.DateTimeFilter = {};
    if (f.from) createdAt.gte = this.parseDate(f.from, 'from', false);
    if (f.to) {
      const to = this.parseDate(f.to, 'to', true);
      if (DATE_ONLY_RE.test(f.to)) createdAt.lt = to;
      else createdAt.lte = to;
    }
    if (createdAt.gte && (createdAt.lt ?? createdAt.lte) && createdAt.gte > (createdAt.lt ?? createdAt.lte)!) {
      throw new BadRequestException('"from" must not be after "to".');
    }
    return {
      companyId,
      ...(f.entityType ? { entityType: f.entityType } : {}),
      ...(f.action ? { action: f.action } : {}),
      ...(f.userId ? { userId: f.userId } : {}),
      ...(f.entityId ? { entityId: f.entityId } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    };
  }

  /** endOfDay: a bare date for "to" becomes the START of the NEXT day, used with `lt`, so the whole named day is included. */
  private parseDate(value: string, name: string, endOfDay: boolean): Date {
    const d = new Date(DATE_ONLY_RE.test(value) ? `${value}T00:00:00.000Z` : value);
    if (Number.isNaN(d.getTime())) throw new BadRequestException(`"${name}" is not a valid date.`);
    if (endOfDay && DATE_ONLY_RE.test(value)) d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }

  private mask<T extends { oldValues: unknown; newValues: unknown }>(row: T, viewerPermissions: string[]): T {
    return {
      ...row,
      oldValues: maskForViewer(row.oldValues, viewerPermissions),
      newValues: maskForViewer(row.newValues, viewerPermissions),
    };
  }

  async findAll(companyId: string, query: PaginationQueryDto, filters: ActivityLogFilters, viewerPermissions: string[]) {
    const { page, pageSize } = query;
    const where = this.buildWhere(companyId, filters);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    return { items: items.map((row) => this.mask(row, viewerPermissions)), meta: buildMeta(page, pageSize, total) };
  }

  /** Same filters and the same masking as findAll — an export never reveals more than the screen does. */
  async exportCsv(companyId: string, filters: ActivityLogFilters, viewerPermissions: string[]): Promise<{ csv: string; truncated: boolean }> {
    const where = this.buildWhere(companyId, filters);
    const rows = await this.prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: EXPORT_MAX_ROWS + 1,
      include: { user: { select: { name: true, email: true } } },
    });
    const truncated = rows.length > EXPORT_MAX_ROWS;
    const flat = rows.slice(0, EXPORT_MAX_ROWS).map((row) => {
      const masked = this.mask(row, viewerPermissions);
      return {
        createdAt: row.createdAt.toISOString(),
        actorName: row.user?.name ?? '',
        actorEmail: row.user?.email ?? '',
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        ipAddress: row.ipAddress ?? '',
        userAgent: row.userAgent ?? '',
        oldValues: masked.oldValues ? JSON.stringify(masked.oldValues) : '',
        newValues: masked.newValues ? JSON.stringify(masked.newValues) : '',
      };
    });
    const header = {
      createdAt: 'Timestamp (UTC)', actorName: 'Performed by', actorEmail: 'Email', action: 'Action',
      entityType: 'Type', entityId: 'Record ID', ipAddress: 'IP address', userAgent: 'Browser',
      oldValues: 'Before', newValues: 'After',
    };
    const csv = flat.length ? toCsv(flat, header) : Object.values(header).join(',');
    return { csv, truncated };
  }
}
