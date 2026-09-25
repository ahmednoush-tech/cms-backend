import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { getTenantContext } from './tenant-context';

/**
 * THIS IS THE ENTIRE MECHANISM THAT MAKES ROW-LEVEL SECURITY WORK
 * WITHOUT EDITING EVERY SERVICE FILE.
 *
 * Every one of this system's ~280 backend files calls
 * `this.prisma.customer.findFirst(...)`, `this.prisma.$transaction(...)`,
 * etc., assuming `this.prisma` IS a PrismaClient. Rewriting all of
 * them to somehow thread a request-scoped transaction handle
 * through every constructor was never realistic. Instead:
 *
 * PrismaService is now a Proxy. Every property read on it
 * (`.customer`, `.invoice`, `.$queryRaw`, anything) is intercepted
 * and redirected — at the moment it's accessed — to whichever
 * client is "active" right now:
 *
 *   - INSIDE a request: the interactive transaction opened by
 *     TenantTransactionMiddleware for this specific request, on
 *     which JwtAuthGuard has already run `SET LOCAL
 *     app.current_company_id = <this request's company>` (or
 *     `app.bypass_rls = 'on'` for the two public services that
 *     legitimately need it). Postgres's Row-Level Security
 *     policies (migration 064) then filter every single query
 *     transparently.
 *   - OUTSIDE a request (a seed script, a future background job
 *     with no HTTP request driving it): the raw pooled
 *     PrismaClient, no transaction, no SET LOCAL applied. RLS
 *     still enforces on the DB side — an unset
 *     app.current_company_id makes every tenant-table policy
 *     compare `company_id = NULL`, which is never true, so such a
 *     call sees ZERO rows from any tenant table. This is
 *     deliberate fail-closed behavior: a context that was never
 *     set blocks data, it does not default to seeing everyone's.
 *
 * The existing constructor injection (`constructor(private prisma:
 * PrismaService)`) in every other file needed ZERO changes for any
 * of this — the Proxy is invisible to them.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  /** The one real connection pool for the whole application's lifetime. Never used directly — always through the Proxy below. */
  private readonly rawClient = new PrismaClient();

  constructor() {
    return new Proxy(this, {
      get: (target, prop, receiver) => {
        // PrismaService's OWN real members (onModuleInit,
        // onModuleDestroy, rawClient itself) resolve normally —
        // only everything else (customer, invoice, $transaction,
        // $queryRaw, $connect, ...) gets redirected.
        if (prop in target) {
          return Reflect.get(target, prop, receiver);
        }
        const ctx = getTenantContext();

        if (ctx?.tx) {
          // CRITICAL: Prisma.TransactionClient (the type of an
          // already-open interactive transaction, which `ctx.tx`
          // always is here) has NO `.$transaction` method — Prisma
          // does not support true nested transactions. ~49
          // existing call sites across this codebase call
          // `this.prisma.$transaction(...)` (both the callback
          // form and the sequential array form), and since this
          // Proxy would otherwise forward that call onto `ctx.tx`,
          // every one of them would throw "$transaction is not a
          // function" the moment RLS's per-request transaction is
          // active. Both forms are handled explicitly below by
          // running directly against the SAME outer transaction —
          // there is no separate transaction to nest into, and
          // reusing the one already open is the correct behavior:
          // every "nested" write still lands in one Postgres
          // transaction either way.
          if (prop === '$transaction') {
            return (arg: unknown) => {
              if (typeof arg === 'function') {
                return (arg as (tx: Prisma.TransactionClient) => unknown)(ctx.tx);
              }
              return Promise.all(arg as Array<Promise<unknown>>);
            };
          }
          return this.bindIfFunction(ctx.tx, prop);
        }

        return this.bindIfFunction(target.rawClient, prop);
      },
    });
  }

  /**
   * CRITICAL FIX, found during a later logic review: a plain
   * `return someObject[prop]` inside a Proxy's `get` trap hands
   * back a bare function reference. If the CALLER then invokes it
   * as `proxyInstance.someMethod(...)` (exactly how every one of
   * the ~280 existing service files calls this.prisma.$queryRaw,
   * $connect, etc.), JavaScript binds `this` inside that function
   * to the PROXY, not to the real object the method was borrowed
   * from — confirmed empirically: a real class's private (#) field
   * access inside such a method throws "Cannot read private member
   * from an object whose class did not declare it" when called
   * this way, proving `this` was NOT the real instance. Prisma's
   * own client methods very plausibly rely on such internal state.
   * `.bind()`-ing the function to its real source object before
   * returning it is the standard, correct fix for any delegating
   * Proxy — model delegates (`.customer`, `.invoice`, ...) are
   * unaffected since they return an object, not a function, but
   * every `$`-prefixed method ($queryRaw, $executeRaw, $connect,
   * $disconnect, ...) needed this.
   */
  private bindIfFunction(source: object, prop: string | symbol): unknown {
    const value = (source as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(source) : value;
  }

  async onModuleInit() {
    await this.rawClient.$connect();
  }

  async onModuleDestroy() {
    await this.rawClient.$disconnect();
  }

  /**
   * The ONLY place allowed to start the per-request transaction —
   * called exactly once, by TenantTransactionMiddleware. Every
   * other file continues to inject PrismaService normally and
   * never calls this.
   */
  startRequestTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.rawClient.$transaction(fn, { timeout: 15000 });
  }
}

/**
 * TypeScript declaration merging — REQUIRED for every one of this
 * codebase's ~280 files to type-check when they call
 * `this.prisma.customer.findFirst(...)`, `this.prisma.$transaction(...)`,
 * etc. The class body above only statically declares its own real
 * members (rawClient, onModuleInit, bindIfFunction, ...); the
 * Proxy in the constructor is what makes .customer/.invoice/$-methods
 * actually WORK AT RUNTIME, but a Proxy's dynamic behavior is
 * invisible to TypeScript's static type checker — nothing in the
 * class declaration tells it that a PrismaService instance also
 * responds to every PrismaClient member. This interface, sharing
 * the class's exact name, merges with it: PrismaService the TYPE
 * becomes "everything declared in the class, AND everything on
 * PrismaClient", while PrismaService the RUNTIME CLASS is
 * completely unchanged by this — an interface has no runtime
 * representation at all.
 */
export interface PrismaService extends PrismaClient {}
