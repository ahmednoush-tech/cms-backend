import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { runWithTenantContext } from '../../prisma/tenant-context';

/** The exact shape pushed to the browser — also what the REST list endpoint returns per item. */
export interface NotificationPayload {
  id: string;
  type: string;
  title: string;
  message: string | null;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: Date;
}

interface StreamClient {
  id: string;
  userId: string;
  res: Response;
  lifetimeTimer: NodeJS.Timeout;
}

/**
 * A tiny `ping` event every 25s. Two jobs: keeps nginx (default 60s
 * read timeout) and other proxies from closing an idle stream, AND
 * lets the browser detect a silently-dead connection (laptop sleep,
 * network switch) — it reconnects if pings stop arriving. A real
 * event rather than an SSE `: comment` on purpose: browsers hide
 * comment lines from JavaScript, so a comment heartbeat could never
 * be watched for.
 */
export const HEARTBEAT_MS = 25_000;
/** Cross-instance catch-up interval — the worst-case delay for a notification created on a DIFFERENT app instance. */
export const POLL_MS = 15_000;
/** Overlap re-checked on each poll, to catch rows whose transaction committed slightly after their created_at. */
export const POLL_OVERLAP_MS = 10_000;
/**
 * Every stream is closed after this, and the browser reconnects
 * through a fresh ticket — which re-runs the full login guard. This
 * is what bounds how long a since-locked or deleted account can
 * keep receiving: at most this long.
 */
export const MAX_STREAM_LIFETIME_MS = 30 * 60_000;
/** How long a pushed notification id is remembered, so the poller never pushes it a second time. */
const RECENT_ID_TTL_MS = 5 * 60_000;

/**
 * Per-instance real-time delivery. Deliberately NOT built on
 * WebSockets/Redis/Postgres LISTEN — none of those packages are
 * installed and this environment has no network to add them.
 * Server-Sent Events need nothing beyond Express itself, and fit
 * the actual shape of the problem: notifications only ever flow
 * server → browser.
 *
 * MULTIPLE APP INSTANCES: publish() only reaches browsers connected
 * to THIS instance. Anything created on another instance is picked
 * up by the poller below within POLL_MS — one small query per
 * instance per interval, regardless of how many users are
 * connected (not one query per connection). With a single instance
 * (the current docker-compose setup) delivery is always instant and
 * the poller is just a safety net.
 */
