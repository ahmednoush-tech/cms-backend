import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InventoryItemsService } from './inventory-items.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Finance / Inventory')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/inventory-items')
export class InventoryItemsController {
  constructor(private inventoryItemsService: InventoryItemsService) {}

  @Post()
  @Permissions('Finance:inventory:create')
  create(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: CreateInventoryItemDto,
  ) {
    return this.inventoryItemsService.create(companyId, actorUserId, dto);
  }

  @Post('adjust-stock')
  @Permissions('Finance:inventory:adjust')
  adjustStock(
    @CurrentUser('companyId') companyId: string,
    @CurrentUser('sub') actorUserId: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.inventoryItemsService.adjustStock(companyId, actorUserId, dto);
  }

  @Get()
  @Permissions('Finance:inventory:view')
  findAll(@CurrentUser('companyId') companyId: string, @Query() query: PaginationQueryDto & { isActive?: boolean }) {
    return this.inventoryItemsService.findAll(companyId, query);
  }

  @Get(':id')
  @Permissions('Finance:inventory:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryItemsService.findOne(companyId, id);
  }

  @Get(':id/movements')
  @Permissions('Finance:inventory:view')
  findMovements(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryItemsService.findMovements(companyId, id);
  }

  @Patch(':id')
  @Permissions('Finance:inventory:edit')
  update(
    @CurrentUser('companyId') companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryItemDto,
  ) {
    return this.inventoryItemsService.update(companyId, id, dto);
  }
}
