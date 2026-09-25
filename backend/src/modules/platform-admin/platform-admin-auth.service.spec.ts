import { Test } from '@nestjs/testing';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PlatformAdminAuthService } from './platform-admin-auth.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PlatformAdminAuthService', () => {
  let service: PlatformAdminAuthService;
  let prisma: any;
  let jwt: { sign: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    prisma = { platformAdmin: { findUnique: jest.fn(), update: jest.fn() } };
    jwt = { sign: jest.fn().mockReturnValue('signed-platform-admin-token') };
    config = {
      get: jest.fn((key: string, fallback?: string) => {
        if (key === 'PLATFORM_ADMIN_JWT_SECRET') return 'platform-admin-secret';
        if (key === 'PLATFORM_ADMIN_JWT_TTL') return fallback ?? '8h';
        return fallback;
      }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformAdminAuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = moduleRef.get(PlatformAdminAuthService);
  });

  it('throws the SAME error for an unknown email as for a wrong password (no account enumeration)', async () => {
    prisma.platformAdmin.findUnique.mockResolvedValue(null);
    let unknownEmailError: Error | undefined;
    try {
      await service.login('nobody@mizan.sa', 'whatever');
    } catch (e) {
      unknownEmailError = e as Error;
    }

    const hash = await bcrypt.hash('correct-password', 4);
    prisma.platformAdmin.findUnique.mockResolvedValue({ id: 'admin-1', email: 'ops@mizan.sa', status: 'active', passwordHash: hash });
    let wrongPasswordError: Error | undefined;
    try {
      await service.login('ops@mizan.sa', 'wrong-password');
    } catch (e) {
      wrongPasswordError = e as Error;
    }

    expect(unknownEmailError).toBeInstanceOf(UnauthorizedException);
    expect(wrongPasswordError).toBeInstanceOf(UnauthorizedException);
    expect(unknownEmailError?.message).toBe(wrongPasswordError?.message);
  });

  it('rejects login for a disabled platform admin account, even with the correct password', async () => {
    const hash = await bcrypt.hash('correct-password', 4);
    prisma.platformAdmin.findUnique.mockResolvedValue({ id: 'admin-1', email: 'ops@mizan.sa', status: 'disabled', passwordHash: hash });

    await expect(service.login('ops@mizan.sa', 'correct-password')).rejects.toThrow(ForbiddenException);
  });

  it('signs the token with PLATFORM_ADMIN_JWT_SECRET, never any tenant secret', async () => {
    const hash = await bcrypt.hash('correct-password', 4);
    prisma.platformAdmin.findUnique.mockResolvedValue({ id: 'admin-1', email: 'ops@mizan.sa', status: 'active', passwordHash: hash });
    prisma.platformAdmin.update.mockResolvedValue({});

    await service.login('ops@mizan.sa', 'correct-password');

    const signCallOptions = jwt.sign.mock.calls[0][1];
    expect(signCallOptions.secret).toBe('platform-admin-secret');
  });

  it('signs a payload with type: "platform-admin" and NO companyId field at all', async () => {
    const hash = await bcrypt.hash('correct-password', 4);
    prisma.platformAdmin.findUnique.mockResolvedValue({ id: 'admin-1', email: 'ops@mizan.sa', status: 'active', passwordHash: hash });
    prisma.platformAdmin.update.mockResolvedValue({});

    await service.login('ops@mizan.sa', 'correct-password');

    const signedPayload = jwt.sign.mock.calls[0][0];
    expect(signedPayload.type).toBe('platform-admin');
    expect('companyId' in signedPayload).toBe(false);
  });

  it('updates lastLoginAt on a successful login', async () => {
    const hash = await bcrypt.hash('correct-password', 4);
    prisma.platformAdmin.findUnique.mockResolvedValue({ id: 'admin-1', email: 'ops@mizan.sa', status: 'active', passwordHash: hash });
    prisma.platformAdmin.update.mockResolvedValue({});

    await service.login('ops@mizan.sa', 'correct-password');

    expect(prisma.platformAdmin.update).toHaveBeenCalledWith({
      where: { id: 'admin-1' },
      data: { lastLoginAt: expect.any(Date) },
    });
  });

  it('throws a clear error when PLATFORM_ADMIN_JWT_SECRET is not configured, rather than signing with undefined', async () => {
    config.get.mockImplementation((key: string) => (key === 'PLATFORM_ADMIN_JWT_SECRET' ? undefined : '8h'));
    const hash = await bcrypt.hash('correct-password', 4);
    prisma.platformAdmin.findUnique.mockResolvedValue({ id: 'admin-1', email: 'ops@mizan.sa', status: 'active', passwordHash: hash });
    prisma.platformAdmin.update.mockResolvedValue({});

    await expect(service.login('ops@mizan.sa', 'correct-password')).rejects.toThrow(/PLATFORM_ADMIN_JWT_SECRET/);
  });
});