@Injectable()
export class NotificationBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationBusService.name);
  private readonly clientsByUser = new Map<string, Set<StreamClient>>();
  private readonly recentlyPushed = new Map<string, number>(); // notification id -> pushed-at ms
  private heartbeatTimer?: NodeJS.Timeout;
  private pollTimer?: NodeJS.Timeout;
  private lastPollAt = new Date();
  private polling = false;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    this.heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    this.pollTimer = setInterval(() => void this.pollOtherInstances(), POLL_MS);
    // Never keep the Node process alive just for these timers.
    this.heartbeatTimer.unref?.();
    this.pollTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pollTimer) clearInterval(this.pollTimer);
    for (const clients of this.clientsByUser.values()) {
      for (const client of clients) this.closeClient(client, 'shutdown');
    }
  }

  /** Opens an SSE stream on `res` for this user. Caller must have already authenticated the user. */
  register(userId: string, res: Response): void {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    // nginx honors this per-response — without it, nginx buffers the
    // stream and nothing reaches the browser until the buffer fills.
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // Tell the browser to wait 5s before any automatic reconnect.
    // Guarded: if the browser already disconnected in the moment
    // between the ticket check and here, give up quietly rather than
    // throwing into the request handler.
    try {
      res.write('retry: 5000\n\n');
    } catch {
      return;
    }

    const client: StreamClient = {
      id: randomUUID(),
      userId,
      res,
      lifetimeTimer: setTimeout(() => this.closeClient(client, 'lifetime'), MAX_STREAM_LIFETIME_MS),
    };
    client.lifetimeTimer.unref?.();

    let set = this.clientsByUser.get(userId);
    if (!set) {
      set = new Set();
      this.clientsByUser.set(userId, set);
    }
    set.add(client);

    res.on('close', () => this.removeClient(client));
    this.write(client, 'ready', { connectedAt: new Date().toISOString() });
  }

  /** Pushes to every stream this user has open on THIS instance (several tabs = several streams). */
  publish(userId: string, notification: NotificationPayload): void {
    this.recentlyPushed.set(notification.id, Date.now());
    const clients = this.clientsByUser.get(userId);
    if (!clients) return;
    for (const client of clients) this.write(client, 'notification', notification, notification.id);
  }

  /** Lets the user's OTHER tabs update their unread badge after a mark-read in one tab. */
  publishReadState(userId: string, event: { ids?: string[]; all?: boolean }): void {
    const clients = this.clientsByUser.get(userId);
    if (!clients) return;
    for (const client of clients) this.write(client, 'read', event);
  }

  /** For tests and diagnostics. */
  connectedClientCount(): number {
    let n = 0;
    for (const set of this.clientsByUser.values()) n += set.size;
    return n;
  }

  private write(client: StreamClient, event: string, data: unknown, id?: string): void {
    try {
      // JSON.stringify never emits a raw newline (they're escaped),
      // so a single data: line is always a valid SSE frame.
      client.res.write(`${id ? `id: ${id}\n` : ''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      this.removeClient(client);
    }
  }

  private heartbeat(): void {
    for (const clients of this.clientsByUser.values()) {
      // Copy first: write() may remove a broken client mid-iteration.
      for (const client of [...clients]) this.write(client, 'ping', {});
    }
  }

  private closeClient(client: StreamClient, reason: 'lifetime' | 'shutdown'): void {
    // Tells the browser this close is intentional — reconnect via a
    // fresh ticket rather than treating it as an error.
    this.write(client, 'reconnect', { reason });
    try {
      client.res.end();
    } catch {
      /* already gone */
    }
    this.removeClient(client);
  }

  private removeClient(client: StreamClient): void {
    clearTimeout(client.lifetimeTimer);
    const set = this.clientsByUser.get(client.userId);
    if (!set) return;
    set.delete(client);
    if (set.size === 0) this.clientsByUser.delete(client.userId);
  }

  /**
   * Picks up notifications created on OTHER app instances (or by any
   * code path that wrote a row without going through
   * NotificationsService). Runs outside any HTTP request, so it opens
   * its own short transaction — the same pattern the scheduler uses —
   * and bypasses RLS explicitly; the query is then scoped by an
   * explicit list of the user ids actually connected to this
   * instance, so it can only ever return rows belonging to them.
   * Exported for tests.
   */
  async pollOtherInstances(): Promise<void> {
    if (this.polling) return; // a slow poll must never overlap the next one
    this.pruneRecentlyPushed();
    const userIds = [...this.clientsByUser.keys()];
    const since = new Date(this.lastPollAt.getTime() - POLL_OVERLAP_MS);
    this.lastPollAt = new Date();
    if (userIds.length === 0) return;

    this.polling = true;
    try {
      const rows = await this.prisma.startRequestTransaction((tx) =>
        runWithTenantContext({ tx, companyId: null }, async () => {
          await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
          return tx.notification.findMany({
            where: { userId: { in: userIds }, createdAt: { gt: since } },
            orderBy: { createdAt: 'asc' },
            take: 500,
            select: {
              id: true, userId: true, type: true, title: true, message: true,
              entityType: true, entityId: true, isRead: true, createdAt: true,
            },
          });
        }),
      );
      for (const row of rows) {
        if (this.recentlyPushed.has(row.id)) continue;
        const { userId, ...payload } = row;
        this.publish(userId, payload);
      }
    } catch (err) {
      this.logger.warn(`Notification catch-up poll failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.polling = false;
    }
  }

  private pruneRecentlyPushed(): void {
    const cutoff = Date.now() - RECENT_ID_TTL_MS;
    for (const [id, at] of this.recentlyPushed) {
      if (at < cutoff) this.recentlyPushed.delete(id);
    }
  }
}
