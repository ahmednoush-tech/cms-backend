import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenDenylistService } from './token-denylist.service';
import { EmailService } from '../../common/services/email.service';
import { AuthContext } from '../../common/interfaces/request-context.interface';
import { COMPANY_WIDE_SCOPE_ID } from '../../common/constants/scope.constants';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private denylist: TokenDenylistService,
    private email: EmailService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        employee: true,
        userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
        userPermissions: { include: { permission: true } },
        customerUsers: { where: { status: 'active', deletedAt: null } },
      },
    });

    // Deliberately identical error for "no such user" and "wrong
    // password" — do not leak which one it was.
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.status === 'locked') {
      throw new ForbiddenException(
        'This account is locked due to repeated failed login attempts. Contact an administrator.',
      );
    }
    if (user.status !== 'active') {
      throw new ForbiddenException('This account is not active.');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      await this.registerFailedAttempt(user.id);
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Reset the counter and record the successful login in one
    // write — previously two separate steps (a Map.delete() plus
    // this same update), now both live on the same row anyway.
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lastLoginAt: new Date() },
    });

    const authContext = this.buildAuthContext(user);
    return this.issueTokenPair(authContext);
  }

  async refresh(refreshPayload: { sub: string; jti: string; exp: number }) {
    const user = await this.prisma.user.findUnique({
      where: { id: refreshPayload.sub },
      include: {
        employee: true,
        userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
        userPermissions: { include: { permission: true } },
        customerUsers: { where: { status: 'active', deletedAt: null } },
      },
    });

    if (!user || user.deletedAt || user.status !== 'active') {
      throw new UnauthorizedException('Account no longer available.');
    }

    // Rotate: revoke the presented refresh token so it cannot be
    // replayed, then issue a new pair. This was previously a no-op
    // (the old jti was never actually denylisted) — fixed during
    // Phase 2B verification.
    await this.denylist.revoke(refreshPayload.jti, refreshPayload.exp * 1000);

    const authContext = this.buildAuthContext(user);
    return this.issueTokenPair(authContext);
  }

  async logout(jti: string, exp: number) {
    await this.denylist.revoke(jti, exp * 1000);
  }

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, SALT_ROUNDS);
  }

  /**
   * Always resolves with no indication of whether the email
   * matched an account — the caller (controller) returns the same
   * generic message either way, preventing user enumeration via
   * this endpoint. If a real user IS found, a single-use, 1-hour
   * token is created and (attempted to be) emailed; only a HASH
   * of the token is ever stored, matching the password_hash
   * pattern — the raw token exists only in the email itself.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.deletedAt || user.status !== 'active') {
      return;
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;
    await this.email.sendPasswordResetEmail(user.email, resetUrl);
  }

  /**
   * Rejects with the same generic message for "token not found",
   * "already used", and "expired" — no reason to distinguish them
   * for the caller, and distinguishing them would leak information
   * about token validity/timing to anyone probing the endpoint.
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const record = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('This reset link is invalid or has expired.');
    }

    const passwordHash = await this.hashPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    ]);
  }

  /**
   * Builds the AuthContext that gets signed into the access
   * token and later trusted (per-request) as req.user. This is
   * the single place company_id / customer_id / permissions are
   * computed from the database — never accept these from a
   * client-supplied value anywhere else in the app.
   */
  private buildAuthContext(user: any): AuthContext {
    const roles = user.userRoles.map((ur: any) => ur.role.name as string);

    // One entry per (permission, scope) grant, from BOTH
    // role-based permissions (each carrying the UserRole row's own
    // scope) and direct per-user permission grants.
    const grants: Array<{ permStr: string; scopeType: string; scopeId: string }> = [];
    for (const ur of user.userRoles) {
      for (const rp of ur.role.rolePermissions) {
        grants.push({
          permStr: `${rp.permission.module}:${rp.permission.resource}:${rp.permission.action}`,
          scopeType: ur.scopeType,
          scopeId: ur.scopeId,
        });
      }
    }
    for (const up of user.userPermissions ?? []) {
      grants.push({
        permStr: `${up.permission.module}:${up.permission.resource}:${up.permission.action}`,
        scopeType: up.scopeType,
        scopeId: up.scopeId,
      });
    }

    const permissions = Array.from(new Set(grants.map((g) => g.permStr)));

    // A permission appears in scopedPermissions ONLY if every one
    // of its grants is scoped — a single unscoped grant means full,
    // unrestricted access, so the permission is left out entirely
    // rather than narrowed. See AuthContext.scopedPermissions'
    // own comment for why services must check this explicitly.
    const scopedPermissions: Record<string, Array<{ scopeType: string; scopeId: string }>> = {};
    for (const permStr of permissions) {
      const grantsForThis = grants.filter((g) => g.permStr === permStr);
      const hasUnscopedGrant = grantsForThis.some((g) => g.scopeId === COMPANY_WIDE_SCOPE_ID);
      if (!hasUnscopedGrant) {
        scopedPermissions[permStr] = grantsForThis.map((g) => ({ scopeType: g.scopeType, scopeId: g.scopeId }));
      }
    }

    const activeCustomerUser = user.customerUsers?.[0];

    return {
      sub: user.id,
      companyId: user.companyId,
      email: user.email,
      employeeId: user.employee?.id,
      roles,
      permissions,
      scopedPermissions,
      isCustomerUser: !!activeCustomerUser,
      customerId: activeCustomerUser?.customerId,
    };
  }

  private issueTokenPair(authContext: AuthContext) {
    const accessTtl = this.config.get<string>('JWT_ACCESS_TTL', '15m');
    const refreshTtl = this.config.get<string>('JWT_REFRESH_TTL', '7d');
    const jti = randomUUID();

    const accessToken = this.jwt.sign(authContext, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessTtl,
    });

    const refreshToken = this.jwt.sign(
      { sub: authContext.sub, jti },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTtl,
      },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.ttlToSeconds(accessTtl),
      user: {
        id: authContext.sub,
        email: authContext.email,
        companyId: authContext.companyId,
        employeeId: authContext.employeeId,
        roles: authContext.roles,
        isCustomerUser: authContext.isCustomerUser,
        customerId: authContext.customerId,
      },
    };
  }

  /**
   * Increments failed_login_attempts atomically at the database
   * level (Prisma's `increment` compiles to `SET x = x + 1`, safe
   * under concurrent failed attempts) rather than the previous
   * in-memory Map<email, count> — see migration 111's comment for
   * why that was a real, disclosed problem. Locking the account
   * also resets the counter to 0, so a later unlock (by an admin)
   * starts the threshold fresh rather than immediately re-locking
   * on the next single failure.
   */
  private async registerFailedAttempt(userId: string) {
    const maxAttempts = this.config.get<number>(
      'MAX_FAILED_LOGIN_ATTEMPTS',
      5,
    );
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });

    if (updated.failedLoginAttempts >= maxAttempts) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { status: 'locked', failedLoginAttempts: 0 },
      });
    }
  }

  private ttlToSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 900;
    const [, value, unit] = match;
    const n = parseInt(value, 10);
    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };
    return n * multipliers[unit];
  }
}
