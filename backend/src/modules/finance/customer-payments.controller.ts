import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomerPaymentsService } from './customer-payments.service';
import { CreateCustomerPaymentDto } from './dto/create-customer-payment.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Finance / Customer Payments')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/customer-payments')
export class CustomerPaymentsController {
  constructor(private customerPaymentsService: CustomerPaymentsService) {}

  @Post()
  @Permissions('Finance:payments:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateCustomerPaymentDto,
  ) {
    return this.customerPaymentsService.create(companyId, actorUserId, dto);
  }

  @Get()
  @Permissions('Finance:customer_payments:view')
  findAll(@CurrentUser('companyId') companyId: string, @Query('customerId') customerId?: string) {
    return this.customerPaymentsService.findAll(companyId, customerId);
  }

  @Get(':id')
  @Permissions('Finance:customer_payments:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.customerPaymentsService.findOne(companyId, id);
  }
}
