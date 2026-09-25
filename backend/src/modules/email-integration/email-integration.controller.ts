import { Controller, Get, Post, Delete, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { EmailIntegrationService } from './email-integration.service';
import { EmailSyncService } from './email-sync.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';

/**
 * No @Permissions() on the authenticated routes below — deliberate,
 * not an oversight. Every action here (connect/status/sync/
 * disconnect) operates on the CALLER'S OWN integration only
 * (userId always comes from their own JWT, never a request
 * parameter someone else could supply), the same way any user can
 * always manage their own profile without a special grant.
 */
@ApiTags('CRM / Email Integration')
@Controller('api/v1/email-integration')
export class EmailIntegrationController {
  constructor(
    private emailIntegrationService: EmailIntegrationService,
    private emailSyncService: EmailSyncService,
    private config: ConfigService,
  ) {}

  @Get('status')
  @ApiBearerAuth()
  @InternalOnly()
  @UseGuards(InternalOnlyGuard)
  getStatus(@CurrentUser('sub') userId: string) {
    return this.emailIntegrationService.getStatus(userId);
  }

  /**
   * Returns the Microsoft authorization URL as JSON rather than
   * issuing a server-side redirect — this endpoint requires
   * authentication (InternalOnlyGuard), but a plain browser
   * navigation to it would carry no Authorization header at all
   * (Bearer tokens aren't cookies), so it would 401 before ever
   * reaching Microsoft. The frontend calls this via an
   * authenticated request, then navigates the browser to the
   * returned URL itself — that final hop to Microsoft's own login
   * page needs no token from this system.
   */
  @Get('connect')
  @ApiBearerAuth()
  @InternalOnly()
  @UseGuards(InternalOnlyGuard)
  async connect(@CurrentUser('sub') userId: string, @CurrentUser('companyId') companyId: string) {
    const url = await this.emailIntegrationService.buildAuthorizationUrl(userId, companyId);
    return { url };
  }

  /**
   * @Public() — Microsoft's own redirect back to this URL carries
   * NO Authorization header at all; the `state` query parameter
   * (a short-lived signed JWT) is what identifies which user is
   * completing the flow. See EmailIntegrationService.handleOAuthCallback().
   */
  @Get('callback')
  @Public()
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    try {
      await this.emailIntegrationService.handleOAuthCallback(code, state);
      res.redirect(`${frontendUrl}/crm/email-integration?connected=1`);
    } catch {
      res.redirect(`${frontendUrl}/crm/email-integration?connected=0`);
    }
  }

  @Post('sync')
  @ApiBearerAuth()
  @InternalOnly()
  @UseGuards(InternalOnlyGuard)
  sync(@CurrentUser('sub') userId: string, @CurrentUser('companyId') companyId: string) {
    return this.emailSyncService.sync(companyId, userId);
  }

  @Delete('disconnect')
  @ApiBearerAuth()
  @InternalOnly()
  @UseGuards(InternalOnlyGuard)
  disconnect(@CurrentUser('sub') userId: string) {
    return this.emailIntegrationService.disconnect(userId);
  }
}
