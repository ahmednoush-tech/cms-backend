import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrderReceiptsService } from './purchase-order-receipts.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { RejectPurchaseOrderDto } from './dto/reject-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Finance / Purchase Orders')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/purchase-orders')
export class PurchaseOrdersController {
  constructor(
    private purchaseOrdersService: PurchaseOrdersService,
    private purchaseOrderReceiptsService: PurchaseOrderReceiptsService,
  ) {}

  @Post()
  @Permissions('Finance:purchase_orders:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreatePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.create(companyId, actorUserId, dto);
  }

  @Get()
  @Permissions('Finance:purchase_orders:view')
  findAll(@CurrentUser('companyId') companyId: string, @Query() query: PaginationQueryDto & { status?: string; vendorId?: string }) {
    return this.purchaseOrdersService.findAll(companyId, query);
  }

  @Get(':id')
  @Permissions('Finance:purchase_orders:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrdersService.findOne(companyId, id);
  }

  @Patch(':id')
  @Permissions('Finance:purchase_orders:edit')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.update(companyId, id, dto);
  }

  @Delete(':id')
  @Permissions('Finance:purchase_orders:delete')
  remove(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrdersService.softDelete(companyId, id);
  }

  @Post(':id/submit')
  @Permissions('Finance:purchase_orders:edit')
  submitForApproval(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrdersService.submitForApproval(companyId, id);
  }

  @Post(':id/approve')
  @Permissions('Finance:purchase_orders:approve')
  approve(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.purchaseOrdersService.approve(companyId, actorUserId, id);
  }

  @Post(':id/reject')
  @Permissions('Finance:purchase_orders:approve')
  reject(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectPurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.reject(companyId, id, dto);
  }

  @Post(':id/send')
  @Permissions('Finance:purchase_orders:send')
  send(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrdersService.send(companyId, id);
  }

  @Post(':id/cancel')
  @Permissions('Finance:purchase_orders:edit')
  cancel(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.purchaseOrdersService.cancel(companyId, id);
  }

  @Post(':id/convert-to-bill')
  @Permissions('Finance:bills:create')
  convertToBill(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.purchaseOrdersService.convertToBill(companyId, actorUserId, id);
  }

  @Post(':id/receive')
  @Permissions('Finance:purchase_orders:receive')
  receive(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceivePurchaseOrderDto,
  ) {
    return this.purchaseOrderReceiptsService.receive(companyId, actorUserId, id, dto);
  }
}
