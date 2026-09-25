import { Test } from '@nestjs/testing';
import { TokenDenylistService } from './token-denylist.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Replaces the in-memory Map this service used before this
 * session's fix: a real, disclosed problem where revoking a
 * refresh token on one app instance had no effect on a different
 * instance behind a load balancer. These tests are the first ever
 * written for this service — the previous in-memory version had
 * none.
 */
describe('TokenDenylistService', () => {
  let service: TokenDenylistService;
  let prisma: any;

  beforeEach(async () => {
    prisma = { revokedRefreshToken: { upsert: jest.fn(), findUnique: jest.fn() } };

    const moduleRef = await Test.createTestingModule({
      providers: [TokenDenylistService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(TokenDenylistService);
  });

  describe('revoke', () => {
    it('upserts the jti with its expiry — an upsert (not a plain create) so revoking the same jti twice never throws a duplicate-key error', async () => {
      const expiry = Date.now() + 60_000;
      await service.revoke('jti-1', expiry);

      expect(prisma.revokedRefreshToken.upsert).toHaveBeenCalledWith({
        where: { jti: 'jti-1' },
        create: { jti: 'jti-1', expiresAt: new Date(expiry) },
        update: { expiresAt: new Date(expiry) },
      });
    });
  });

  describe('isRevoked', () => {
    it('returns false for a jti that was never revoked', async () => {
      prisma.revokedRefreshToken.findUnique.mockResolvedValue(null);
      expect(await service.isRevoked('never-revoked')).toBe(false);
    });

    it('returns true for a jti revoked with a future expiry', async () => {
      prisma.revokedRefreshToken.findUnique.mockResolvedValue({
        jti: 'jti-1',
        expiresAt: new Date(Date.now() + 60_000),
      });
      expect(await service.isRevoked('jti-1')).toBe(true);
    });

    it('returns false for a revoked jti whose expiry has already passed — a naturally-expired entry is functionally irrelevant', async () => {
      prisma.revokedRefreshToken.findUnique.mockResolvedValue({
        jti: 'jti-1',
        expiresAt: new Date(Date.now() - 60_000),
      });
      expect(await service.isRevoked('jti-1')).toBe(false);
    });
  });
});
