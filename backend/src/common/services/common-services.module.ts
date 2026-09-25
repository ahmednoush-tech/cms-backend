import { Global, Module } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { EmailService } from './email.service';
import { ScopeValidationService } from './scope-validation.service';

@Global()
@Module({
  providers: [ActivityLogService, EmailService, ScopeValidationService],
  exports: [ActivityLogService, EmailService, ScopeValidationService],
})
export class CommonServicesModule {}
