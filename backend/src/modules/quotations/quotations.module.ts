import { Module } from '@nestjs/common';
import { QuotationsService } from './quotations.service';
import { QuotationsController } from './quotations.controller';
import { QuotationItemsController } from './quotation-items.controller';
import { PublicQuotationService } from './public-quotation.service';
import { PublicQuotationController } from './public-quotation.controller';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [CustomersModule],
  controllers: [QuotationsController, QuotationItemsController, PublicQuotationController],
  providers: [QuotationsService, PublicQuotationService],
  exports: [QuotationsService],
})
export class QuotationsModule {}
