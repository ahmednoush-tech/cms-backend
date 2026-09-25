jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(function (this: any) {
      this.$connect = jest.fn().mockResolvedValue(undefined);
      this.$disconnect = jest.fn().mockResolvedValue(undefined);
      this.$transaction = jest.fn();
      this.customer = { findMany: jest.fn().mockReturnValue('raw-client-customer-findMany') };
      return this;
    }),
    Prisma: {},
  };
});

import { PrismaService } from './prisma.service';
import { runWithTenantContext } from './tenant-context';

describe('PrismaService (RLS Proxy)', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();
  });

  describe('outside any request (no tenant context)', () => {
    it('routes model queries to the raw pooled client', () => {
      const result = (service as any).customer.findMany();
      expect(result).toBe('raw-client-customer-findMany');
    });

    it("still resolves PrismaService's OWN real methods normally", async () => {
      await expect(service.onModuleInit()).resolves.toBeUndefined();
      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    });
  });

  describe('inside a request (tenant context open)', () => {
    it('routes model queries to the CURRENT transaction, not the raw client', async () => {
      const fakeTx = { customer: { findMany: jest.fn().mockReturnValue('tx-customer-findMany') } };

      await runWithTenantContext({ tx: fakeTx as any, companyId: 'company-1' }, async () => {
        const result = (service as any).customer.findMany();
        expect(result).toBe('tx-customer-findMany');
      });
    });

    it('CRITICAL FIX: $transaction callback form runs directly against the open tx, never calls tx.$transaction (which does not exist on a TransactionClient)', async () => {
      const innerQueryResult = 'inner-query-ran';
      const fakeTx = {
        customer: { findMany: jest.fn().mockReturnValue(innerQueryResult) },
        // Deliberately NO $transaction property on this fake — a
        // real Prisma.TransactionClient doesn't have one either.
        // If the Proxy incorrectly tried to call tx.$transaction,
        // this test would throw "tx.$transaction is not a function".
      };

      await runWithTenantContext({ tx: fakeTx as any, companyId: 'company-1' }, async () => {
        const nestedCallback = (tx: any) => tx.customer.findMany();
        const result = await (service as any).$transaction(nestedCallback);
        expect(result).toBe(innerQueryResult);
      });
    });

    it('CRITICAL FIX: $transaction array form resolves via Promise.all against already-tx-scoped promises', async () => {
      const fakeTx = {};
      await runWithTenantContext({ tx: fakeTx as any, companyId: 'company-1' }, async () => {
        const results = await (service as any).$transaction([Promise.resolve('a'), Promise.resolve('b')]);
        expect(results).toEqual(['a', 'b']);
      });
    });

    it("still resolves PrismaService's OWN real methods normally even with a context open", async () => {
      const fakeTx = {};
      await runWithTenantContext({ tx: fakeTx as any, companyId: 'company-1' }, async () => {
        await expect(service.onModuleInit()).resolves.toBeUndefined();
      });
    });

    it('REGRESSION: a borrowed method\'s `this` is correctly bound to the real tx object, not the Proxy — found during a later logic review', async () => {
      // Simulates what Prisma's own internals plausibly do:
      // methods that read their OWN object's state via `this`,
      // not just plain functions with no internal state (which
      // the OTHER tests above use, and which would never have
      // caught this bug — this is deliberately a different shape
      // of test double).
      class FakeTxWithInternalState {
        private engineToken = 'REAL-ENGINE-TOKEN';
        $queryRaw() {
          return this.engineToken; // throws/returns undefined if `this` is wrong
        }
      }
      const fakeTx = new FakeTxWithInternalState();

      await runWithTenantContext({ tx: fakeTx as any, companyId: 'company-1' }, async () => {
        const result = (service as any).$queryRaw();
        expect(result).toBe('REAL-ENGINE-TOKEN');
      });
    });
  });

  describe('outside any request — the same this-binding fix applies to the raw client too', () => {
    it('REGRESSION: a borrowed method from the raw client keeps correct `this` binding', () => {
      class FakeRawClientMethod {
        private token = 'RAW-CLIENT-TOKEN';
        $queryRaw() {
          return this.token;
        }
      }
      // Swap in a raw client whose method relies on its own `this`.
      (service as any).rawClient = new FakeRawClientMethod();

      const result = (service as any).$queryRaw();
      expect(result).toBe('RAW-CLIENT-TOKEN');
    });
  });
});
