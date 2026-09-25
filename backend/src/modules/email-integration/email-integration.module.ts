import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailIntegrationService } from './email-integration.service';
import { EmailSyncService } from './email-sync.service';
import { EmailIntegrationController } from './email-integration.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [EmailIntegrationController],
  providers: [EmailIntegrationService, EmailSyncService],
})
export class EmailIntegrationModule {}
