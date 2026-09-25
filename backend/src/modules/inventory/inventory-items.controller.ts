import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InternalOnly } from '../../common/decorators/internal-only.decorator';
import { InternalOnlyGuard } from '../../common/guards/internal-only.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InventoryItemsService } from './inventory-items.service';
import { CreateInventoryItemDto, UpdateInventoryItemDto } from './dto/inventory-item.dto';

@ApiTags('Operations / Inventory Items')
@ApiBearerAuth()
@InternalOnly()
@UseGuards(InternalOnlyGuard, PermissionsGuard)
@Controller('api/v1/inventory-items')
export class InventoryItemsController {
  constructor(private inventoryItemsService: InventoryItemsService) {}

  @Get()
  @Permissions('Operations:inventory_items:view')
  findAll(@CurrentUser('companyId') companyId: string) {
    return this.inventoryItemsService.findAll(companyId);
  }

  @Get(':id')
  @Permissions('Operations:inventory_items:view')
  findOne(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryItemsService.findOne(companyId, id);
  }

  @Post()
  @Permissions('Operations:inventory_items:manage')
  create(@CurrentUser('companyId') companyId: string, @Body() dto: CreateInventoryItemDto) {
    return this.inventoryItemsService.create(companyId, dto);
  }

  @Patch(':id')
  @Permissions('Operations:inventory_items:manage')
  update(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInventoryItemDto) {
    return this.inventoryItemsService.update(companyId, id, dto);
  }

  @Delete(':id')
  @Permissions('Operations:inventory_items:manage')
  deactivate(@CurrentUser('companyId') companyId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryItemsService.deactivate(companyId, id);
  }
}
