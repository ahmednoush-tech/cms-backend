import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectMembersService } from './project-members.service';
import { ProjectsController } from './projects.controller';
import { ProjectMembersController } from './project-members.controller';
import { CustomersModule } from '../customers/customers.module';
import { EmployeesModule } from '../employees/employees.module';

@Module({
  imports: [CustomersModule, EmployeesModule],
  controllers: [ProjectsController, ProjectMembersController],
  providers: [ProjectsService, ProjectMembersService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
