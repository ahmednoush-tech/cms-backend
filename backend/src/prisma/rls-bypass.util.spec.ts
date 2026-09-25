import { enableRlsBypass } from './rls-bypass.util';
import { runWithTenantContext } from './tenant-context';

describe('enableRlsBypass', () => {
  it('does nothing (no throw) when called outside any tenant context', async () => {
    await expect(enableRlsBypass()).resolves.toBeUndefined();
  });

  it('executes SELECT set_config(...) against the CURRENT transaction when a context is open', async () => {
    const executeRaw = jest.fn().mockResolvedValue(undefined);
    const fakeTx = { $executeRaw: executeRaw };

    await runWithTenantContext({ tx: fakeTx as any, companyId: null }, async () => {
      await enableRlsBypass();
    });

    expect(executeRaw).toHaveBeenCalledTimes(1);
  });
});
