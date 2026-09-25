import { NotificationsService } from './notifications.service';
import { runWithTenantContext } from '../../prisma/tenant-context';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;
  let bus: { publish: jest.Mock; publishReadState: jest.Mock };

  beforeEach(() => {
    prisma = {
      notification: {
        create: jest.fn(async ({ data }: any) => ({ id: 'n-1', ...data, isRead: false, createdAt: new Date() })),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    bus = { publish: jest.fn(), publishReadState: jest.fn() };
    service = new NotificationsService(prisma, bus as any);
  });

  const input = { companyId: 'c1', userId: 'u1', type: 'task_assigned', title: 'New task' };

  describe('create', () => {
    it('does NOT push while the request transaction is still open — only after commit', async () => {
      const afterCommit: Array<() => void> = [];
      await runWithTenantContext({ tx: prisma, companyId: 'c1', afterCommit }, async () => {
        await service.create(input);
        expect(bus.publish).not.toHaveBeenCalled();
      });
      expect(afterCommit).toHaveLength(1);
      afterCommit.forEach((fn) => fn()); // what TenantTransactionMiddleware does after a successful commit
      expect(bus.publish).toHaveBeenCalledWith('u1', expect.objectContaining({ id: 'n-1', title: 'New task' }));
    });

    it('never pushes if the transaction rolls back (queued callbacks are simply never run)', async () => {
      const afterCommit: Array<() => void> = [];
      await runWithTenantContext({ tx: prisma, companyId: 'c1', afterCommit }, () => service.create(input).then(() => undefined));
      // rollback path: middleware drops afterCommit without running it
      expect(bus.publish).not.toHaveBeenCalled();
    });

    it('pushes immediately when called outside any request context', async () => {
      await service.create(input);
      expect(bus.publish).toHaveBeenCalledTimes(1);
    });

    it('stores missing optional fields as null rather than undefined', async () => {
      await service.create(input);
      const data = prisma.notification.create.mock.calls[0][0].data;
      expect(data.message).toBeNull();
      expect(data.entityType).toBeNull();
      expect(data.entityId).toBeNull();
    });
  });

  describe('reads are always scoped to the caller themselves', () => {
    it('list() filters by both companyId and userId, newest first', async () => {
      await service.list('c1', 'u1', { page: 1, pageSize: 20 });
      const args = prisma.notification.findMany.mock.calls[0][0];
      expect(args.where).toEqual({ companyId: 'c1', userId: 'u1' });
      expect(args.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('list() with unreadOnly adds isRead: false', async () => {
      await service.list('c1', 'u1', { page: 1, pageSize: 20, unreadOnly: true });
      expect(prisma.notification.findMany.mock.calls[0][0].where).toEqual({ companyId: 'c1', userId: 'u1', isRead: false });
    });

    it('markRead() can only ever touch the caller\'s own rows', async () => {
      await service.markRead('c1', 'u1', ['n-1', 'someone-elses-id']);
      expect(prisma.notification.updateMany.mock.calls[0][0].where).toEqual({
        companyId: 'c1', userId: 'u1', id: { in: ['n-1', 'someone-elses-id'] }, isRead: false,
      });
    });

    it('markRead() tells the user\'s other tabs only when something actually changed', async () => {
      prisma.notification.updateMany.mockResolvedValueOnce({ count: 0 });
      await service.markRead('c1', 'u1', ['n-1']);
      expect(bus.publishReadState).not.toHaveBeenCalled();

      prisma.notification.updateMany.mockResolvedValueOnce({ count: 1 });
      await service.markRead('c1', 'u1', ['n-1']);
      expect(bus.publishReadState).toHaveBeenCalledWith('u1', { ids: ['n-1'] });
    });

    it('markAllRead() is scoped to the caller and broadcasts {all: true}', async () => {
      prisma.notification.updateMany.mockResolvedValueOnce({ count: 3 });
      const result = await service.markAllRead('c1', 'u1');
      expect(prisma.notification.updateMany.mock.calls[0][0].where).toEqual({ companyId: 'c1', userId: 'u1', isRead: false });
      expect(result).toEqual({ updated: 3 });
      expect(bus.publishReadState).toHaveBeenCalledWith('u1', { all: true });
    });
  });
});
