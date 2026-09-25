import { Module } from '@nestjs/common';
import { CustomerContactsService } from './customer-contacts.service';
import { CustomerContactsController } from './customer-contacts.controller';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [CustomersModule],
  controllers: [CustomerContactsController],
  providers: [CustomerContactsService],
  exports: [CustomerContactsService],
})
export class CustomerContactsModule {}
