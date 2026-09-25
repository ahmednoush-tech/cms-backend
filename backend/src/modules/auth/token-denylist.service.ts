import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Tracks revoked refresh tokens so /auth/logout can actually
 * invalidate a session rather than relying purely on client-side
 * token deletion.
 *
 * Database-backed (revoked_refresh_tokens, migration 110) —
 * REPLACES the previous in-memory Map, which was a real, disclosed
 * problem: revoking a token on one app instance had no effect on
 * a different instance behind a load balancer, since each held
 * its own separate in-memory list. A shared PostgreSQL table
 * fixes this without introducing a new piece of infrastructure
 * (e.g. Redis) — isRevoked() is only ever checked during a
 * refresh-token request (see RefreshJwtStrategy), not on every
 * authenticated API call, so the extra query per check is a
 * non-issue: refreshes happen roughly once per access-token
 * lifetime (JWT_ACCESS_TTL, minutes), never per-request.
 */
@Injectable()
export class TokenDenylistService {
  constructor(private prisma: PrismaService) {}

  async revoke(jti: string, expiryEpochMs: number): Promise<void> {
    await this.prisma.revokedRefreshToken.upsert({
      where: { jti },
      create: { jti, expiresAt: new Date(expiryEpochMs) },
      update: { expiresAt: new Date(expiryEpochMs) },
    });
  }

  async isRevoked(jti: string): Promise<boolean> {
    const row = await this.prisma.revokedRefreshToken.findUnique({ where: { jti } });
    if (!row) return false;
    // A naturally-expired entry is functionally irrelevant — the
    // refresh token it names would already be rejected by its own
    // JWT expiry before this check even runs. Treating it as "not
    // revoked" here is safe; a periodic cleanup job (not yet
    // built) can delete these rows without affecting correctness.
    return row.expiresAt.getTime() >= Date.now();
  }
}
