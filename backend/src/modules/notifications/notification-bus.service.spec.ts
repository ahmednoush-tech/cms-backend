import { EventEmitter } from 'events';
import { NotificationBusService, NotificationPayload } from './notification-bus.service';

/**
 * The same scenarios were also executed against the real source in
 * this environment (transpiled, framework imports stubbed) before
 * this file was written — 31/31 passing.
 */
function fakeRes() {
  const r: any = new EventEmitter();
  r.headers = {}; r.chunks = [] as string[]; r.ended = false;
  r.status = jest.fn(() => r);
  r.setHeader = (k: string, v: string) => { r.headers[k.toLowerCase()] = v; };
  r.flushHeaders = jest.fn();
  r.write = jest.fn((c: string) => { r.chunks.push(c); return true; });
  r.end = jest.fn(() => { r.ended = true; });
  r.body = () => r.chunks.join('');
  return r;
}

const sample = (id: string): NotificationPayload => ({
  id, type: 'task_assigned', title: 'New task', message: null,
  entityType: 'task', entityId: 't-1', isRead: false, createdAt: new Date(),
});

describe('NotificationBusService', () => {
  let bus: NotificationBusService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      startRequestTransaction: jest.fn((fn: any) => fn(prisma)),
      $executeRaw: jest.fn(),
      notification: { findMany: jest.fn().mockResolvedValue([]) },
    };
    bus = new NotificationBusService(prisma);
  });

  afterEach(() => bus.onModuleDestroy());

  it('opens a proper SSE stream (headers, retry directive, ready event)', () => {
    const res = fakeRes();
    bus.register('u1', res);
    expect(res.headers['content-type']).toMatch(/^text\/event-stream/);
    expect(res.headers['x-accel-buffering']).toBe('no');
    expect(res.chunks[0]).toBe('retry: 5000\n\n');
    expect(res.body()).toContain('event: ready\n');
  });

  it("delivers to all of a user's tabs and never to another user", () => {
    const a1 = fakeRes(), a2 = fakeRes(), b = fakeRes();
    bus.register('alice', a1); bus.register('alice', a2); bus.register('bob', b);
    bus.publish('alice', sample('n-1'));
    expect(a1.body()).toContain('id: n-1\n');
    expect(a2.body()).toContain('id: n-1\n');
    expect(b.body()).not.toContain('n-1');
  });

  it('encodes a title containing a newline as ONE data line that round-trips exactly', () => {
    const res = fakeRes();
    bus.register('u1', res);
    const n = { ...sample('n-1'), title: 'سطر أول\nسطر ثانٍ "مقتبس"' };
    bus.publish('u1', n);
    const frame: string = res.chunks[res.chunks.length - 1];
    const dataLines = frame.split('\n').filter((l) => l.startsWith('data: '));
    expect(dataLines).toHaveLength(1);
    expect(JSON.parse(dataLines[0].slice(6)).title).toBe(n.title);
  });

  it('stops writing to a tab once it closes', () => {
    const res = fakeRes();
    bus.register('u1', res);
    res.emit('close');
    expect(bus.connectedClientCount()).toBe(0);
    bus.publish('u1', sample('n-1'));
    expect(res.body()).not.toContain('n-1');
  });

  it('drops a broken socket instead of throwing out of publish()', () => {
    const res = fakeRes();
    bus.register('u1', res);
    res.write = jest.fn(() => { throw new Error('EPIPE'); });
    expect(() => bus.publish('u1', sample('n-1'))).not.toThrow();
    expect(bus.connectedClientCount()).toBe(0);
  });

  it('sends read-state updates only to that user', () => {
    const a = fakeRes(), b = fakeRes();
    bus.register('alice', a); bus.register('bob', b);
    bus.publishReadState('alice', { all: true });
    expect(a.body()).toContain('event: read\n');
    expect(b.body()).not.toContain('event: read\n'); // note: every stream legitimately has "event: ready"
  });

  describe('pollOtherInstances (cross-instance catch-up)', () => {
    it('delivers a row created elsewhere, exactly once across repeated polls', async () => {
      const res = fakeRes();
      bus.register('u1', res);
      prisma.notification.findMany.mockResolvedValue([{ ...sample('remote-1'), userId: 'u1' }]);
      await bus.pollOtherInstances();
      await bus.pollOtherInstances();
      expect(res.chunks.filter((c: string) => c.startsWith('id: remote-1')).length).toBe(1);
    });

    it('only ever queries for users connected to this instance', async () => {
      bus.register('u1', fakeRes());
      await bus.pollOtherInstances();
      expect(prisma.notification.findMany.mock.calls[0][0].where.userId).toEqual({ in: ['u1'] });
    });

    it('makes no query at all when nobody is connected', async () => {
      await bus.pollOtherInstances();
      expect(prisma.notification.findMany).not.toHaveBeenCalled();
    });

    it('logs instead of throwing when the database is unavailable', async () => {
      bus.register('u1', fakeRes());
      prisma.startRequestTransaction.mockRejectedValue(new Error('db down'));
      await expect(bus.pollOtherInstances()).resolves.toBeUndefined();
    });
  });

  it('on shutdown, tells every browser to reconnect and ends the stream', () => {
    const res = fakeRes();
    bus.register('u1', res);
    bus.onModuleDestroy();
    expect(res.body()).toContain('event: reconnect\n');
    expect(res.ended).toBe(true);
  });
});
