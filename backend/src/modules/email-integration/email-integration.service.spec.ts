import { Test } from '@nestjs/testing';
import { NotFoundException, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailIntegrationService } from './email-integration.service';
import { PrismaService } from '../../prisma/prisma.service';
import { encryptCredential } from '../../common/utils/credentials-encryption.util';

describe('EmailIntegrationService', () => {
  let service: EmailIntegrationService;
  let prisma: any;
  let jwt: { sign: jest.Mock; verify: jest.Mock };
  let config: { get: jest.Mock };

  const companyWithCredentials = {
    microsoftClientId: 'company-client-id',
    microsoftClientSecretEncrypted: encryptCredential('company-client-secret'),
  };

  beforeEach(async () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'test-master-key-for-specs';

    prisma = {
      emailIntegration: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
      company: { findFirst: jest.fn() },
    };
    jwt = { sign: jest.fn().mockReturnValue('signed-state-token'), verify: jest.fn() };
    config = {
      get: jest.fn((key: string) => (key === 'MICROSOFT_REDIRECT_URI' ? 'http://localhost:3000/api/v1/email-integration/callback' : undefined)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        EmailIntegrationService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = moduleRef.get(EmailIntegrationService);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getStatus', () => {
    it('returns connected: false when there is no integration at all', async () => {
      prisma.emailIntegration.findUnique.mockResolvedValue(null);
      await expect(service.getStatus('user-1')).resolves.toEqual({ connected: false });
    });

    it('returns connected: false when the integration exists but was disconnected', async () => {
      prisma.emailIntegration.findUnique.mockResolvedValue({ status: 'disconnected', connectedEmail: 'a@b.com' });
      await expect(service.getStatus('user-1')).resolves.toEqual({ connected: false });
    });

    it('returns connected: true with the email when active', async () => {
      prisma.emailIntegration.findUnique.mockResolvedValue({ status: 'active', connectedEmail: 'ahmed@arkan-sys.com', lastSyncedAt: null });
      const result = await service.getStatus('user-1');
      expect(result).toEqual({ connected: true, connectedEmail: 'ahmed@arkan-sys.com', lastSyncedAt: null });
    });
  });

  describe('buildAuthorizationUrl', () => {
    it('rejects when this company has not configured its own Microsoft credentials yet', async () => {
      prisma.company.findFirst.mockResolvedValue({ microsoftClientId: null, microsoftClientSecretEncrypted: null });
      await expect(service.buildAuthorizationUrl('user-1', 'company-1')).rejects.toThrow(UnprocessableEntityException);
    });

    it("uses THIS company's own stored Client ID in the query filter and in the resulting URL", async () => {
      prisma.company.findFirst.mockResolvedValue(companyWithCredentials);

      const url = await service.buildAuthorizationUrl('user-1', 'company-1');

      const findFirstCall = prisma.company.findFirst.mock.calls[0][0];
      expect(findFirstCall.where.id).toBe('company-1');
      expect(url).toContain(`client_id=${companyWithCredentials.microsoftClientId}`);
    });

    it('signs a state token carrying the userId, companyId, and a distinguishing purpose', async () => {
      prisma.company.findFirst.mockResolvedValue(companyWithCredentials);
      await service.buildAuthorizationUrl('user-1', 'company-1');
      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: 'user-1', companyId: 'company-1', purpose: 'email-integration-oauth' },
        { expiresIn: '10m' },
      );
    });

    it('builds a URL pointing at the real Microsoft authorize endpoint with the expected scopes', async () => {
      prisma.company.findFirst.mockResolvedValue(companyWithCredentials);
      const url = await service.buildAuthorizationUrl('user-1', 'company-1');
      expect(url).toContain('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
      expect(url).toContain('Mail.Read');
      expect(url).toContain('offline_access');
    });
  });

  describe('handleOAuthCallback', () => {
    it('rejects when the state token fails verification (expired or tampered)', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });
      await expect(service.handleOAuthCallback('some-code', 'bad-state')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when the state token has the wrong purpose (defense in depth against token confusion)', async () => {
      jwt.verify.mockReturnValue({ userId: 'user-1', companyId: 'company-1', purpose: 'something-else' });
      await expect(service.handleOAuthCallback('some-code', 'wrong-purpose-state')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when Microsoft rejects the token exchange', async () => {
      jwt.verify.mockReturnValue({ userId: 'user-1', companyId: 'company-1', purpose: 'email-integration-oauth' });
      prisma.company.findFirst.mockResolvedValue(companyWithCredentials);
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

      await expect(service.handleOAuthCallback('bad-code', 'valid-state')).rejects.toThrow(UnprocessableEntityException);
    });

    it('rejects when Microsoft returns no email address on the profile', async () => {
      jwt.verify.mockReturnValue({ userId: 'user-1', companyId: 'company-1', purpose: 'email-integration-oauth' });
      prisma.company.findFirst.mockResolvedValue(companyWithCredentials);
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600 }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await expect(service.handleOAuthCallback('code', 'valid-state')).rejects.toThrow(UnprocessableEntityException);
    });

    it('succeeds, decrypts the stored secret correctly, and upserts the integration', async () => {
      jwt.verify.mockReturnValue({ userId: 'user-1', companyId: 'company-1', purpose: 'email-integration-oauth' });
      prisma.company.findFirst.mockResolvedValue(companyWithCredentials);
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600 }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ mail: 'ahmed@arkan-sys.com' }) });
      prisma.emailIntegration.upsert.mockResolvedValue({});

      const result = await service.handleOAuthCallback('code', 'valid-state');

      expect(result).toEqual({ connectedEmail: 'ahmed@arkan-sys.com' });
      const tokenExchangeBody = (global.fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams;
      expect(tokenExchangeBody.get('client_secret')).toBe('company-client-secret');

      const upsertCall = prisma.emailIntegration.upsert.mock.calls[0][0];
      expect(upsertCall.where).toEqual({ userId: 'user-1' });
      expect(upsertCall.create.companyId).toBe('company-1');
    });

    it('falls back to userPrincipalName when mail is not set on the profile', async () => {
      jwt.verify.mockReturnValue({ userId: 'user-1', companyId: 'company-1', purpose: 'email-integration-oauth' });
      prisma.company.findFirst.mockResolvedValue(companyWithCredentials);
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600 }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ userPrincipalName: 'ahmed@arkan-sys.onmicrosoft.com' }) });
      prisma.emailIntegration.upsert.mockResolvedValue({});

      const result = await service.handleOAuthCallback('code', 'valid-state');
      expect(result.connectedEmail).toBe('ahmed@arkan-sys.onmicrosoft.com');
    });
  });

  describe('disconnect', () => {
    it('404s when there is no integration to disconnect', async () => {
      prisma.emailIntegration.findUnique.mockResolvedValue(null);
      await expect(service.disconnect('user-1')).rejects.toThrow(NotFoundException);
    });

    it('marks an existing integration as disconnected', async () => {
      prisma.emailIntegration.findUnique.mockResolvedValue({ userId: 'user-1', status: 'active' });
      prisma.emailIntegration.update.mockResolvedValue({ status: 'disconnected' });

      await service.disconnect('user-1');

      expect(prisma.emailIntegration.update).toHaveBeenCalledWith({ where: { userId: 'user-1' }, data: { status: 'disconnected' } });
    });
  });
});
