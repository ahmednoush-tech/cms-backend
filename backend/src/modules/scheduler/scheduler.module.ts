import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { FinanceModule } from '../finance/finance.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [FinanceModule, EmployeesModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
