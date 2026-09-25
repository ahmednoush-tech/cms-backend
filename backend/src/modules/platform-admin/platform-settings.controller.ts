import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { PlatformSettingsService } from './platform-settings.service';
import { Public } from '../../common/decorators/public.decorator';

/**
 * PUBLIC on purpose — every screen in the app, tenant or not,
 * logged in or not, needs to render Mizan's own current name/logo
 * (e.g. the login screen itself, before any authentication
 * exists). Read-only: no data here is sensitive.
 */
@ApiTags('Platform Settings')
@Controller('api/v1/platform-settings')
export class PlatformSettingsController {
  constructor(private platformSettingsService: PlatformSettingsService) {}

  @Public()
  @Get()
  get() {
    return this.platformSettingsService.get();
  }

  /**
   * The actual file behind the platform's logo — its own endpoint
   * for the same reason as the tenant-company logo's equivalent
   * (see PublicCompanyInfoController.logo): the underlying storage
   * key must be resolved FRESH on every request, since an
   * S3-backed logo's presigned URL expires in minutes.
   */
  @Public()
  @Get('logo')
  async logo(@Res() res: Response) {
    const { target, mimeType } = await this.platformSettingsService.getLogoDownloadTarget();
    if (target.kind === 'redirect') {
      res.redirect(target.url);
      return;
    }
    res.setHeader('Content-Type', mimeType);
    res.sendFile(target.filePath);
  }
}
