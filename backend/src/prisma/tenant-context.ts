import { AsyncLocalStorage } from 'async_hooks';
import type { Prisma } from '@prisma/client';

export interface TenantContext {
  tx: Prisma.TransactionClient;
  companyId: string | null;
  /**
   * Callbacks to run only AFTER this context's transaction has
   * successfully committed — see onCommit() below. Optional: a
   * context opened without it (a unit test, an older caller) just
   * runs onCommit callbacks immediately instead.
   */
  afterCommit?: Array<() => void>;
  /**
   * Who is on the other end of this request — captured once by
   * TenantTransactionMiddleware so every audit entry written during
   * the request records it automatically, without each module having
   * to pass it through. Absent for background jobs (the scheduler).
   */
  requestMeta?: { ipAddress?: string; userAgent?: string };
}

const storage = new AsyncLocalStorage<TenantContext>();

/**
 * Called once per HTTP request, by TenantTransactionMiddleware —
 * everything that happens inside `fn` (the rest of the request:
 * guards, interceptors, the controller, the service, everything)
 * runs with this SAME open transaction available via
 * getTenantContext(). Nothing else should call this directly.
 */
export function runWithTenantContext<T>(context: TenantContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(context, fn);
}

/**
 * Returns the current request's transaction context, or undefined
 * outside any request (a background job, a seed script, a unit
 * test that never opened one). PrismaService's Proxy uses this to
 * decide whether to route a query through the RLS-scoped
 * transaction or the raw pooled client — see prisma.service.ts's
 * comment for why "no context" is a safe, fail-closed condition
 * for every RLS-protected table, not a security hole.
 */
export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

/**
 * Defers a side effect until the current request's transaction has
 * actually committed. Used for anything the OUTSIDE world can see
 * immediately — e.g. pushing a real-time notification to a browser:
 * pushing it inside the still-open transaction would show the user
 * a notification for an action that might then fail and roll back.
 *
 * Outside any context, or in a context opened without an
 * afterCommit list, the callback runs immediately — there is no
 * pending transaction to wait for.
 */
export function onCommit(fn: () => void): void {
  const ctx = storage.getStore();
  if (ctx?.afterCommit) {
    ctx.afterCommit.push(fn);
  } else {
    fn();
  }
}
