import { runWithTenantContext, getTenantContext } from './tenant-context';

describe('tenant-context', () => {
  it('returns undefined outside any context (e.g. a background job with no request)', () => {
    expect(getTenantContext()).toBeUndefined();
  });

  it('makes the context available to synchronous code inside runWithTenantContext', async () => {
    const fakeTx = {} as any;
    await runWithTenantContext({ tx: fakeTx, companyId: 'company-1' }, async () => {
      const ctx = getTenantContext();
      expect(ctx?.companyId).toBe('company-1');
      expect(ctx?.tx).toBe(fakeTx);
    });
  });

  it('makes the context available across an awaited async gap (the whole point of AsyncLocalStorage over a plain variable)', async () => {
    const fakeTx = {} as any;
    await runWithTenantContext({ tx: fakeTx, companyId: 'company-2' }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(getTenantContext()?.companyId).toBe('company-2');
    });
  });

  it('is invisible outside the callback once it returns', async () => {
    const fakeTx = {} as any;
    await runWithTenantContext({ tx: fakeTx, companyId: 'company-3' }, async () => undefined);
    expect(getTenantContext()).toBeUndefined();
  });

  it('supports mutating companyId in place (as JwtStrategy does once the real tenant is known)', async () => {
    const fakeTx = {} as any;
    await runWithTenantContext({ tx: fakeTx, companyId: null }, async () => {
      const ctx = getTenantContext();
      expect(ctx?.companyId).toBeNull();
      if (ctx) ctx.companyId = 'company-4';
      expect(getTenantContext()?.companyId).toBe('company-4');
    });
  });

  it('keeps two concurrent contexts fully isolated from each other (two "requests" in flight at once)', async () => {
    const results: string[] = [];
    await Promise.all([
      runWithTenantContext({ tx: {} as any, companyId: 'company-A' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        results.push(getTenantContext()?.companyId ?? 'MISSING');
      }),
      runWithTenantContext({ tx: {} as any, companyId: 'company-B' }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        results.push(getTenantContext()?.companyId ?? 'MISSING');
      }),
    ]);
    expect(results.sort()).toEqual(['company-A', 'company-B']);
  });
});
