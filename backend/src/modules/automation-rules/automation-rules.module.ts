import { Module } from '@nestjs/common';
import { AutomationRulesService } from './automation-rules.service';
import { AutomationRuleEngineService } from './automation-rule-engine.service';
import { AutomationRulesController } from './automation-rules.controller';

@Module({
  controllers: [AutomationRulesController],
  providers: [AutomationRulesService, AutomationRuleEngineService],
  exports: [AutomationRuleEngineService],
})
export class AutomationRulesModule {}
