import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

const PURPOSE = 'notification_stream';
export const TICKET_TTL_SECONDS = 60;

/**
 * Browsers' built-in EventSource cannot send an Authorization
 * header, so the stream can't use the normal Bearer-token login.
 * Instead, the browser first calls an ordinary authenticated
 * endpoint (full JwtAuthGuard: signature, account locked/deleted,
 * tenant match — everything) to get a ticket, then opens the stream
 * with that ticket in the URL.
 *
 * The ticket is signed with a key DERIVED from the access-token
 * secret but deliberately different from it. That matters: a ticket
 * appears in a URL (and so can end up in proxy logs), so it must be
 * useless as an access token — and because it's signed with a
 * different key, JwtStrategy will reject it outright. It also only
 * lives 60 seconds and only ever grants "open my own notification
 * stream". Stateless by design (no single-use tracking) — a reused
 * ticket within its 60s just opens a second stream of the SAME
 * user's own notifications, which exposes nothing new.
 */
@Injectable()
export class StreamTicketService {
  constructor(
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  private secret(): string {
    const base = this.config.get<string>('JWT_ACCESS_SECRET');
    if (!base) throw new Error('JWT_ACCESS_SECRET is not configured.');
    return `${base}::notification-stream-ticket`;
  }

  issue(userId: string, companyId: string): { ticket: string; expiresIn: number } {
    const ticket = this.jwt.sign(
      { sub: userId, companyId, purpose: PURPOSE },
      { secret: this.secret(), expiresIn: TICKET_TTL_SECONDS },
    );
    return { ticket, expiresIn: TICKET_TTL_SECONDS };
  }

  verify(ticket: string | undefined): { userId: string; companyId: string } {
    if (!ticket) throw new UnauthorizedException('Missing stream ticket.');
    let payload: { sub?: string; companyId?: string; purpose?: string };
    try {
      payload = this.jwt.verify(ticket, { secret: this.secret() });
    } catch {
      throw new UnauthorizedException('Invalid or expired stream ticket.');
    }
    if (payload.purpose !== PURPOSE || !payload.sub || !payload.companyId) {
      throw new UnauthorizedException('Invalid stream ticket.');
    }
    return { userId: payload.sub, companyId: payload.companyId };
  }
}
