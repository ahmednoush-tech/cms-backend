import { Module } from '@nestjs/common';
import { CompanySettingsService } from './company-settings.service';
import { CompanySettingsController } from './company-settings.controller';
import { PublicCompanyInfoService } from './public-company-info.service';
import { PublicCompanyInfoController } from './public-company-info.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [CompanySettingsController, PublicCompanyInfoController],
  providers: [CompanySettingsService, PublicCompanyInfoService],
  exports: [CompanySettingsService],
})
export class CompanySettingsModule {}
