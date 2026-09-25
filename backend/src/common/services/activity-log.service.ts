import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getTenantContext } from '../../prisma/tenant-context';
import { diffForAudit, redactSecrets } from '../audit/audit-redaction';

export type LoggableEntityType =
  // CRM
  | 'customer' | 'lead' | 'opportunity' | 'quotation'
  // Operations
  | 'project' | 'work_order' | 'task'
  // HR / Administration
  | 'employee' | 'user' | 'role' | 'department' | 'company'
  // Finance
  | 'invoice' | 'invoice_note' | 'customer_payment' | 'journal_entry' | 'accounting_period'
  | 'bill' | 'bill_payment' | 'purchase_order'
  // Payroll
  | 'payroll_run';

interface LogParams {
  companyId: string;
  userId: string | undefined;
  action: string; // e.g. 'created' | 'updated' | 'deleted' | 'status_changed' | 'posted' | 'login_failed'
  entityType: LoggableEntityType;
  entityId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  /** Normally omitted — taken automatically from the current request (see TenantContext.requestMeta). */
  ipAddress?: string;
  userAgent?: string;
}

/**
 * The single place every module writes to activity_logs.
 *
 * WHAT IS STORED:
 * - Secrets are stripped before writing (password hashes, tokens —
 *   including quotation share-link tokens — encryption keys). See
 *   audit-redaction.ts.
 * - For updates (old AND new given), only the fields that actually
 *   changed are kept, so an entry shows what the edit did.
 * - Pay and identity fields ARE stored (an audit trail of salary
 *   changes has to be able to show them), but are masked on READ for
 *   viewers without the matching permission — see ActivityLogsService.
 * - IP address and browser are captured automatically from the
 *   current request.
 *
 * ATOMIC WITH THE CHANGE IT DESCRIBES (fail-closed): the entry is
 * written in the same database transaction as the business change,
 * so an entry exists if and only if the change was saved. A failure
 * to write the entry now fails the request.
 *
 * This deliberately replaces an earlier try/catch that logged and
 * swallowed audit-write errors "so they never block the business
 * operation". Inside a PostgreSQL transaction that promise was false:
 * after ANY failed statement, Postgres rejects every further statement
 * in the transaction, and turns the final COMMIT into a ROLLBACK
 * (documented Postgres behavior). So a swallowed audit failure would
 * have silently discarded the whole request's changes while the
 * client was told it succeeded. Failing loudly is strictly better.
 */
@Injectable()
export class ActivityLogService {
  constructor(private prisma: PrismaService) {}

  async record(params: LogParams): Promise<void> {
    const meta = getTenantContext()?.requestMeta;
    const { oldValues, newValues } = diffForAudit(params.oldValues, params.newValues);
    await this.prisma.activityLog.create({
      data: {
        companyId: params.companyId,
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldValues: oldValues ? (redactSecrets(oldValues) as unknown as Prisma.InputJsonValue) : undefined,
        newValues: newValues ? (redactSecrets(newValues) as unknown as Prisma.InputJsonValue) : undefined,
        ipAddress: params.ipAddress ?? meta?.ipAddress,
        userAgent: params.userAgent ?? meta?.userAgent,
      },
    });
  }
}
