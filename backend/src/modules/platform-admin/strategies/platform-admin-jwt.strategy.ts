import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { enableRlsBypass } from '../../../prisma/rls-bypass.util';
import { PlatformAdminAuthContext } from '../platform-admin-context.interface';

/**
 * Registered under the strategy name 'platform-admin-jwt', never
 * 'jwt' — this and JwtStrategy are two entirely separate Passport
 * strategies. A token signed with JWT_ACCESS_SECRET (a tenant
 * user's token) is cryptographically invalid here, since this
 * strategy verifies against PLATFORM_ADMIN_JWT_SECRET instead —
 * there is no code path where one system's token could pass the
 * other's guard.
 */
@Injectable()
export class PlatformAdminJwtStrategy extends PassportStrategy(Strategy, 'platform-admin-jwt') {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('PLATFORM_ADMIN_JWT_SECRET'),
    });
  }

  async validate(payload: PlatformAdminAuthContext): Promise<PlatformAdminAuthContext> {
    if (payload.type !== 'platform-admin') {
      throw new UnauthorizedException('Invalid token type.');
    }

    await enableRlsBypass();

    const admin = await this.prisma.platformAdmin.findUnique({
      where: { id: payload.sub },
      select: { id: true, status: true },
    });

    if (!admin) {
      throw new UnauthorizedException('Platform admin account no longer exists.');
    }
    if (admin.status !== 'active') {
      throw new UnauthorizedException('Platform admin account is disabled.');
    }

    return payload;
  }
}
