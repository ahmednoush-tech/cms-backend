import { Body, Controller, Delete, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrderItemDto } from './dto/purchase-order-item.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Finance / Purchase Order Items')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/purchase-orders/:purchaseOrderId/items')
export class PurchaseOrderItemsController {
  constructor(private purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  @Permissions('Finance:purchase_orders:edit')
  create(
    @CurrentUser('companyId') companyId: string,
    @Param('purchaseOrderId', ParseUUIDPipe) purchaseOrderId: string,
    @Body() dto: PurchaseOrderItemDto,
  ) {
    return this.purchaseOrdersService.addItem(companyId, purchaseOrderId, dto);
  }

  @Delete(':itemId')
  @Permissions('Finance:purchase_orders:edit')
  remove(
    @CurrentUser('companyId') companyId: string,
    @Param('purchaseOrderId', ParseUUIDPipe) purchaseOrderId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.purchaseOrdersService.removeItem(companyId, purchaseOrderId, itemId);
  }
}
