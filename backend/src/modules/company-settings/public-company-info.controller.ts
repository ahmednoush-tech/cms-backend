import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { PublicCompanyInfoService } from './public-company-info.service';
import { CompanySettingsService } from './company-settings.service';
import { Public } from '../../common/decorators/public.decorator';

/**
 * No @UseGuards(), @Permissions(), or @InternalOnly() — same
 * pattern as PublicQuotationController. There is no authenticated
 * identity on this request by design; a login screen needs the
 * company name and logo BEFORE anyone has signed in.
 */
@ApiTags('Public / Company Info')
@Public()
@Controller('api/v1/public/company-info')
export class PublicCompanyInfoController {
  constructor(
    private publicCompanyInfoService: PublicCompanyInfoService,
    private companySettingsService: CompanySettingsService,
  ) {}

  @Get()
  get() {
    return this.publicCompanyInfoService.get();
  }

  /**
   * The actual file behind a company's logo — deliberately its
   * own endpoint rather than embedding a resolved URL in get()'s
   * response, because the underlying storage key needs resolving
   * FRESH on every request: an S3-backed logo's presigned URL
   * expires in minutes, so a value cached at get()-time would go
   * stale. Every <img src> for a logo anywhere in the app
   * (sidebar, login screen, public quotations) points here — see
   * logo-url.util.ts's logoStorageKeyToPublicPath, the only place
   * that builds this path, so nothing else hardcodes it.
   */
  @Get(':companyId/logo')
  async logo(@Param('companyId', ParseUUIDPipe) companyId: string, @Res() res: Response) {
    const { target, mimeType } = await this.companySettingsService.getLogoDownloadTarget(companyId);
    if (target.kind === 'redirect') {
      res.redirect(target.url);
      return;
    }
    res.setHeader('Content-Type', mimeType);
    res.sendFile(target.filePath);
  }
}
