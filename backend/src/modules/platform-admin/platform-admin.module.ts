import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { PlatformAdminAuthService } from './platform-admin-auth.service';
import { PlatformAdminCompaniesService } from './platform-admin-companies.service';
import { PlatformSettingsService } from './platform-settings.service';
import { PlatformAdminAuthController } from './platform-admin-auth.controller';
import { PlatformAdminCompaniesController } from './platform-admin-companies.controller';
import { PlatformSettingsController } from './platform-settings.controller';
import { PlatformAdminSettingsController } from './platform-admin-settings.controller';
import { PlatformAdminJwtStrategy } from './strategies/platform-admin-jwt.strategy';
import { StorageModule } from '../storage/storage.module';

/**
 * No dependency on AuthModule at all — deliberately isolated.
 * JwtModule.register({}) registers no default secret since every
 * sign()/strategy here explicitly uses PLATFORM_ADMIN_JWT_SECRET —
 * there is no shared default that could accidentally leak between
 * the two systems.
 */
@Module({
  imports: [PassportModule, JwtModule.register({}), StorageModule],
  controllers: [
    PlatformAdminAuthController,
    PlatformAdminCompaniesController,
    PlatformSettingsController,
    PlatformAdminSettingsController,
  ],
  providers: [PlatformAdminAuthService, PlatformAdminCompaniesService, PlatformSettingsService, PlatformAdminJwtStrategy],
})
export class PlatformAdminModule {}
