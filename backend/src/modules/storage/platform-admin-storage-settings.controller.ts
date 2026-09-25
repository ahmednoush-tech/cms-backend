import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformStorageSettingsService } from './platform-storage-settings.service';
import { UpdatePlatformStorageSettingsDto } from './dto/update-platform-storage-settings.dto';
import { PlatformAdminAuthGuard } from '../platform-admin/guards/platform-admin-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

/**
 * @Public() here has the SAME meaning as on every other
 * platform-admin controller — it skips the app's GLOBAL tenant
 * JwtAuthGuard only, since PlatformAdminAuthGuard below is the
 * REAL, mandatory protection on every route here. A regular
 * tenant-company user, however senior their role, can never reach
 * these routes — only an authenticated platform admin can.
 */
@ApiTags('Platform Admin / Storage Settings')
@ApiBearerAuth()
@Public()
@UseGuards(PlatformAdminAuthGuard)
@Controller('api/v1/platform-admin/storage-settings')
export class PlatformAdminStorageSettingsController {
  constructor(private platformStorageSettingsService: PlatformStorageSettingsService) {}

  @Get()
  get() {
    return this.platformStorageSettingsService.get();
  }

  @Patch()
  update(@Body() dto: UpdatePlatformStorageSettingsDto) {
    return this.platformStorageSettingsService.update(dto);
  }
}
