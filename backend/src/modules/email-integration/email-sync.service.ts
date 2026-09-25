import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getCompanyMicrosoftCredentials } from './company-microsoft-credentials.helper';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const OAUTH_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const SYNC_MESSAGE_LIMIT = 50;
const NOTES_PREVIEW_LENGTH = 500;

interface GraphMessage {
  id: string;
  subject: string | null;
  receivedDateTime: string;
  bodyPreview: string | null;
  from: { emailAddress: { address: string } } | null;
  toRecipients: Array<{ emailAddress: { address: string } }>;
}

@Injectable()
export class EmailSyncService {
  constructor(private prisma: PrismaService) {}

  /**
   * The on-demand "sync now" action — see migration 073's comment
   * for why this is not real-time push. Every message is checked
   * against EXISTING customers/leads by email address; anything
   * that doesn't match a known contact is never logged, and
   * anything already synced is skipped, so running this repeatedly
   * is always safe.
   */
  async sync(companyId: string, userId: string) {
    const integration = await this.prisma.emailIntegration.findUnique({ where: { userId } });
    if (!integration || integration.status !== 'active') {
      throw new NotFoundException('No active email integration for this user.');
    }

    const accessToken = await this.getValidAccessToken(companyId, integration);

    const url = `${GRAPH_BASE}/me/messages?$top=${SYNC_MESSAGE_LIMIT}&$orderby=receivedDateTime desc&$select=id,subject,receivedDateTime,bodyPreview,from,toRecipients`;
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) {
      throw new UnprocessableEntityException('Could not read messages from Microsoft — the connection may need to be re-established.');
    }
    const body = (await response.json()) as { value: GraphMessage[] };

    let matchedCount = 0;
    let skippedAlreadySynced = 0;
    let skippedNoMatch = 0;

    for (const message of body.value) {
      const alreadySynced = await this.prisma.emailSyncedMessage.findUnique({
        where: { userId_providerMessageId: { userId, providerMessageId: message.id } },
      });
      if (alreadySynced) {
        skippedAlreadySynced++;
        continue;
      }

      const addresses = [message.from?.emailAddress.address, ...message.toRecipients.map((r) => r.emailAddress.address)].filter(
        (a): a is string => !!a,
      );

      const match = await this.findMatchingContact(companyId, addresses);
      if (!match) {
        skippedNoMatch++;
        await this.prisma.emailSyncedMessage.create({ data: { userId, providerMessageId: message.id } });
        continue;
      }

      const interaction = await this.prisma.interaction.create({
        data: {
          companyId,
          customerId: match.type === 'customer' ? match.id : undefined,
          leadId: match.type === 'lead' ? match.id : undefined,
          type: 'email',
          subject: (message.subject ?? '(no subject)').slice(0, 200),
          notes: message.bodyPreview?.slice(0, NOTES_PREVIEW_LENGTH) ?? null,
          interactionDate: new Date(message.receivedDateTime),
          createdBy: userId,
        },
      });
      await this.prisma.emailSyncedMessage.create({
        data: { userId, providerMessageId: message.id, interactionId: interaction.id },
      });
      matchedCount++;
    }

    await this.prisma.emailIntegration.update({ where: { userId }, data: { lastSyncedAt: new Date() } });

    return { matchedCount, skippedAlreadySynced, skippedNoMatch, totalFetched: body.value.length };
  }

  /**
   * Matches case-insensitively in JavaScript, not via a Prisma
   * `in` + `mode: insensitive` filter combination — that
   * combination has no precedent anywhere else in this codebase
   * (only `contains` + `mode: insensitive` is used elsewhere), and
   * without a live database to test against, relying on an
   * unverified filter combination here was too large a risk for a
   * feature that writes CRM data. Fetching the company's
   * customers/leads with a non-null email and comparing in JS is
   * slightly less efficient but unambiguously correct.
   */
  private async findMatchingContact(companyId: string, addresses: string[]): Promise<{ type: 'customer' | 'lead'; id: string } | null> {
    if (addresses.length === 0) return null;
    const lowered = new Set(addresses.map((a) => a.toLowerCase()));

    const customers = await this.prisma.customer.findMany({
      where: { companyId, deletedAt: null, email: { not: null } },
      select: { id: true, email: true },
    });
    const matchedCustomer = customers.find((c) => c.email && lowered.has(c.email.toLowerCase()));
    if (matchedCustomer) return { type: 'customer', id: matchedCustomer.id };

    const leads = await this.prisma.lead.findMany({
      where: { companyId, deletedAt: null, email: { not: null } },
      select: { id: true, email: true },
    });
    const matchedLead = leads.find((l) => l.email && lowered.has(l.email.toLowerCase()));
    if (matchedLead) return { type: 'lead', id: matchedLead.id };

    return null;
  }

  /**
   * Refreshes the access token via the refresh_token when the
   * stored one has expired — this system never asks the user to
   * re-authenticate just because time passed, only if Microsoft
   * actually revokes the refresh token itself. Uses THIS
   * COMPANY'S OWN Client ID/Secret (see migration 074), not a
   * server-wide credential.
   */
  private async getValidAccessToken(
    companyId: string,
    integration: { accessToken: string; refreshToken: string; tokenExpiresAt: Date; userId: string },
  ): Promise<string> {
    if (integration.tokenExpiresAt > new Date(Date.now() + 60_000)) {
      return integration.accessToken;
    }

    const { clientId, clientSecret } = await getCompanyMicrosoftCredentials(this.prisma, companyId);

    const response = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: integration.refreshToken,
        scope: 'offline_access User.Read Mail.Read',
      }),
    });
    if (!response.ok) {
      throw new UnprocessableEntityException('The Microsoft connection has expired — please reconnect your account.');
    }
    const tokens = (await response.json()) as { access_token: string; refresh_token: string; expires_in: number };

    await this.prisma.emailIntegration.update({
      where: { userId: integration.userId },
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    return tokens.access_token;
  }
}
