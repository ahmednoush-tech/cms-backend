import { Module } from '@nestjs/common';
import { PayrollSettingsService } from './payroll-settings.service';
import { PayrollSettingsController } from './payroll-settings.controller';
import { PayrollRunsService } from './payroll-runs.service';
import { PayrollRunsController } from './payroll-runs.controller';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [FinanceModule],
  controllers: [PayrollSettingsController, PayrollRunsController],
  providers: [PayrollSettingsService, PayrollRunsService],
  exports: [PayrollSettingsService, PayrollRunsService],
})
export class PayrollModule {}
