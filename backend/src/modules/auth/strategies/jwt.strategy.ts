import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthContext } from '../../../common/interfaces/request-context.interface';
import { getTenantContext } from '../../../prisma/tenant-context';
import { enableRlsBypass } from '../../../prisma/rls-bypass.util';

/**
 * Validates the access token on every authenticated request.
 *
 * Deliberately re-checks the user's current status in the DB
 * (not just what was true at login) so that locking/deactivating
 * an account takes effect immediately, not only after the token
 * expires — this is what satisfies "locked user handling" as an
 * ongoing enforcement, not a login-time-only check.
 *
 * roles/permissions/customerId are trusted from the signed
 * payload for performance; they are refreshed on next login or
 * token refresh. If your app needs instant permission revocation
 * mid-session, shorten JWT_ACCESS_TTL rather than adding a DB
 * round trip here for every field.
 *
 * RLS BOOTSTRAP: this is the ONE place that discovers which
 * company a request belongs to in the first place — see
 * rls-bypass.util.ts for why the initial user lookup needs
 * app.bypass_rls, and TenantTransactionMiddleware for where the
 * open transaction this all runs inside comes from. Once the
 * user's companyId is confirmed valid below, this sets
 * app.current_company_id for every other query the rest of this
 * request makes — nothing downstream (controllers, services) has
 * to know or care that this happened.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: AuthContext): Promise<AuthContext> {
    // Passport has already cryptographically verified this JWT's
    // signature before this method ever runs — payload.sub is
    // trustworthy. Bypassing RLS for exactly this one lookup (by
    // primary key, not by any client-suppliable filter) is what
    // lets us find out which company this user belongs to, which
    // is the whole point of the lookup.
    await enableRlsBypass();

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, status: true, deletedAt: true, companyId: true },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Account no longer exists.');
    }
    if (user.status === 'locked') {
      throw new UnauthorizedException('Account is locked.');
    }
    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is not active.');
    }
    // Defense in depth: companyId in the token must still match
    // the user's current tenant record.
    if (user.companyId !== payload.companyId) {
      throw new UnauthorizedException('Token tenant context is stale.');
    }

    // From here on, every query this request makes is scoped by
    // Postgres itself to this one company — the bypass above was
    // only ever needed for the single lookup that established this.
    const ctx = getTenantContext();
    if (ctx) {
      await ctx.tx.$executeRaw`SELECT set_config('app.bypass_rls', 'off', true)`;
      await ctx.tx.$executeRaw`SELECT set_config('app.current_company_id', ${user.companyId}, true)`;
      ctx.companyId = user.companyId;
    }

    return payload; // becomes req.user
  }
}
