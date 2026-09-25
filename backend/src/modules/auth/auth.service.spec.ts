import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenDenylistService } from './token-denylist.service';
import { COMPANY_WIDE_SCOPE_ID } from '../../common/constants/scope.constants';

describe('AuthService', () => {
  let service: AuthService;
  let jwtSignMock: jest.Mock;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  const baseUser = {
    id: 'user-1',
    companyId: 'company-1',
    email: 'sara@demo-company.com',
    status: 'active',
    deletedAt: null,
    employee: { id: 'emp-1' },
    userRoles: [
      {
        scopeType: 'company',
        scopeId: COMPANY_WIDE_SCOPE_ID,
        role: {
          name: 'Manager',
          rolePermissions: [
            {
              permission: { module: 'CRM', resource: 'customers', action: 'view' },
            },
          ],
        },
      },
    ],
    userPermissions: [],
    customerUsers: [],
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: { sign: (jwtSignMock = jest.fn().mockReturnValue('signed.jwt.token')) },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: unknown) => {
              const values: Record<string, unknown> = {
                JWT_ACCESS_SECRET: 'access-secret',
                JWT_ACCESS_TTL: '15m',
                JWT_REFRESH_SECRET: 'refresh-secret',
                JWT_REFRESH_TTL: '7d',
                MAX_FAILED_LOGIN_ATTEMPTS: 3,
              };
              return values[key] ?? fallback;
            }),
          },
        },
        { provide: TokenDenylistService, useValue: { revoke: jest.fn(), isRevoked: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('logs in successfully with correct credentials and returns a token pair + context', async () => {
    const hash = await bcrypt.hash('correct-password', 4);
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash: hash });
    prisma.user.update.mockResolvedValue({});

    const result = await service.login('sara@demo-company.com', 'correct-password');

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.user.companyId).toBe('company-1');
    expect(result.user.isCustomerUser).toBe(false);
    expect(result.user.employeeId).toBe('emp-1');
  });

  it('rejects an unknown email with a generic message (no user enumeration)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.login('nobody@demo-company.com', 'whatever123'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a wrong password with the same generic message', async () => {
    const hash = await bcrypt.hash('correct-password', 4);
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash: hash });

    await expect(
      service.login('sara@demo-company.com', 'wrong-password'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('refuses a locked account even with the correct password', async () => {
    const hash = await bcrypt.hash('correct-password', 4);
    prisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      status: 'locked',
      passwordHash: hash,
    });

    await expect(
      service.login('sara@demo-company.com', 'correct-password'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('locks the account after MAX_FAILED_LOGIN_ATTEMPTS consecutive failures', async () => {
    const hash = await bcrypt.hash('correct-password', 4);
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash: hash });
    // Each failed attempt reads back the ACTUAL incremented count
    // from the database (Prisma's `increment` returns the new
    // value) — the service's own lockout decision depends on this
    // returned value, not on any counter it keeps itself, so the
    // mock must simulate the count genuinely climbing across calls.
    prisma.user.update
      .mockResolvedValueOnce({ failedLoginAttempts: 1 })
      .mockResolvedValueOnce({ failedLoginAttempts: 2 })
      .mockResolvedValueOnce({ failedLoginAttempts: 3 })
      .mockResolvedValueOnce({}); // the lock-the-account write itself

    for (let i = 0; i < 3; i++) {
      await expect(
        service.login('sara@demo-company.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
    }

    expect(prisma.user.update).toHaveBeenLastCalledWith({
      where: { id: 'user-1' },
      data: { status: 'locked', failedLoginAttempts: 0 },
    });
  });

  it('does NOT lock the account before the threshold is reached', async () => {
    const hash = await bcrypt.hash('correct-password', 4);
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash: hash });
    prisma.user.update.mockResolvedValue({ failedLoginAttempts: 1 });

    await expect(
      service.login('sara@demo-company.com', 'wrong-password'),
    ).rejects.toThrow(UnauthorizedException);

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { failedLoginAttempts: { increment: 1 } },
      select: { failedLoginAttempts: true },
    });
  });

  it('resets the failed-attempt counter to 0 on a successful login', async () => {
    const hash = await bcrypt.hash('correct-password', 4);
    prisma.user.findUnique.mockResolvedValue({ ...baseUser, passwordHash: hash });
    prisma.user.update.mockResolvedValue({ ...baseUser, passwordHash: hash });

    await service.login('sara@demo-company.com', 'correct-password');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { failedLoginAttempts: 0, lastLoginAt: expect.any(Date) },
    });
  });

  it('builds a customer-portal context with customerId when customerUsers is populated', async () => {
    const hash = await bcrypt.hash('correct-password', 4);
    prisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      employee: null,
      customerUsers: [{ customerId: 'cust-123' }],
      passwordHash: hash,
    });
    prisma.user.update.mockResolvedValue({});

    const result = await service.login('sara@demo-company.com', 'correct-password');

    expect(result.user.isCustomerUser).toBe(true);
    expect(result.user.customerId).toBe('cust-123');
    expect(result.user.employeeId).toBeUndefined();
  });

  it('rotates the refresh token: the old jti is revoked when a new pair is issued', async () => {
    prisma.user.findUnique.mockResolvedValue(baseUser);
    const denylist = { revoke: jest.fn(), isRevoked: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('new.jwt.token') } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: unknown) => {
              const values: Record<string, unknown> = {
                JWT_ACCESS_SECRET: 'access-secret',
                JWT_ACCESS_TTL: '15m',
                JWT_REFRESH_SECRET: 'refresh-secret',
                JWT_REFRESH_TTL: '7d',
              };
              return values[key] ?? fallback;
            }),
          },
        },
        { provide: TokenDenylistService, useValue: denylist },
      ],
    }).compile();

    const scopedService = moduleRef.get(AuthService);
    const exp = Math.floor(Date.now() / 1000) + 3600;

    await scopedService.refresh({ sub: 'user-1', jti: 'old-jti', exp });

    expect(denylist.revoke).toHaveBeenCalledWith('old-jti', exp * 1000);
  });

  describe('scoped permissions (delegated admin + direct grants)', () => {
    it('puts an unscoped (company-wide) permission in the flat list and leaves it OUT of scopedPermissions', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);

      const exp = Math.floor(Date.now() / 1000) + 3600;
      await service.refresh({ sub: 'user-1', jti: 'j', exp });

      // The client-facing response body from issueTokenPair
      // deliberately does NOT include permissions/scopedPermissions
      // (confirmed by reading it) — only the signed access token
      // itself carries the full AuthContext, so that's what's
      // checked here: the first argument of the FIRST sign() call
      // (access token; the second call signs the refresh token).
      const signedAccessTokenPayload = jwtSignMock.mock.calls[0][0];
      expect(signedAccessTokenPayload.permissions).toContain('CRM:customers:view');
      expect(signedAccessTokenPayload.scopedPermissions['CRM:customers:view']).toBeUndefined();
    });

    it('scopes a role-based permission to just its department when that is its ONLY grant', async () => {
      const scopedUser = {
        ...baseUser,
        userRoles: [
          {
            scopeType: 'department',
            scopeId: 'dept-1',
            role: {
              name: 'Employees Manager',
              rolePermissions: [
                { permission: { module: 'Administration', resource: 'employees', action: 'edit' } },
              ],
            },
          },
        ],
      };
      prisma.user.findUnique.mockResolvedValue(scopedUser);

      const exp = Math.floor(Date.now() / 1000) + 3600;
      await service.refresh({ sub: 'user-1', jti: 'j', exp });

      // Access to the endpoint is still granted (the flat list is
      // what PermissionsGuard checks) — it's the SERVICE layer's
      // job to read scopedPermissions and narrow the data, not the
      // guard's job to reject the request outright.
      const payload = jwtSignMock.mock.calls[0][0];
      expect(payload.permissions).toContain('Administration:employees:edit');
      expect(payload.scopedPermissions['Administration:employees:edit']).toEqual([
        { scopeType: 'department', scopeId: 'dept-1' },
      ]);
    });

    it('treats a permission as FULLY granted (no entry in scopedPermissions) when the user ALSO holds it unscoped via a different role', async () => {
      const mixedUser = {
        ...baseUser,
        userRoles: [
          {
            scopeType: 'department',
            scopeId: 'dept-1',
            role: {
              name: 'Scoped Employees Manager',
              rolePermissions: [
                { permission: { module: 'Administration', resource: 'employees', action: 'edit' } },
              ],
            },
          },
          {
            scopeType: 'company',
            scopeId: COMPANY_WIDE_SCOPE_ID,
            role: {
              name: 'Super Admin',
              rolePermissions: [
                { permission: { module: 'Administration', resource: 'employees', action: 'edit' } },
              ],
            },
          },
        ],
      };
      prisma.user.findUnique.mockResolvedValue(mixedUser);

      const exp = Math.floor(Date.now() / 1000) + 3600;
      await service.refresh({ sub: 'user-1', jti: 'j', exp });

      const payload = jwtSignMock.mock.calls[0][0];
      expect(payload.permissions).toContain('Administration:employees:edit');
      expect(payload.scopedPermissions['Administration:employees:edit']).toBeUndefined();
    });

    it('includes a direct per-user permission grant (no role involved) in the flat permissions list', async () => {
      const directGrantUser = {
        ...baseUser,
        userRoles: [],
        userPermissions: [
          {
            scopeType: 'company',
            scopeId: COMPANY_WIDE_SCOPE_ID,
            permission: { module: 'Finance', resource: 'invoices', action: 'view' },
          },
        ],
      };
      prisma.user.findUnique.mockResolvedValue(directGrantUser);

      const exp = Math.floor(Date.now() / 1000) + 3600;
      await service.refresh({ sub: 'user-1', jti: 'j', exp });

      const payload = jwtSignMock.mock.calls[0][0];
      expect(payload.permissions).toContain('Finance:invoices:view');
      expect(payload.scopedPermissions['Finance:invoices:view']).toBeUndefined();
    });

    it('scopes a direct per-user permission grant just like a scoped role grant', async () => {
      const scopedDirectGrantUser = {
        ...baseUser,
        userRoles: [],
        userPermissions: [
          {
            scopeType: 'department',
            scopeId: 'dept-2',
            permission: { module: 'Administration', resource: 'employees', action: 'view' },
          },
        ],
      };
      prisma.user.findUnique.mockResolvedValue(scopedDirectGrantUser);

      const exp = Math.floor(Date.now() / 1000) + 3600;
      await service.refresh({ sub: 'user-1', jti: 'j', exp });

      const payload = jwtSignMock.mock.calls[0][0];
      expect(payload.permissions).toContain('Administration:employees:view');
      expect(payload.scopedPermissions['Administration:employees:view']).toEqual([
        { scopeType: 'department', scopeId: 'dept-2' },
      ]);
    });
  });
});
