import { Body, Controller, Get, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BillPaymentsService } from './bill-payments.service';
import { CreateBillPaymentDto } from './dto/create-bill-payment.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Finance / Bill Payments')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/bill-payments')
export class BillPaymentsController {
  constructor(private billPaymentsService: BillPaymentsService) {}

  @Post()
  @Permissions('Finance:bill_payments:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateBillPaymentDto,
  ) {
    return this.billPaymentsService.create(companyId, actorUserId, dto);
  }

  @Get()
  @Permissions('Finance:bill_payments:view')
  findAllForBill(@CurrentUser('companyId') companyId: string, @Query('billId', ParseUUIDPipe) billId: string) {
    return this.billPaymentsService.findAllForBill(companyId, billId);
  }
}
