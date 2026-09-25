import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlatformAdminJwtStrategy } from './platform-admin-jwt.strategy';
import { PrismaService } from '../../../prisma/prisma.service';

describe('PlatformAdminJwtStrategy', () => {
  let strategy: PlatformAdminJwtStrategy;
  let prisma: any;

  beforeEach(async () => {
    prisma = { platformAdmin: { findUnique: jest.fn() } };
    const config = { get: jest.fn().mockReturnValue('platform-admin-secret') };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformAdminJwtStrategy,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    strategy = moduleRef.get(PlatformAdminJwtStrategy);
  });

  it('rejects a payload missing the "platform-admin" type marker, even if sub/email look valid', async () => {
    await expect(
      strategy.validate({ sub: 'admin-1', email: 'ops@mizan.sa', type: 'something-else' } as any),
    ).rejects.toThrow(UnauthorizedException);
    expect(prisma.platformAdmin.findUnique).not.toHaveBeenCalled();
  });

  it('rejects when the admin no longer exists', async () => {
    prisma.platformAdmin.findUnique.mockResolvedValue(null);
    await expect(strategy.validate({ sub: 'admin-1', email: 'ops@mizan.sa', type: 'platform-admin' })).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when the admin has been disabled since the token was issued', async () => {
    prisma.platformAdmin.findUnique.mockResolvedValue({ id: 'admin-1', status: 'disabled' });
    await expect(strategy.validate({ sub: 'admin-1', email: 'ops@mizan.sa', type: 'platform-admin' })).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a valid, active platform admin and returns the payload as req.user', async () => {
    prisma.platformAdmin.findUnique.mockResolvedValue({ id: 'admin-1', status: 'active' });
    const payload = { sub: 'admin-1', email: 'ops@mizan.sa', type: 'platform-admin' as const };

    const result = await strategy.validate(payload);

    expect(result).toEqual(payload);
  });

  it('looks up the admin by the exact id in the token payload', async () => {
    prisma.platformAdmin.findUnique.mockResolvedValue({ id: 'admin-1', status: 'active' });

    await strategy.validate({ sub: 'admin-1', email: 'ops@mizan.sa', type: 'platform-admin' });

    expect(prisma.platformAdmin.findUnique).toHaveBeenCalledWith({ where: { id: 'admin-1' }, select: { id: true, status: true } });
  });
});
