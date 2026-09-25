import { Test } from '@nestjs/testing';
import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { EmailSyncService } from './email-sync.service';
import { PrismaService } from '../../prisma/prisma.service';
import { encryptCredential } from '../../common/utils/credentials-encryption.util';

describe('EmailSyncService', () => {
  let service: EmailSyncService;
  let prisma: any;

  const activeIntegration = {
    userId: 'user-1',
    status: 'active',
    accessToken: 'valid-access-token',
    refreshToken: 'refresh-token',
    tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
  };

  beforeEach(async () => {
    prisma = {
      emailIntegration: { findUnique: jest.fn(), update: jest.fn() },
      emailSyncedMessage: { findUnique: jest.fn(), create: jest.fn() },
      customer: { findMany: jest.fn() },
      lead: { findMany: jest.fn() },
      interaction: { create: jest.fn() },
      company: { findFirst: jest.fn() },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [EmailSyncService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(EmailSyncService);
    global.fetch = jest.fn();
    prisma.emailIntegration.update.mockResolvedValue({});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('404s when there is no active integration for the user', async () => {
    prisma.emailIntegration.findUnique.mockResolvedValue(null);
    await expect(service.sync('company-1', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('404s when the integration exists but was disconnected', async () => {
    prisma.emailIntegration.findUnique.mockResolvedValue({ ...activeIntegration, status: 'disconnected' });
    await expect(service.sync('company-1', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('throws when Microsoft Graph rejects the messages request', async () => {
    prisma.emailIntegration.findUnique.mockResolvedValue(activeIntegration);
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

    await expect(service.sync('company-1', 'user-1')).rejects.toThrow(UnprocessableEntityException);
  });

  it('skips a message that was already synced, without re-checking it against contacts', async () => {
    prisma.emailIntegration.findUnique.mockResolvedValue(activeIntegration);
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: [{ id: 'msg-1', subject: 'Hi', receivedDateTime: '2026-01-01T10:00:00Z', bodyPreview: 'hello', from: { emailAddress: { address: 'x@y.com' } }, toRecipients: [] }] }),
    });
    prisma.emailSyncedMessage.findUnique.mockResolvedValue({ id: 'already-synced-record' });

    const result = await service.sync('company-1', 'user-1');

    expect(result.skippedAlreadySynced).toBe(1);
    expect(result.matchedCount).toBe(0);
    expect(prisma.customer.findMany).not.toHaveBeenCalled();
  });

  it('logs an Interaction when the sender matches an existing customer by email (case-insensitively)', async () => {
    prisma.emailIntegration.findUnique.mockResolvedValue(activeIntegration);
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        value: [
          {
            id: 'msg-1',
            subject: 'Quote follow-up',
            receivedDateTime: '2026-01-01T10:00:00Z',
            bodyPreview: 'Following up on the quote',
            from: { emailAddress: { address: 'Sara@CustomerCo.com' } },
            toRecipients: [{ emailAddress: { address: 'ahmed@arkan-sys.com' } }],
          },
        ],
      }),
    });
    prisma.emailSyncedMessage.findUnique.mockResolvedValue(null);
    prisma.customer.findMany.mockResolvedValue([{ id: 'cust-1', email: 'sara@customerco.com' }]);
    prisma.interaction.create.mockResolvedValue({ id: 'interaction-1' });

    const result = await service.sync('company-1', 'user-1');

    expect(result.matchedCount).toBe(1);
    const interactionCall = prisma.interaction.create.mock.calls[0][0];
    expect(interactionCall.data.customerId).toBe('cust-1');
    expect(interactionCall.data.type).toBe('email');
    expect(interactionCall.data.createdBy).toBe('user-1');
  });

  it('falls back to matching a lead when no customer matches', async () => {
    prisma.emailIntegration.findUnique.mockResolvedValue(activeIntegration);
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        value: [{ id: 'msg-1', subject: 'Interest', receivedDateTime: '2026-01-01T10:00:00Z', bodyPreview: null, from: { emailAddress: { address: 'lead@prospect.com' } }, toRecipients: [] }],
      }),
    });
    prisma.emailSyncedMessage.findUnique.mockResolvedValue(null);
    prisma.customer.findMany.mockResolvedValue([]);
    prisma.lead.findMany.mockResolvedValue([{ id: 'lead-1', email: 'lead@prospect.com' }]);
    prisma.interaction.create.mockResolvedValue({ id: 'interaction-1' });

    const result = await service.sync('company-1', 'user-1');

    expect(result.matchedCount).toBe(1);
    const interactionCall = prisma.interaction.create.mock.calls[0][0];
    expect(interactionCall.data.leadId).toBe('lead-1');
    expect(interactionCall.data.customerId).toBeUndefined();
  });

  it('skips (and still records as synced) a message matching no known contact — never logs mail from an unrecognized address', async () => {
    prisma.emailIntegration.findUnique.mockResolvedValue(activeIntegration);
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        value: [{ id: 'msg-1', subject: 'Spam', receivedDateTime: '2026-01-01T10:00:00Z', bodyPreview: null, from: { emailAddress: { address: 'unknown@nowhere.com' } }, toRecipients: [] }],
      }),
    });
    prisma.emailSyncedMessage.findUnique.mockResolvedValue(null);
    prisma.customer.findMany.mockResolvedValue([]);
    prisma.lead.findMany.mockResolvedValue([]);

    const result = await service.sync('company-1', 'user-1');

    expect(result.skippedNoMatch).toBe(1);
    expect(prisma.interaction.create).not.toHaveBeenCalled();
    expect(prisma.emailSyncedMessage.create).toHaveBeenCalledWith({ data: { userId: 'user-1', providerMessageId: 'msg-1' } });
  });

  it('refreshes the access token via Microsoft when the stored one has expired, using THIS company\'s own credentials', async () => {
    const expiredIntegration = { ...activeIntegration, tokenExpiresAt: new Date(Date.now() - 60 * 60 * 1000) };
    prisma.emailIntegration.findUnique.mockResolvedValue(expiredIntegration);
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'test-master-key-for-specs';
    prisma.company.findFirst.mockResolvedValue({
      microsoftClientId: 'company-client-id',
      microsoftClientSecretEncrypted: encryptCredential('company-client-secret'),
    });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'new-token', refresh_token: 'new-refresh', expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ value: [] }) });

    await service.sync('company-1', 'user-1');

    const refreshCallUrl = (global.fetch as jest.Mock).mock.calls[0][0];
    const refreshCallBody = (global.fetch as jest.Mock).mock.calls[0][1].body as URLSearchParams;
    expect(refreshCallUrl).toContain('login.microsoftonline.com');
    expect(refreshCallBody.get('client_secret')).toBe('company-client-secret'); // decrypted, not ciphertext
    expect(prisma.emailIntegration.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: expiredIntegration.userId }, data: expect.objectContaining({ accessToken: 'new-token' }) }),
    );
  });

  it('rejects a sync when this company has not configured its own Microsoft credentials', async () => {
    const expiredIntegration = { ...activeIntegration, tokenExpiresAt: new Date(Date.now() - 60 * 60 * 1000) };
    prisma.emailIntegration.findUnique.mockResolvedValue(expiredIntegration);
    prisma.company.findFirst.mockResolvedValue({ microsoftClientId: null, microsoftClientSecretEncrypted: null });

    await expect(service.sync('company-1', 'user-1')).rejects.toThrow(UnprocessableEntityException);
  });
});
