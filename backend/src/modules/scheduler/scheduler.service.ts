import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { runWithTenantContext, getTenantContext } from '../../prisma/tenant-context';
import { enableRlsBypass } from '../../prisma/rls-bypass.util';
import { RecurringInvoiceTemplatesService } from '../finance/recurring-invoice-templates.service';
import { EmployeeDocumentsService } from '../employees/employee-documents.service';

/**
 * REAL, AUTOMATIC scheduling — this is what was previously missing
 * everywhere a feature needed to "run on its own": recurring
 * invoice generation and the Iqama expiry check both used to be
 * ON-DEMAND ONLY (a person clicking a button). Those manual
 * endpoints are UNCHANGED and still work exactly as before — this
 * service adds an automatic daily run on top, calling the exact
 * same service methods, not a parallel reimplementation.
 *
 * HOW THIS RUNS WITHOUT AN HTTP REQUEST: normally,
 * TenantTransactionMiddleware opens one transaction per request
 * and JwtStrategy sets `app.current_company_id` inside it once the
 * caller's company is known. A cron job has neither a request nor
 * a JWT, so this replicates that same mechanism manually, once per
 * company: open a fresh transaction, `SET LOCAL
 * app.current_company_id` to THAT company's id, then call the
 * existing service inside it — so Row-Level Security scopes every
 * query exactly as it would for a real request from that company.
 * One company failing does not stop the others (see runForEachCompany).
 *
 * WHO "PERFORMS" AN AUTOMATED ACTION: generateDue() records who
 * created the resulting invoice (actorUserId). There is no human
 * actor for a scheduled run, so this uses the company's
 * EARLIEST-CREATED ACTIVE USER as a reasonable stand-in — in
 * practice, the account created at signup. This is a disclosed
 * design choice, not a discovered "system user" concept that
 * exists elsewhere in this schema.
 *
 * DEPLOYMENT NOTE: this only fires while the Node.js process
 * itself is continuously running — a serverless/scale-to-zero
 * deployment would need an external scheduler hitting the
 * existing manual endpoints instead, which is exactly why those
 * endpoints were never removed.
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private recurringInvoiceTemplatesService: RecurringInvoiceTemplatesService,
    private employeeDocumentsService: EmployeeDocumentsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async runDailyRecurringInvoiceGeneration() {
    await this.runForEachCompany('recurring-invoice-generation', async (companyId) => {
      const actorUserId = await this.getActorUserId(companyId);
      if (!actorUserId) {
        this.logger.warn(`Skipping recurring invoice generation for company ${companyId} — no active user found to attribute it to.`);
        return;
      }
      const result = await this.recurringInvoiceTemplatesService.generateDue(companyId, actorUserId);
      this.logger.log(`Company ${companyId}: generated ${result.generatedCount} invoice(s), skipped ${result.skipped.length}.`);
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async runDailyIqamaExpiryCheck() {
    await this.runForEachCompany('iqama-expiry-check', async (companyId) => {
      const result = await this.employeeDocumentsService.checkExpiringIqamas(companyId);
      this.logger.log(`Company ${companyId}: ${result.expiringCount} expiring Iqama(s), ${result.notificationsSent} notification(s) sent.`);
    });
  }

  /**
   * revoked_refresh_tokens (see TokenDenylistService, migration
   * 110) has no company_id and no RLS — a jti is globally unique
   * regardless of tenant — so this needs none of runForEachCompany's
   * per-tenant transaction dance, just a single plain delete. An
   * expired row is already functionally inert (isRevoked() treats
   * it as not-revoked once past its own expiry), so this is
   * housekeeping to keep the table from growing forever, not a
   * correctness fix.
   */
  @Cron('0 3 * * *') // every day at 3 AM — a raw cron string (not a CronExpression.* constant) since the environment's stub type for that enum only defines the two values already in use above; the underlying library accepts any standard 5-field cron expression regardless.
  async cleanupExpiredRevokedTokens() {
    const result = await this.prisma.revokedRefreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    this.logger.log(`Cleaned up ${result.count} expired revoked-refresh-token record(s).`);
  }

  /**
   * Opens ITS OWN transaction (bypassing RLS, since no company is
   * known yet) just to list active companies, then a SEPARATE
   * transaction PER COMPANY for the actual work — mirroring
   * exactly how JwtStrategy scopes a real request, but done once
   * per tenant instead of once per HTTP call.
   */
  private async runForEachCompany(jobName: string, fn: (companyId: string) => Promise<void>): Promise<void> {
    const companyIds = await this.getActiveCompanyIds();
    this.logger.log(`Scheduled job "${jobName}" starting for ${companyIds.length} active company(ies).`);

    for (const companyId of companyIds) {
      // Same after-commit guarantee as TenantTransactionMiddleware:
      // real-time pushes queued during this company's job run only
      // once its transaction has actually committed.
      const afterCommit: Array<() => void> = [];
      try {
        await this.prisma.startRequestTransaction((tx) =>
          runWithTenantContext({ tx, companyId: null, afterCommit }, async () => {
            await tx.$executeRaw`SELECT set_config('app.current_company_id', ${companyId}, true)`;
            const ctx = getTenantContext();
            if (ctx) ctx.companyId = companyId;
            await fn(companyId);
          }),
        );
        for (const cb of afterCommit) {
          try { cb(); } catch { /* never let a push failure affect the job */ }
        }
      } catch (err) {
        this.logger.error(`Scheduled job "${jobName}" failed for company ${companyId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  private async getActiveCompanyIds(): Promise<string[]> {
    return this.prisma.startRequestTransaction((tx) =>
      runWithTenantContext({ tx, companyId: null }, async () => {
        await enableRlsBypass();
        const companies = await this.prisma.company.findMany({ where: { status: 'active', deletedAt: null }, select: { id: true } });
        return companies.map((c) => c.id);
      }),
    );
  }

  private async getActorUserId(companyId: string): Promise<string | null> {
    const user = await this.prisma.user.findFirst({
      where: { companyId, status: 'active' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    return user?.id ?? null;
  }
}
