import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { ProjectsModule } from '../projects/projects.module';
import { WorkOrdersModule } from '../work-orders/work-orders.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [ProjectsModule, WorkOrdersModule, EmployeesModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
