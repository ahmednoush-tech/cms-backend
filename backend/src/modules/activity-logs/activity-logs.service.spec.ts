import { BadRequestException } from '@nestjs/common';
import { ActivityLogsService, EXPORT_MAX_ROWS } from './activity-logs.service';

describe('ActivityLogsService', () => {
  const salaryRow = {
    id: 'a1', createdAt: new Date('2026-03-10T09:00:00Z'), action: 'updated', entityType: 'employee', entityId: 'e1',
    ipAddress: '10.0.0.5', userAgent: 'Firefox', user: { id: 'u1', name: 'Sara', email: 's@x.co' },
    oldValues: { basicSalary: '8000.00' }, newValues: { basicSalary: '9500.00', iqamaNumber: '212' },
  };
  const legacyQuotationRow = { ...salaryRow, id: 'a2', entityType: 'quotation', oldValues: null, newValues: { publicToken: 'LEAKED' } };
  let prisma: any;
  let service: ActivityLogsService;

  beforeEach(() => {
    prisma = {
      activityLog: { findMany: jest.fn().mockResolvedValue([salaryRow, legacyQuotationRow]), count: jest.fn().mockResolvedValue(2) },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    service = new ActivityLogsService(prisma);
  });
  const q = { page: 1, pageSize: 25 } as any;

  it('hides salaries and Iqama numbers from a viewer holding only the audit permission', async () => {
    const { items } = await service.findAll('c1', q, {}, ['Administration:activity_logs:view']);
    expect(items[0].newValues).toEqual({ basicSalary: '[hidden]', iqamaNumber: '[hidden]' });
  });

  it('never returns a share-link token, even from rows written before redaction existed', async () => {
    const { items } = await service.findAll('c1', q, {}, ['Payroll:runs:view', 'Administration:employees:view']);
    expect((items[1].newValues as any).publicToken).toBe('[redacted]');
  });

  it('a bare "to" date includes that whole day', async () => {
    await service.findAll('c1', q, { from: '2026-03-01', to: '2026-03-10' }, []);
    const createdAt = prisma.activityLog.findMany.mock.calls[0][0].where.createdAt;
    expect(createdAt.gte.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(createdAt.lt.toISOString()).toBe('2026-03-11T00:00:00.000Z');
  });

  it.each([[{ userId: 'not-a-uuid' }], [{ from: 'yesterday' }], [{ from: '2026-03-10', to: '2026-03-01' }]])(
    'rejects invalid filters %o', async (filters) => {
      await expect(service.findAll('c1', q, filters as any, [])).rejects.toThrow(BadRequestException);
    });

  it('export applies the same masking as the screen and requests cap+1 rows', async () => {
    const { csv, truncated } = await service.exportCsv('c1', {}, []);
    expect(csv).not.toContain('9500');
    expect(csv).not.toContain('LEAKED');
    expect(truncated).toBe(false);
    expect(prisma.activityLog.findMany.mock.calls[0][0].take).toBe(EXPORT_MAX_ROWS + 1);
  });
});
