import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { runWithTenantContext } from '../../prisma/tenant-context';

/**
 * Registered globally (see app.module.ts's configure()), applied
 * to EVERY route, first in the middleware chain — before guards,
 * before interceptors, before the controller ever runs.
 *
 * WHY THE WHOLE REQUEST RUNS INSIDE ONE TRANSACTION: `SET LOCAL`
 * (which is how JwtStrategy and the two public services establish
 * the company context Row-Level Security checks against) only
 * lasts for the duration of the CURRENT transaction on the CURRENT
 * connection. Postgres connection pooling means a plain,
 * un-transacted query could physically run on any connection in
 * the pool — so without an explicitly open transaction spanning
 * the whole request, there would be no guarantee that the `SET
 * LOCAL` from earlier in the request still applies to a query
 * later in the same request.
 *
 * HOW THE TRANSACTION STAYS OPEN ACROSS THE WHOLE ASYNC REQUEST:
 * `next()` is called from inside the Promise executor below, and
 * that Promise only resolves once the response has actually
 * finished (or the connection closed early) — so
 * `prisma.startRequestTransaction(...)`'s callback, and therefore
 * the transaction itself, stays open for exactly as long as the
 * request takes, then commits.
 *
 * DISCLOSED TRADE-OFF, NOT YET VALIDATED UNDER LOAD: this holds
 * one Postgres connection checked out from the pool for the ENTIRE
 * duration of every single request, not just for the moments it
 * actually runs a query. Under real concurrent traffic, this means
 * the Postgres connection pool must be sized for peak CONCURRENT
 * REQUESTS, not peak concurrent queries, which is a materially
 * different (usually larger) number. This has not been
 * load-tested — there is no live database in this development
 * environment to test it against — and should be watched closely
 * (via the slow-request logging already in place, see
 * request-logger.middleware.ts) once this runs for real.
 */
@Injectable()
export class TenantTransactionMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Filled by onCommit() during the request; run only after the
    // transaction below has committed successfully. If the
    // transaction rolls back (the .catch path), they're dropped —
    // which is the whole point: nothing outside the database gets
    // told about work that never actually happened.
    const afterCommit: Array<() => void> = [];
    // req.ip is the real client address thanks to main.ts's
    // 'trust proxy' setting. User agent is capped so a hostile client
    // can't bloat every audit row with a huge header.
    const requestMeta = {
      ipAddress: req.ip || undefined,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 500) : undefined,
    };
    this.prisma
      .startRequestTransaction((tx) =>
        runWithTenantContext({ tx, companyId: null, afterCommit, requestMeta }, () => {
          return new Promise<void>((resolve) => {
            res.once('finish', resolve);
            res.once('close', resolve);
            next();
          });
        }),
      )
      .then(() => {
        for (const fn of afterCommit) {
          try {
            fn();
          } catch {
            // A failing side effect (e.g. a real-time push) must
            // never affect the already-committed request.
          }
        }
      })
      .catch((err) => {
        if (!res.headersSent) {
          next(err);
        }
      });
  }
}
