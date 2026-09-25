import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InventoryStockService } from './inventory-stock.service';

@ApiTags('Operations / Inventory Stock')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/inventory-stock')
export class InventoryStockController {
  constructor(private inventoryStockService: InventoryStockService) {}

  @Get('warehouse/:warehouseId')
  @Permissions('Operations:inventory_stock:view')
  findByWarehouse(@CurrentUser('companyId') companyId: string, @Param('warehouseId', ParseUUIDPipe) warehouseId: string) {
    return this.inventoryStockService.findByWarehouse(companyId, warehouseId);
  }

  @Get('item/:itemId')
  @Permissions('Operations:inventory_stock:view')
  findByItem(@CurrentUser('companyId') companyId: string, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.inventoryStockService.findByItem(companyId, itemId);
  }

  @Get('low-stock')
  @Permissions('Operations:inventory_stock:view')
  findLowStock(@CurrentUser('companyId') companyId: string) {
    return this.inventoryStockService.findLowStock(companyId);
  }
}
