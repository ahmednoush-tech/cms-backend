import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomerDuplicateDetectionService } from './customer-duplicate-detection.service';
import { CustomersController } from './customers.controller';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';

@Module({
  imports: [CustomFieldsModule],
  controllers: [CustomersController],
  providers: [CustomersService, CustomerDuplicateDetectionService],
  exports: [CustomersService],
})
export class CustomersModule {}
