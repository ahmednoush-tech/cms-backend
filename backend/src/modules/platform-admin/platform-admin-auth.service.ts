import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { enableRlsBypass } from '../../prisma/rls-bypass.util';
import { PlatformAdminAuthContext } from './platform-admin-context.interface';

/**
 * Deliberately separate from AuthService: different table
 * (platform_admins, no companyId), different signing secret
 * (PLATFORM_ADMIN_JWT_SECRET, never JWT_ACCESS_SECRET), no refresh
 * token complexity — this is an internal ops tool for a small,
 * known team, not a public-facing login with the same session
 * requirements as a tenant's own users.
 */
@Injectable()
export class PlatformAdminAuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(email: string, password: string) {
    await enableRlsBypass();

    const admin = await this.prisma.platformAdmin.findUnique({ where: { email } });

    if (!admin) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    if (admin.status !== 'active') {
      throw new ForbiddenException('This platform admin account is disabled.');
    }

    const passwordValid = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    await this.prisma.platformAdmin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });

    const authContext: PlatformAdminAuthContext = { sub: admin.id, email: admin.email, type: 'platform-admin' };
    const accessToken = this.jwt.sign(authContext, {
      secret: this.getRequiredSecret(),
      expiresIn: this.config.get<string>('PLATFORM_ADMIN_JWT_TTL', '8h'),
    });

    return { accessToken, admin: { id: admin.id, name: admin.name, email: admin.email } };
  }

  private getRequiredSecret(): string {
    const secret = this.config.get<string>('PLATFORM_ADMIN_JWT_SECRET');
    if (!secret) {
      throw new Error('PLATFORM_ADMIN_JWT_SECRET is not configured — platform admin login cannot issue tokens.');
    }
    return secret;
  }
}
