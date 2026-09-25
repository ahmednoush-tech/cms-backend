import { Body, Controller, Patch, Post, UnprocessableEntityException, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PlatformSettingsService, MAX_LOGO_SIZE_BYTES } from './platform-settings.service';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { PlatformAdminAuthGuard } from './guards/platform-admin-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

/**
 * @Public() here has the SAME meaning as on
 * PlatformAdminCompaniesController — it skips the app's GLOBAL
 * tenant JwtAuthGuard only, since PlatformAdminAuthGuard below is
 * the REAL, mandatory protection on every route in this
 * controller. Nothing here is actually public.
 */
@ApiTags('Platform Admin / Settings')
@ApiBearerAuth()
@Public()
@UseGuards(PlatformAdminAuthGuard)
@Controller('api/v1/platform-admin/settings')
export class PlatformAdminSettingsController {
  constructor(private platformSettingsService: PlatformSettingsService) {}

  @Patch()
  update(@Body() dto: UpdatePlatformSettingsDto) {
    return this.platformSettingsService.update(dto);
  }

  @Post('logo')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_LOGO_SIZE_BYTES } }))
  uploadLogo(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new UnprocessableEntityException('No logo file was uploaded.');
    }
    return this.platformSettingsService.uploadLogo(file);
  }
}
