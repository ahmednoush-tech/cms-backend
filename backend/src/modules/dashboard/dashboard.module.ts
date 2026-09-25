import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { CustomersModule } from '../customers/customers.module';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [CustomersModule, ProjectsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
