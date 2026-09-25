import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformAdminCompaniesService } from './platform-admin-companies.service';
import { PlatformAdminAuthGuard } from './guards/platform-admin-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

/**
 * @Public() here does NOT mean "no authentication required" — it
 * only tells the app's GLOBAL JwtAuthGuard (APP_GUARD) to skip
 * this controller, since that guard checks tenant 'jwt' strategy
 * tokens and would otherwise reject a platform-admin token before
 * @UseGuards(PlatformAdminAuthGuard) below ever got a chance to
 * validate it correctly. PlatformAdminAuthGuard is the REAL,
 * mandatory protection on every route in this controller.
 */
@ApiTags('Platform Admin / Companies')
@ApiBearerAuth()
@Public()
@UseGuards(PlatformAdminAuthGuard)
@Controller('api/v1/platform-admin/companies')
export class PlatformAdminCompaniesController {
  constructor(private platformAdminCompaniesService: PlatformAdminCompaniesService) {}

  @Get()
  listCompanies() {
    return this.platformAdminCompaniesService.listCompanies();
  }

  @Get(':id')
  getCompanyDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.platformAdminCompaniesService.getCompanyDetail(id);
  }
}
