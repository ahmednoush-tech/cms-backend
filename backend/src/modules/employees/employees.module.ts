import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeeDocumentsService } from './employee-documents.service';
import { EmployeesController } from './employees.controller';

@Module({
  controllers: [EmployeesController],
  providers: [EmployeesService, EmployeeDocumentsService],
  exports: [EmployeesService, EmployeeDocumentsService],
})
export class EmployeesModule {}
