import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { AutomationRulesModule } from '../automation-rules/automation-rules.module';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';

@Module({
  imports: [AutomationRulesModule, CustomFieldsModule],
  controllers: [LeadsController],
  providers: [LeadsService],
  exports: [LeadsService],
})
export class LeadsModule {}
