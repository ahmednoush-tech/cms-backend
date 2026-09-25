import { Module } from '@nestjs/common';
import { WorkOrdersService } from './work-orders.service';
import { WorkOrdersController } from './work-orders.controller';
import { ProjectsModule } from '../projects/projects.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [ProjectsModule, EmployeesModule],
  controllers: [WorkOrdersController],
  providers: [WorkOrdersService],
  exports: [WorkOrdersService],
})
export class WorkOrdersModule {}
