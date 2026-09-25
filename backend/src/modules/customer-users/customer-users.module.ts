import { Module } from '@nestjs/common';
import { CustomerUsersService } from './customer-users.service';
import { CustomerUsersController } from './customer-users.controller';
import { CustomersModule } from '../customers/customers.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [CustomersModule, AuthModule],
  controllers: [CustomerUsersController],
  providers: [CustomerUsersService],
  exports: [CustomerUsersService],
})
export class CustomerUsersModule {}
