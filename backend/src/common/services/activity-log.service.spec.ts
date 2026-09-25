import { ActivityLogService } from './activity-log.service';
import { runWithTenantContext } from '../../prisma/tenant-context';

describe('ActivityLogService.record', () => {
  let prisma: any;
  let service: ActivityLogService;

  beforeEach(() => {
    prisma = { activityLog: { create: jest.fn().mockResolvedValue({}) } };
    service = new ActivityLogService(prisma);
  });

  const base = { companyId: 'c1', userId: 'u1', action: 'updated', entityType: 'employee' as const, entityId: 'e1' };
  const written = () => prisma.activityLog.create.mock.calls[0][0].data;

  it('captures IP and browser automatically from the current request', async () => {
    await runWithTenantContext(
      { tx: prisma, companyId: 'c1', requestMeta: { ipAddress: '203.0.113.7', userAgent: 'Firefox' } },
      () => service.record(base),
    );
    expect(written()).toMatchObject({ ipAddress: '203.0.113.7', userAgent: 'Firefox' });
  });

  it('stores only changed fields for an update, with secrets stripped', async () => {
    await service.record({
      ...base,
      oldValues: { jobTitle: 'Tech', passwordHash: 'old', firstName: 'A' },
      newValues: { jobTitle: 'Senior', passwordHash: 'new', firstName: 'A' },
    });
    expect(written().oldValues).toEqual({ jobTitle: 'Tech', passwordHash: '[redacted]' });
    expect(written().newValues).toEqual({ jobTitle: 'Senior', passwordHash: '[redacted]' });
  });

  it('is fail-closed: a failed audit write propagates instead of being swallowed', async () => {
    // Inside a Postgres transaction, swallowing would silently roll back the whole request on COMMIT.
    prisma.activityLog.create.mockRejectedValue(new Error('db error'));
    await expect(service.record(base)).rejects.toThrow('db error');
  });
});
