import { Injectable, NotFoundException, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { enableRlsBypass } from '../../prisma/rls-bypass.util';
import { getCompanyMicrosoftCredentials } from './company-microsoft-credentials.helper';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const OAUTH_AUTHORIZE_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const OAUTH_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const OAUTH_SCOPES = 'offline_access User.Read Mail.Read';

interface OAuthStatePayload {
  userId: string;
  companyId: string;
  purpose: 'email-integration-oauth';
}

/**
 * Everything Microsoft-specific lives in this one file. See
 * migration 073's comment for the full scope disclosure — Outlook
 * only, per-user, read-only, on-demand sync. See migration 074 for
 * why the Client ID/Secret are PER-COMPANY (fetched via
 * getCompanyMicrosoftCredentials), not a single server-wide
 * MICROSOFT_CLIENT_ID/SECRET — only the redirect URI stays a
 * deployment-wide setting, since it's this backend's own callback
 * path, not something that varies by company.
 */
@Injectable()
export class EmailIntegrationService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async getStatus(userId: string) {
    const integration = await this.prisma.emailIntegration.findUnique({ where: { userId } });
    if (!integration || integration.status !== 'active') {
      return { connected: false as const };
    }
    return {
      connected: true as const,
      connectedEmail: integration.connectedEmail,
      lastSyncedAt: integration.lastSyncedAt,
    };
  }

  /**
   * The `state` parameter is how we recognize which user is
   * completing the OAuth flow when Microsoft redirects back — it
   * carries no session/cookie of its own, so this is signed
   * (reusing the existing JwtService, not a new secret) and given
   * a short expiry, exactly long enough for a real user to
   * complete the Microsoft consent screen.
   */
  async buildAuthorizationUrl(userId: string, companyId: string): Promise<string> {
    const { clientId } = await getCompanyMicrosoftCredentials(this.prisma, companyId);

    const payload: OAuthStatePayload = { userId, companyId, purpose: 'email-integration-oauth' };
    const state = this.jwt.sign(payload, { expiresIn: '10m' });

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: this.getRedirectUri(),
      scope: OAUTH_SCOPES,
      state,
      response_mode: 'query',
    });
    return `${OAUTH_AUTHORIZE_URL}?${params.toString()}`;
  }

  /**
   * Runs with NO JWT-derived company context — Microsoft's
   * redirect carries no Authorization header at all. This is
   * bypass_rls call site #5 (alongside JwtStrategy's bootstrap
   * lookup, the two public read endpoints, and SignupService).
   */
  async handleOAuthCallback(code: string, state: string) {
    let payload: OAuthStatePayload;
    try {
      payload = this.jwt.verify(state);
    } catch {
      throw new UnauthorizedException('This connection link has expired or is invalid — please try connecting again.');
    }
    if (payload.purpose !== 'email-integration-oauth') {
      throw new UnauthorizedException('Invalid state parameter.');
    }

    await enableRlsBypass();

    const { clientId, clientSecret } = await getCompanyMicrosoftCredentials(this.prisma, payload.companyId);

    const tokenResponse = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: this.getRedirectUri(),
        grant_type: 'authorization_code',
        code,
        scope: OAUTH_SCOPES,
      }),
    });
    if (!tokenResponse.ok) {
      throw new UnprocessableEntityException('Microsoft rejected the connection request. Please try again.');
    }
    const tokens = (await tokenResponse.json()) as { access_token: string; refresh_token: string; expires_in: number };

    const profileResponse = await fetch(`${GRAPH_BASE}/me`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileResponse.ok) {
      throw new UnprocessableEntityException('Could not read the connected account details from Microsoft.');
    }
    const profile = (await profileResponse.json()) as { mail?: string; userPrincipalName?: string };
    const connectedEmail = profile.mail ?? profile.userPrincipalName;
    if (!connectedEmail) {
      throw new UnprocessableEntityException('Microsoft did not return an email address for this account.');
    }

    await this.prisma.emailIntegration.upsert({
      where: { userId: payload.userId },
      create: {
        companyId: payload.companyId,
        userId: payload.userId,
        connectedEmail,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        status: 'active',
      },
      update: {
        connectedEmail,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        status: 'active',
      },
    });

    return { connectedEmail };
  }

  async disconnect(userId: string) {
    const integration = await this.prisma.emailIntegration.findUnique({ where: { userId } });
    if (!integration) throw new NotFoundException('No email integration to disconnect.');
    return this.prisma.emailIntegration.update({ where: { userId }, data: { status: 'disconnected' } });
  }

  private getRedirectUri(): string {
    const value = this.config.get<string>('MICROSOFT_REDIRECT_URI');
    if (!value) throw new UnprocessableEntityException('Email integration is not configured — missing MICROSOFT_REDIRECT_URI.');
    return value;
  }
}
