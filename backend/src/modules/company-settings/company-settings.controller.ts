import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CompanySettingsService, ALLOWED_LOGO_MIME_TYPES, MAX_LOGO_SIZE_BYTES } from './company-settings.service';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';
import { UpdateMicrosoftIntegrationDto } from './dto/update-microsoft-integration.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Administration / Company Settings')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Permissions('Administration:company_settings:manage')
@Controller('api/v1/company-settings')
export class CompanySettingsController {
  constructor(private companySettingsService: CompanySettingsService) {}

  @Get()
  get(@CurrentUser('companyId') companyId: string) {
    return this.companySettingsService.get(companyId);
  }

  @Patch()
  update(@CurrentUser('companyId') companyId: string, @Body() dto: UpdateCompanySettingsDto) {
    return this.companySettingsService.update(companyId, dto);
  }

  @Post('logo')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_LOGO_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_LOGO_MIME_TYPES.includes(file.mimetype)) {
          callback(new UnprocessableEntityException(`Logo file type "${file.mimetype}" is not allowed.`), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadLogo(@CurrentUser('companyId') companyId: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new UnprocessableEntityException('No logo file was uploaded.');
    }
    return this.companySettingsService.uploadLogo(companyId, file);
  }

  @Get('microsoft-integration')
  getMicrosoftIntegration(@CurrentUser('companyId') companyId: string) {
    return this.companySettingsService.getMicrosoftIntegrationSettings(companyId);
  }

  @Patch('microsoft-integration')
  updateMicrosoftIntegration(@CurrentUser('companyId') companyId: string, @Body() dto: UpdateMicrosoftIntegrationDto) {
    return this.companySettingsService.updateMicrosoftIntegrationSettings(companyId, dto);
  }
}
